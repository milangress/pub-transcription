<script lang="ts">
  import type { BlockTxtSettings, ControllerSetting } from 'src/renderer/src/types';
  import { checkPosition } from './checkPosition.js';

  let {
    content = 'Hello World',
    isCurrent = false,
    settings = {
      editorCss: '',
      controllerSettings: [],
    },
    onOverflow = () => {},
  } = $props<{
    content?: string;
    isCurrent?: boolean;
    settings?: BlockTxtSettings;
    onOverflow?: () => void;
  }>();

  function transformSassToCSS(
    str: string | undefined,
    controllerSettings: ControllerSetting[],
  ): string {
    if (!str) return '';
    const staticString = $state.snapshot(str);
    const staticControllerSettings = $state.snapshot(controllerSettings);

    // Extract only the .el{} element
    const elMatch = staticString.match(/\.el\s*{([^}]*)}/);
    if (!elMatch || !elMatch[1]) return '';

    // Get just the content inside .el{}
    let cssContent = elMatch[1];

    // Remove comments in one pass
    cssContent = cssContent.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');

    // If no controller settings, return cleaned CSS
    if (!controllerSettings?.length) return cssContent.trim();

    // Create a variable lookup map for faster access
    const varMap = new Map();
    for (const setting of staticControllerSettings) {
      varMap.set(setting.var, setting.value);
    }

    // Process variable replacements efficiently
    // Handle both $var and $var * value patterns in a single pass
    const result = cssContent.replace(
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

    return result.trim();
  }

  let isCurrentClass = $derived(isCurrent ? 'current' : '');
  let compiledStyle = $derived(
    transformSassToCSS(settings?.editorCss, settings?.controllerSettings),
  );
</script>

<span
  class={isCurrentClass}
  style={compiledStyle}
  use:checkPosition={!isCurrent
    ? {
        registerOverflow: () => onOverflow(),
      }
    : null}
>
  {content}&nbsp;<wbr />
</span>

<style>
  span {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
    /* filter: blur(0);
    -webkit-filter: blur(0); */
  }
  .current {
    color: blue;
  }
</style>
