import { contextBridge, ipcRenderer } from 'electron';
import type { PrintRequest, PrintSettings, PrintStatusMessage, QueueStatus } from './types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Transcription-related channels
  onTranscriptionData: (callback: (event: Electron.IpcRendererEvent, data: string) => void) =>
    ipcRenderer.on('transcription-data', callback),

  onTranscriptionStatus: (callback: (event: Electron.IpcRendererEvent, status: unknown) => void) =>
    ipcRenderer.on('transcription-status', callback),

  // Print-related channels
  onPrintStatus: (
    callback: (event: Electron.IpcRendererEvent, status: PrintStatusMessage) => void
  ) => ipcRenderer.on('print-status', callback),

  onPrintQueued: (
    callback: (
      event: Electron.IpcRendererEvent,
      data: { success: boolean; printId: string; error?: string }
    ) => void
  ) => ipcRenderer.on('print-queued', callback),

  onPrintJob: (
    callback: (
      event: Electron.IpcRendererEvent,
      data: PrintRequest & { attempt?: number; maxRetries?: number }
    ) => void
  ) => ipcRenderer.on('print-job', callback),

  onQueueStatus: (callback: (event: Electron.IpcRendererEvent, status: QueueStatus) => void) =>
    ipcRenderer.on('queue-status', callback),

  // Print functions
  print: (content: string, settings: PrintSettings) =>
    ipcRenderer.send('print', { content, settings }),

  executePrint: (content: string, settings: PrintSettings): Promise<boolean> =>
    ipcRenderer.invoke('execute-print', { content, settings }),

  sendPrintStatus: (status: PrintStatusMessage) => ipcRenderer.send('print-status', status),

  togglePrintPreview: (enable: boolean): Promise<boolean> =>
    ipcRenderer.invoke('toggle-print-preview', enable),

  // Store functions
  getStoreValue: (key: string): Promise<unknown> => ipcRenderer.invoke('getStoreValue', key),

  setStoreValue: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('setStoreValue', key, value),

  // Other utilities
  openPDFFolder: (): Promise<void> => ipcRenderer.invoke('open-pdf-folder')
})
