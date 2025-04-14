import { mapRange } from '@utils/math.js';
import type { ControllerSetting } from 'src/renderer/src/types';
import { WebMidi } from 'webmidi';
import defaultInlineStyle from '../assets/input-defaults/editorCss.js';
import inputJson from '../assets/input-defaults/input.json';
import defaultSvgFilters from '../assets/input-defaults/svgFilters.js';
import useCodeElectronStorage from '../components/hooks/useCodeElectronStorage.svelte';

class SettingsStore {
  #controllerSettings = $state<ControllerSetting[]>(
    (inputJson.controllers || []) as ControllerSetting[],
  );
  #editorCssStorage = useCodeElectronStorage('editorCss', defaultInlineStyle);
  #svgFiltersStorage = useCodeElectronStorage('svgFilters', defaultSvgFilters);

  editorCssBySelector = $derived.by(() => {
    const css = this.editorCss;
    const result: Record<string, string[]> = {};

    // Use regex to split on closing braces followed by optional whitespace
    const blocks = css.split(/}\s*/);

    for (const block of blocks) {
      // Skip empty blocks
      if (!block.trim()) continue;

      // Split each block into selector and properties
      const [selectorPart, ...propertiesParts] = block.split('{');
      if (!selectorPart || !propertiesParts.length) continue;

      const selector = selectorPart.trim();
      const propertiesStr = propertiesParts.join('{'); // Rejoin in case there were '{' in the properties

      // Split properties into lines and process each line
      const cleanedProperties = propertiesStr
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) =>
            line && // Remove empty lines
            !line.startsWith('//') && // Remove comment lines
            !line.match(/^\s*\/\//), // Remove lines that start with whitespace followed by comments
        );

      if (cleanedProperties.length) {
        result[selector] = cleanedProperties;
      }
    }

    return result;
  });

  // Transform SASS variables in a CSS string to their computed values
  transformSassToCSS(lines: string[]): string[] {
    if (!lines?.length) return [];

    // If no controller settings, return cleaned lines
    if (!this.#controllerSettings?.length) return lines;

    // Create a variable lookup map for faster access
    const varMap = new Map(this.#controllerSettings.map((setting) => [setting.var, setting.value]));

    // Process each line that contains variables
    return lines.map((line) => {
      if (!line.includes('$')) return line;

      // Process variable replacements efficiently
      // Handle both $var and $var * value patterns in a single pass
      return line.replace(
        /\$([a-zA-Z0-9_]+)(?:\s*\*\s*([\d.]+)([a-z%]+)?)?/g,
        (match, varName, multiplier, unit) => {
          const value = varMap.get(varName);
          if (value === undefined) return match; // Keep original if var not found

          if (multiplier !== undefined) {
            const calculated = value * parseFloat(multiplier);
            return unit ? calculated + unit : calculated.toString();
          }

          return value.toString();
        },
      );
    });
  }

  // Computed CSS for .el selector with variables replaced
  editorCssElCompiled = $derived.by(() => {
    const elProperties = this.editorCssBySelector['.el'] || [];
    return this.transformSassToCSS(elProperties);
  });

  set controllerSettings(value: ControllerSetting[]) {
    this.#controllerSettings = value;
  }

  get controllerSettings(): ControllerSetting[] {
    return this.#controllerSettings;
  }

  set editorCss(value: string) {
    this.#editorCssStorage.value = value;
  }

  get editorCss(): string {
    return this.#editorCssStorage.value;
  }

  set svgFilters(value: string) {
    this.#svgFiltersStorage.value = value;
  }

  get svgFilters(): string {
    return this.#svgFiltersStorage.value;
  }

  // Update a specific controller value
  updateControllerValue(varName: string, newValue: number): void {
    const controller = this.#controllerSettings.find((c) => c.var === varName);
    if (controller) {
      // Round to 2 decimal places and remove trailing zeros
      controller.value = parseFloat(newValue.toFixed(2));
    }
  }

  // Reset a controller to its default value
  resetController(varName: string): void {
    const controller = this.#controllerSettings.find((c) => c.var === varName);
    if (controller) {
      controller.value = controller.default;
    }
  }

  // Reload content from last saved state
  reloadFromSaved(): void {
    this.#editorCssStorage.reloadFromSaved();
    this.#svgFiltersStorage.reloadFromSaved();
    console.log('Reloaded content from last saved state');
  }

  setupControllers(webMidi: typeof WebMidi): void {
    if (!webMidi || !webMidi.inputs.length) {
      console.warn('No MIDI device detected.');
      return;
    }

    const mySynth = webMidi.inputs[0];

    this.#controllerSettings.forEach((controller) => {
      console.log('controller', controller);
      window.setTimeout(() => {
        console.log('set synth');
        console.log('mySynth', mySynth);

        mySynth.channels[1].addListener('controlchange', (e) => {
          if (e.controller.number === controller.knobNum && typeof e.value === 'number') {
            const value = mapRange(e.value, 0, 1, controller.range[0], controller.range[1]);
            this.updateControllerValue(controller.var, Number.parseFloat(value.toFixed(2)));
          }
        });
      }, 5000);
    });
  }

  // Computed values
  get codeEditorContentSaved(): boolean {
    return this.#editorCssStorage.contentSaved && this.#svgFiltersStorage.contentSaved;
  }

  get controllerValues(): Record<string, number> {
    return Object.fromEntries(this.#controllerSettings.map((ctrl) => [ctrl.var, ctrl.value]));
  }

  get filterIds(): string[] {
    return extractFilterIds(this.#svgFiltersStorage.value);
  }
}

// Helper function to extract filter IDs from SVG code
function extractFilterIds(svgCode: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgCode, 'text/html');
  const filters = doc.querySelectorAll('filter[id]');
  return Array.from(filters).map((filter) => filter.id);
}

// Create and export a single instance of the settings store
export const settings = new SettingsStore();
