console.log('Hello from preload.js file!')
// @ts-check
const { contextBridge, ipcRenderer } = require('electron')

/** @type {import('./types').PrintSettings} */
const defaultPrintSettings = {
  printId: '',
  silent: true,
  printBackground: true,
  printSelectionOnly: false,
  landscape: false,
  pageSize: 'A3',
  margins: {
    marginType: 'custom',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Transcription-related channels
  /**
   * Listens for transcription data updates
   * @param {(event: Electron.IpcRendererEvent, data: any) => void} callback - Handler for transcription data events
   */
  onTranscriptionData: (callback) => ipcRenderer.on('transcription-data', callback),

  /**
   * Listens for transcription status changes
   * @param {(event: Electron.IpcRendererEvent, status: any) => void} callback - Handler for transcription status events
   */
  onTranscriptionStatus: (callback) => ipcRenderer.on('transcription-status', callback),

  // Print-related channels
  /**
   * Listens for print status updates
   * @param {(event: Electron.IpcRendererEvent, status: import('./types').PrintStatusMessage) => void} callback - Handler for print status events
   */
  onPrintStatus: (callback) => ipcRenderer.on('print-status', callback),

  /**
   * Listens for print jobs being queued
   * @param {(event: Electron.IpcRendererEvent, data: { success: boolean, printId: string, error?: string }) => void} callback - Handler for print queue events
   */
  onPrintQueued: (callback) => ipcRenderer.on('print-queued', callback),

  /**
   * Listens for individual print job updates
   * @param {(event: Electron.IpcRendererEvent, data: import('./types').PrintRequest & { attempt?: number; maxRetries?: number }) => void} callback - Handler for print job events
   */
  onPrintJob: (callback) => ipcRenderer.on('print-job', callback),

  /**
   * Listens for print queue status changes
   * @param {(event: Electron.IpcRendererEvent, status: import('./types').QueueStatus) => void} callback - Handler for queue status events
   */
  onQueueStatus: (callback) => ipcRenderer.on('queue-status', callback),

  /**
   * Sends content to be printed
   * @param {string} content - The content to print
   * @param {import('./types').PrintSettings} settings - Print settings configuration
   */
  print: (content, settings) => ipcRenderer.send('print', { content, settings }),

  /**
   * Executes a print job and returns a promise
   * @param {string} content - The content to print
   * @param {import('./types').PrintSettings} settings - Print settings configuration
   * @returns {Promise<boolean>}
   */
  executePrint: (content, settings) => ipcRenderer.invoke('execute-print', { content, settings }),

  /**
   * Sends print status updates
   * @param {import('./types').PrintStatusMessage} status - The print status object
   */
  sendPrintStatus: (status) => ipcRenderer.send('print-status', status),

  /**
   * Toggles print preview mode
   * @param {boolean} enable - Whether to enable or disable preview
   * @returns {Promise<boolean>}
   */
  togglePrintPreview: (enable) => ipcRenderer.invoke('toggle-print-preview', enable),

  // Store-related functions
  /**
   * Retrieves a value from the store
   * @param {string} key - The key to retrieve
   */
  getStoreValue: (key) => ipcRenderer.invoke('getStoreValue', key),

  /**
   * Sets a value in the store
   * @param {string} key - The key to set
   * @param {*} value - The value to store
   */
  setStoreValue: (key, value) => ipcRenderer.invoke('setStoreValue', key, value),

  // Other utilities
  /**
   * Opens the PDF output folder
   */
  openPDFFolder: () => ipcRenderer.invoke('open-pdf-folder')
})
