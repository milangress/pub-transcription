import type { SvelteComponent } from 'svelte';

export interface FontFamily {
  name: string;
}

export interface ControllerSetting {
  name: string;
  var: string;
  value: number;
  default: number;
  step: number;
  knobNum: number;
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
  editorCss: string;
  controllerValues: Record<string, number>;
  id: number;
}
