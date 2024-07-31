console.log('Hello from preload.js file!');
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    onTransData: (callback) => ipcRenderer.on('trans-data', callback),
    onTransInfo: (callback) => ipcRenderer.on('trans-info', callback),
    printSuccess: (callback) => ipcRenderer.on('print-success', callback),
    getStoreValue: (key) => ipcRenderer.invoke('getStoreValue', key),
    setStoreValue: (key, value) => ipcRenderer.invoke('setStoreValue', key, value),
    print: (data) => ipcRenderer.send('print', data),
    openPDFFolder: () => ipcRenderer.invoke('open-pdf-folder'),
    onPrintJob: (callback) => ipcRenderer.on('print-job', callback),
    executePrint: (data) => ipcRenderer.invoke('execute-print', data),
    sendPrintStatus: (status) => ipcRenderer.send('print-status', status)
})


