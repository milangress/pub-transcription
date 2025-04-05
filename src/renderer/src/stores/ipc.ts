import { readable, type Readable } from 'svelte/store'
import type { PrintRequest, PrintSettings, PrintStatusMessage, QueueStatus } from '../../../types'

export class IPCStore {
  transcriptionData = $state('')
  transcriptionStatus = $state<unknown>(null)
  printStatus = $state<PrintStatusMessage | null>(null)
  queueStatus = $state<QueueStatus | null>(null)

  constructor() {
    this.initializeListeners()
  }

  private initializeListeners(): void {
    // Transcription listeners
    window.electron.ipcRenderer.on('transcription-data', (_, data: string) => {
      this.transcriptionData = data
    })

    window.electron.ipcRenderer.on('transcription-status', (_, status: unknown) => {
      this.transcriptionStatus = status
    })

    // Print listeners
    window.electron.ipcRenderer.on('print-status', (_, status: PrintStatusMessage) => {
      this.printStatus = status
    })

    window.electron.ipcRenderer.on('queue-status', (_, status: QueueStatus) => {
      this.queueStatus = status
    })

    window.electron.ipcRenderer.on(
      'print-queued',
      (_, data: { success: boolean; printId: string; error?: string }) => {
        if (!data.success) {
          console.error('Print queued failed:', data.error)
        }
      }
    )

    window.electron.ipcRenderer.on(
      'print-job',
      (_, data: PrintRequest & { attempt?: number; maxRetries?: number }) => {
        console.log('Print job update:', data)
      }
    )
  }

  async print(content: string, settings: PrintSettings): Promise<void> {
    window.electron.ipcRenderer.send('print', { content, settings })
  }

  async executePrint(content: string, settings: PrintSettings): Promise<boolean> {
    return await window.electron.ipcRenderer.invoke('execute-print', { content, settings })
  }

  async sendPrintStatus(status: PrintStatusMessage): Promise<void> {
    window.electron.ipcRenderer.send('print-status', status)
  }

  async togglePrintPreview(enable: boolean): Promise<boolean> {
    return await window.electron.ipcRenderer.invoke('toggle-print-preview', enable)
  }

  async getStoreValue<T>(key: string): Promise<T> {
    return await window.electron.ipcRenderer.invoke('getStoreValue', key)
  }

  async setStoreValue<T>(key: string, value: T): Promise<void> {
    await window.electron.ipcRenderer.invoke('setStoreValue', key, value)
  }

  async openPDFFolder(): Promise<void> {
    await window.electron.ipcRenderer.invoke('open-pdf-folder')
  }
}

// Export a singleton instance
export const ipc = new IPCStore()

// Readable stores for external components
export const transcriptionData: Readable<string> = readable(ipc.transcriptionData)
export const transcriptionStatus: Readable<unknown> = readable(ipc.transcriptionStatus)
export const printStatus: Readable<PrintStatusMessage | null> = readable(ipc.printStatus)
export const queueStatus: Readable<QueueStatus | null> = readable(ipc.queueStatus)
