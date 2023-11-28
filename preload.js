console.log('Hello from preload.js file!');
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    onTransData: (callback) => ipcRenderer.on('trans-data', callback),
    onTransInfo: (callback) => ipcRenderer.on('trans-info', callback),
    print: (printMessage) => ipcRenderer.send('print', printMessage)
})
