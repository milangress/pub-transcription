import type { PrintJob, PrintRequest, PrintStatusMessage, QueueStatus, SettingsSnapshot, SettingsSnapshotListResponse } from './index';

// Main process ipc events (from renderer to main)
export type IpcEvents =
  | {
      // listener event map
      print: [request: PrintRequest]
      'print-status': [status: { printId: string; success: boolean; error?: string }]
    }
  | {
      // handler event map
      getStoreValue: (key: string) => unknown
      setStoreValue: (key: string, value: unknown) => void
      'open-pdf-folder': () => Promise<boolean>
      'execute-print': (request: PrintRequest) => Promise<boolean>
      // Settings snapshot handlers
      'save-settings-snapshot': (snapshot: SettingsSnapshot) => Promise<SettingsSnapshot>
      'get-settings-snapshots': () => Promise<SettingsSnapshotListResponse>
      'load-settings-snapshot': (id: string) => Promise<SettingsSnapshot | null>
      'delete-settings-snapshot': (id: string) => Promise<boolean>
    }

// Renderer ipc events (from main to renderer)
export type IpcRendererEvent = {
  // Print related events
  'print-status': [status: PrintStatusMessage]
  'print-queued': [response: { success: boolean; printId: string; error?: string }]
  'queue-status': [status: QueueStatus]
  'PrintWindow:printJob': [job: PrintJob]

  // Transcription related events
  'whisper-ccp-stream:transcription': [data: string]
  'whisper-ccp-stream:status': [status: string]
}
