import type { PrintRequest, PrintStatusMessage, QueueStatus } from './index';

// Main process ipc events (from renderer to main)
export type IpcEvents =
  | {
      // Print related events
      print: [request: PrintRequest]
      'print-status': [status: { printId: string; success: boolean; error?: string }]
    }
  | {
      // Store related events
      getStoreValue: (key: string) => unknown
      setStoreValue: (key: string, value: unknown) => void
      'open-pdf-folder': () => Promise<boolean>
      'execute-print': (request: PrintRequest) => Promise<boolean>
    }

// Renderer ipc events (from main to renderer)
export type IpcRendererEvent = {
  // Print related events
  'print-status': [status: PrintStatusMessage]
  'print-queued': [response: { success: boolean; printId: string; error?: string }]
  'queue-status': [status: QueueStatus]
  'print-job': [job: { content: string; settings: unknown }]

  // Transcription related events
  'transcription-data': [data: string]
  'transcription-status': [status: string]
}
