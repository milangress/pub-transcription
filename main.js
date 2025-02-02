// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const serve = require('electron-serve');
const loadURL = serve({ directory: 'public' });
const fs = require("fs");

const Store = require('electron-store');
const PrintQueue = require('./electron/PrintQueue');
const { simulatedTranscriptController } = require('./electron/simulateTranscriptForDevTesting');
const { createStreamProcess } = require('./electron/streamProcess');
const { AudioRecorder } = require('./electron/audioRecorder');
const store = new Store();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let printWindow = null;
let debuggerAttached = false;
let simulationController = null;
let printQueue;
let audioRecorder = null;

function isDev() {
    return !app.isPackaged;
}

// Register print preview handler once at startup
ipcMain.handle('toggle-print-preview', async (event, enable) => {
    try {
        const webContents = event.sender;
        
        if (enable && !debuggerAttached) {
            await webContents.debugger.attach('1.3');
            debuggerAttached = true;
        }
        
        if (debuggerAttached) {
            await webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: enable ? 'print' : 'screen' });
            // Force a repaint to ensure changes take effect
            await webContents.invalidate();
            return true;
        }
        return false;
    } catch (error) {
        console.error('CDP error:', error);
        // If debugger is already attached, we can still try to set the media
        if (error.message.includes('Debugger is already attached')) {
            try {
                debuggerAttached = true;
                const webContents = event.sender;
                await webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: enable ? 'print' : 'screen' });
                await webContents.invalidate();
                return true;
            } catch (innerError) {
                console.error('CDP inner error:', innerError);
                return false;
            }
        }
        return false;
    }
});

