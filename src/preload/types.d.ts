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

declare global {
  interface Window {
    electronAPI: {
      // Transcription-related channels
      onTranscriptionData: (callback: (event: Event, data: string) => void) => void
      onTranscriptionStatus: (callback: (event: Event, status: any) => void) => void

      // Print-related channels
      onPrintStatus: (callback: (event: Event, status: PrintStatusMessage) => void) => void
      onPrintQueued: (
        callback: (
          event: Event,
          data: { success: boolean; printId: string; error?: string }
        ) => void
      ) => void
      onPrintJob: (
        callback: (
          event: Event,
          data: PrintRequest & { attempt?: number; maxRetries?: number }
        ) => void
      ) => void
      onQueueStatus: (callback: (event: Event, status: QueueStatus) => void) => void

      // Print functions
      print: (content: string, settings: PrintSettings) => void
      executePrint: (content: string, settings: PrintSettings) => Promise<boolean>
      sendPrintStatus: (status: PrintStatusMessage) => void
      togglePrintPreview: (enable: boolean) => Promise<boolean>

      // Store functions
      getStoreValue: (key: string) => Promise<any>
      setStoreValue: (key: string, value: any) => Promise<void>

      // Other utilities
      openPDFFolder: () => Promise<void>
    }
  }
}
