import type { SvelteComponent } from 'svelte';

export interface FontFamily {
  name: string;
}

export interface BlockTxtSettings {
  editorCss: string;
  controllerSettings: ControllerSetting[];
  svgFilters?: string;
}

export interface ControllerSetting {
  name: string;
  var: string;
  value: number;
  default: number;
  step: number;
  knobNR: number;
  range: [number, number];
  keys?: string[];
}

export interface Settings {
  controllerSettings: ControllerSetting[];
  editorCss: string;
  svgFilters: string;
}

export interface TxtObject {
  type: typeof SvelteComponent;
  content: string;
  settings: BlockTxtSettings;
  id: number;
}
