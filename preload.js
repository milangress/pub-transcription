console.log('Hello from preload.js file!');
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // Transcription-related channels
    onTranscriptionData: (callback) => ipcRenderer.on('transcription-data', callback),
    onTranscriptionStatus: (callback) => ipcRenderer.on('transcription-status', callback),
    
    // Print-related channels
    onPrintStatus: (callback) => ipcRenderer.on('print-status', callback),
    onPrintQueued: (callback) => ipcRenderer.on('print-queued', callback),
    onPrintJob: (callback) => ipcRenderer.on('print-job', callback),
    onQueueStatus: (callback) => ipcRenderer.on('queue-status', callback),
    print: (content, settings) => ipcRenderer.send('print', { content, settings }),
    executePrint: (content, settings) => ipcRenderer.invoke('execute-print', { content, settings }),
    sendPrintStatus: (status) => ipcRenderer.send('print-status', status),
    togglePrintPreview: (enable) => ipcRenderer.invoke('toggle-print-preview', enable),
    
    // Store-related functions
    getStoreValue: (key) => ipcRenderer.invoke('getStoreValue', key),
    setStoreValue: (key, value) => ipcRenderer.invoke('setStoreValue', key, value),
    
    // Other utilities
    openPdfFolder: () => ipcRenderer.invoke('open-pdf-folder'),
});