function createPrintWindow() {
    if (printWindow && !printWindow.isDestroyed()) {
        return printWindow;
    }

    printWindow = new BrowserWindow({
        width: 450,
        height: 950,
        show: isDev(),
        webPreferences: {
            scrollBounce: true,
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'electron/preload.js')
        }
    });

    if (isDev()) {
        printWindow.loadFile('public/print.html');
    } else {
        printWindow.loadFile(path.join(__dirname, 'public/print.html'));
    }

    // Initialize debugger state for new window
    debuggerAttached = false;

    // Clean up debugger on window close
    printWindow.on('closed', () => {
        if (debuggerAttached) {
            try {
                printWindow.webContents.debugger.detach();
            } catch (error) {
                console.error('Failed to detach debugger:', error);
            }
            debuggerAttached = false;
        }
        printWindow = null;
        
        // Update print queue with new window reference
        if (printQueue) {
            printQueue.setPrintWindow(null);
        }
    });

    // Initialize print queue if it doesn't exist
    if (!printQueue) {
        printQueue = new PrintQueue(printWindow, () => {
            if (!printWindow) {
                return createPrintWindow();
            }
            return printWindow;
        });
    } else {
        // Update existing print queue with new window reference
        printQueue.setPrintWindow(printWindow);
    }

    return printWindow;
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 950,
        titleBarStyle: 'hidden',
        webPreferences: {
            titleBarStyle:{
                hiddenInset: true,
            },
            nodeIntegration: true,
            preload: path.join(__dirname, 'electron/preload.js'),
            // enableRemoteModule: true,
            // contextIsolation: false
        },
        icon: path.join(__dirname, 'public/favicon.png'),
        show: false,
    });

    if (isDev()) {
        createPrintWindow();
    }

    // This block of code is intended for development purpose only.
    // Delete this entire block of code when you are ready to package the application.
    if (isDev()) {
        mainWindow.loadURL('http://localhost:8080/');
    } else {
        loadURL(mainWindow);
    }

    // Uncomment the following line of code when app is ready to be packaged.
    // loadURL(mainWindow);

    // Open the DevTools and also disable Electron Security Warning.
    // process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = true;
    // mainWindow.webContents.openDevTools();

    ipcMain.on('print', async (event, { content, settings }) => {
        try {
            if (!printQueue) {
                printQueue = new PrintQueue(printWindow, createPrintWindow);
            }

            if (!content || typeof content !== 'string') {
                throw new Error('Invalid content format');
            }
            if (!settings || !settings.printId) {
                throw new Error('Print settings or ID missing');
            }

            console.log('📝 Print request received:', { 
                contentLength: content.length,
                settings: settings.printId,
            });

            await printQueue.add(content, settings);
            event.reply('print-queued', { success: true, printId: settings.printId });
        } catch (error) {
            console.error('Print queue error:', error);
            event.reply('print-queued', { success: false, error: error.message, printId: settings?.printId });
        }
    });

    ipcMain.handle('getStoreValue', (event, key) => {
        return store.get(key);
    });

    ipcMain.handle('setStoreValue', (event, key, value) => {
        return store.set(key, value);
    });

    ipcMain.handle('open-pdf-folder', async () => {
        const pdfDir = path.join(app.getPath('userData'), 'pdfs');
        // Create directory if it doesn't exist
        console.log(pdfDir)
        if (!fs.existsSync(pdfDir)) {
            await fs.promises.mkdir(pdfDir, { recursive: true });
        }
        // Open the folder in the system's file explorer
        require('electron').shell.openPath(pdfDir);
        return true;
    });

    // Add helper function to send messages to all windows
    function sendToAllWindows(channel, ...args) {
        [mainWindow, printWindow].forEach(window => {
            if (window && !window.isDestroyed()) {
                window.webContents.send(channel, ...args);
            }
        });
    }

    // Helper to create structured messages
    function createMessage(printId, action, status, details = {}) {
        return {
            id: printId,
            timestamp: Date.now(),
            action: action,      // 'PRINT_START', 'PRINT_COMPLETE', 'PDF_SAVE', etc.
            status: status,      // 'SUCCESS', 'ERROR', 'INFO'
            ...details
        };
    }

    // Modify the execute-print handler
    ipcMain.handle('execute-print', async (event, { content, settings = {} }) => {
        try {
            console.log('📝 Execute print request:', { 
                contentLength: content?.length,
                settings: settings.printId
            });

            if (!settings || !settings.printId) {
                throw new Error('Print ID is required');
            }

            const options = {
                margins: {
                    marginType: 'custom',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0
                },
                pageSize: 'A3',
                scaleFactor: 100,
                printBackground: false,
                printSelectionOnly: false,
                landscape: false,
                silent: true,
                ...settings,
                printId: settings.printId  // Ensure printId is explicitly set
            };

            sendToAllWindows('print-status', createMessage(
                settings.printId,
                'PRINT_START',
                'INFO',
                { message: '(っ◔◡◔)っ ♥🎀 we are trying to print 🎀♥' }
            ));

            // Handle direct printing
            if (settings?.forcePrint === true) {
                const printResult = await new Promise((resolve, reject) => {
                    printWindow.webContents.print(options, (success, errorType) => {
                        if (!success) {
                            sendToAllWindows('print-status', createMessage(
                                settings.printId,
                                'PRINT_COMPLETE',
                                'ERROR',
                                { 
                                    message: 'Printing failed',
                                    error: errorType
                                }
                            ));
                            reject(new Error(errorType));
                        } else {
                            sendToAllWindows('print-status', createMessage(
                                settings.printId,
                                'PRINT_COMPLETE',
                                'SUCCESS',
                                { message: '🖨️ Printed successfully' }
                            ));
                            resolve(true);
                        }
                    });
                });
            }

            // Handle PDF saving
            const dateString = new Date().toISOString().replace(/:/g, '-');
            const pdfDir = path.join(app.getPath('userData'), 'pdfs');
            
            // Create pdfs directory if it doesn't exist
            if (!fs.existsSync(pdfDir)) {
                await fs.promises.mkdir(pdfDir, { recursive: true });
            }
            
            const pdfPath = path.join(pdfDir, `transcript-${dateString}.pdf`);
            const pdfData = await printWindow.webContents.printToPDF(options);
            
            await fs.promises.writeFile(pdfPath, pdfData);
            console.log(`Wrote PDF successfully to ${pdfPath}`);
            sendToAllWindows('print-status', createMessage(
                settings.printId,
                'PDF_SAVE',
                'SUCCESS',
                { 
                    message: `💦 Wrote PDF successfully to ${pdfPath}`,
                    path: pdfPath
                }
            ));
            
            return true;
        } catch (error) {
            console.error('Print/PDF error:', error);
            sendToAllWindows('print-status', createMessage(
                settings.printId,
                'PRINT_ERROR',
                'ERROR',
                { 
                    message: `🥵 Error: ${error.message}`,
                    error: error.message
                }
            ));
            throw error;
        }
    });

    // Handle print status updates
    ipcMain.on('print-status', (event, status) => {
        if (!status.printId) {
            console.error('❌ Print status received without printId:', status);
            return;
        }
        
        // Send the status to all windows
        sendToAllWindows('print-status', createMessage(
            status.printId,
            status.success ? 'PRINT_COMPLETE' : 'PRINT_ERROR',
            status.success ? 'SUCCESS' : 'ERROR',
            { 
                message: status.error || (status.success ? '🖨️ Print completed' : '❌ Print failed'),
                error: status.error
            }
        ));
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    });

    // Wait for window to be ready and loaded
    let isWindowShown = false;
    let isContentLoaded = false;

    function checkAndStartProcesses() {
        if (isWindowShown && isContentLoaded) {
            startProcesses();
        }
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        isWindowShown = true;
        checkAndStartProcesses();
    });

    mainWindow.webContents.once('did-finish-load', () => {
        isContentLoaded = true;
        checkAndStartProcesses();
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    ipcMain.on('counter-value', (_event, value) => {
        console.log(value) // will print value to Node console
    })
    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    // if (process.platform !== 'darwin') app.quit()
    app.quit()
});

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) createWindow()
});
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Initialize audio devices
const initAudioDevices = () => {
    audioRecorder = new AudioRecorder();
    const devices = audioRecorder.getAvailableDevices();
    for (let i = 0; i < devices.length; i++) {
        console.log(`index: ${i}, device name: ${devices[i]}`);
    }
};
initAudioDevices();

// Function to start processes after window is ready
function startProcesses() {
    if (process.argv.includes('--simulate')) {
        console.log('Running in simulation mode');
        simulationController = simulatedTranscriptController(mainWindow);
        simulationController.start();
    } else {
        createStreamProcess(mainWindow, __dirname);
    }
}

// Add cleanup for app quit
app.on('before-quit', () => {
    if (simulationController) {
        simulationController.stop();
        simulationController = null;
    }
    if (audioRecorder) {
        audioRecorder.stop();
        audioRecorder = null;
    }
    if (printQueue) {
        printQueue.cleanup();
    }
});

