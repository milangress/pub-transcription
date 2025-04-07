/**
 * Print action types
 */
export type PrintAction = 'PRINT_START' | 'PRINT_COMPLETE' | 'PDF_SAVE' | 'PRINT_ERROR'

/**
 * Print status types
 */
export type PrintStatus = 'SUCCESS' | 'ERROR' | 'INFO'

/**
 * Base print settings interface
 */
export interface PrintSettings {
  printId: string
  pageNumber: number
  deviceName?: string
  forcePrint: boolean
  silent?: boolean
  inlineStyle: string
  svgFilters: string
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

export interface PrintJob extends PrintRequest {
  attempt: number
  maxRetries: number
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

/**
 * Settings snapshot interface
 */
export interface SettingsSnapshot {
  id: string
  name: string
  timestamp: number
  inlineStyle: string
  svgFilters: string
  controllerValues: Record<string, number>
}

/**
 * Settings snapshot list response interface
 */
export interface SettingsSnapshotListResponse {
  snapshots: SettingsSnapshot[]
  success: boolean
  error?: string
}
