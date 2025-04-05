import type { SvelteComponent } from 'svelte'

/**
 * Print action types
 */
export type PrintAction = 'PRINT_START' | 'PRINT_COMPLETE' | 'PDF_SAVE' | 'PRINT_ERROR'

/**
 * Print status types
 */
export type PrintStatus = 'SUCCESS' | 'ERROR' | 'INFO'

/**
 * Print margins configuration
 */
export interface PrintMargins {
  marginType: 'custom'
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * Base print settings interface
 */
export interface PrintSettings {
  printId: string
  deviceName?: string
  forcePrint?: boolean
  silent?: boolean
  printBackground?: boolean
  printSelectionOnly?: boolean
  landscape?: boolean
  pageSize?: string
  scaleFactor?: number
  margins?: PrintMargins
  inlineStyle?: string
  svgFiltersCode?: string
  svgFilters?: string
}

/**
 * Print status message interface
 */
export interface PrintStatusMessage {
  id: string
  timestamp: number
  action: PrintAction
  status: PrintStatus
  message?: string
  error?: string
  path?: string
  details?: Record<string, unknown>
}

/**
 * Print request payload interface
 */
export interface PrintRequest {
  content: string
  settings: PrintSettings
}

/**
 * Queue status update interface
 */
export interface QueueStatus {
  queueLength: number
  isProcessing: boolean
}

/**
 * Print job completion event interface
 */
export interface PrintCompletionEvent {
  printId: string
  success: boolean
  error?: string
}

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
