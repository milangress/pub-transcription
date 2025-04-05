import type {
  PrintSettings as ElectronPrintSettings,
  PrintRequest,
  PrintStatusMessage,
  QueueStatus
} from '@preload/types.d.ts'
import type { SvelteComponent } from 'svelte'

export interface FontFamily {
  name: string
}

export interface PrinterSettings {
  deviceName: string
  forcePrint: boolean
}

export interface BlockTxtSettings {
  inlineStyle: string
  controllerSettings: ControllerSetting[]
  svgFilters?: string
}

export interface ControllerSetting {
  name: string
  var: string
  value: number
  default: number
  step: number
  knobNR: number
  range: [number, number]
  keys?: string[]
}

export interface Settings {
  controllerSettings: ControllerSetting[]
  inlineStyle: string
  svgFilters: string
}

export interface TxtObject {
  type: typeof SvelteComponent
  content: string
  settings: BlockTxtSettings
  id: number
}

// Re-export electron types
export type {
  PrintRequest,
  ElectronPrintSettings as PrintSettings,
  PrintStatusMessage,
  QueueStatus
}
