console.log('Hello from preload.js file!');
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // Transcription-related channels
    /**
     * Listens for transcription data updates
     * @param {Function} callback - Handler for transcription data events
     */
    onTranscriptionData: (callback) => ipcRenderer.on('transcription-data', callback),

    /**
     * Listens for transcription status changes
     * @param {Function} callback - Handler for transcription status events
     */
    onTranscriptionStatus: (callback) => ipcRenderer.on('transcription-status', callback),
    
    // Print-related channels
    /**
     * Listens for print status updates
     * @param {Function} callback - Handler for print status events
     */
    onPrintStatus: (callback) => ipcRenderer.on('print-status', callback),

    /**
     * Listens for print jobs being queued
     * @param {Function} callback - Handler for print queue events
     */
    onPrintQueued: (callback) => ipcRenderer.on('print-queued', callback),

    /**
     * Listens for individual print job updates
     * @param {Function} callback - Handler for print job events
     */
    onPrintJob: (callback) => ipcRenderer.on('print-job', callback),

    /**
     * Listens for print queue status changes
     * @param {Function} callback - Handler for queue status events
     */
    onQueueStatus: (callback) => ipcRenderer.on('queue-status', callback),

    /**
     * Sends content to be printed
     * @param {Object} content - The content to print
     * @param {Object} settings - Print settings configuration
     */
    print: (content, settings) => ipcRenderer.send('print', { content, settings }),

    /**
     * Executes a print job and returns a promise
     * @param {Object} content - The content to print
     * @param {Object} settings - Print settings configuration
     */
    executePrint: (content, settings) => ipcRenderer.invoke('execute-print', { content, settings }),

    /**
     * Sends print status updates
     * @param {string} status - The current print status
     */
    sendPrintStatus: (status) => ipcRenderer.send('print-status', status),

    /**
     * Toggles print preview mode
     * @param {boolean} enable - Whether to enable or disable preview
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
    openPDFFolder: () => ipcRenderer.invoke('open-pdf-folder'),
});

