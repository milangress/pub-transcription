// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const serve = require('electron-serve');
const loadURL = serve({ directory: 'public' });
const os = require('node:os')


const fs= require("fs");
const { PvRecorder } = require("@picovoice/pvrecorder-node");
const { WaveFile } = require("wavefile");

// const whisper = require("whisper-node-anas23")


const Store = require('electron-store');
const PrintQueue = require('./src/print/PrintQueue');

const store = new Store();


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let printWindow = null;
let debuggerAttached = false;
let simulationInterval = null;
let printQueue;

function isDev() {
    return !app.isPackaged;
}

function createPrintWindow() {
    printWindow = new BrowserWindow({
        width: 450,
        height: 950,
        show: isDev(),
        webPreferences: {
            scrollBounce: true,
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    if (isDev()) {
        // printWindow.webContents.openDevTools();
    }

    if (isDev()) {
        printWindow.loadFile('public/print.html');
    } else {
        printWindow.loadFile(path.join(__dirname, 'public/print.html'));
    }

    // Initialize debugger
    debuggerAttached = false;

    // Add CDP handlers
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
                createPrintWindow();
            }
            return printWindow;
        });
    } else {
        // Update existing print queue with new window reference
        printQueue.setPrintWindow(printWindow);
    }
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 950,
        webPreferences: {
            titleBarStyle:{
                hiddenInset: true,
            },
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js'),
            // enableRemoteModule: true,
            // contextIsolation: false
        },
        icon: path.join(__dirname, 'public/favicon.png'),
        show: false,
        // titleBarStyle: 'hidden',
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
        debugger;
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

    // Emitted when the window is ready to be shown
    // This helps in showing the window gracefully.
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    });
    // mainWindow.webContents.openDevTools()
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

const devices = PvRecorder.getAvailableDevices();
for (let i = 0; i < devices.length; i++) {
    console.log(`index: ${i}, device name: ${devices[i]}`)
}

const frames = [];
async function handleAudio() {
    const recorder = new PvRecorder(512, 1);
    console.log(`Using PvRecorder version: ${recorder.version}`);
    recorder.start();
    console.log(recorder)


    while (recorder.isRecording) {
        // const frame = recorder.readSync(), for synchronous calls
        const frame = await recorder.read();
        frames.push(frame);
        if (frames.length > 200) {
            const wav = new WaveFile();
            const audioData = new Int16Array(recorder.frameLength * frames.length);
            for (let i = 0; i < frames.length; i++) {
                audioData.set(frames[i], i * recorder.frameLength);
            }
            wav.fromScratch(1, recorder.sampleRate, '16', audioData);
            fs.writeFileSync("test.wav", wav.toBuffer());
            console.log("Wrote test.wav");
            transcribeWav().then(r => console.log(r))
            frames.length = 0
        }
    }

    recorder.release();
}

async function transcribeWav() {
    let Whisper = await import('whisper-node-anas23')
    // console.log(Whisper)
    const filePath = "test.wav"

    const options = {
        modelName: "base.en",                   // default
        //modelPath: "/custom/path/to/model.bin", // use model in a custom directory
        whisperOptions: {
            gen_file_txt: false,      // outputs .txt file
            gen_file_subtitle: false, // outputs .srt file
            gen_file_vtt: false,      // outputs .vtt file
            //timestamp_size: 10,       // amount of dialogue per timestamp pair
            //word_timestamps: true     // timestamp for every word
        }
    }

    const transcript = await Whisper.whisper(filePath, options);
    console.log(transcript);

}
// handleAudio().then(r => console.log(r))



function spawnStreamProcess() {
    const {spawn} = require("child_process");

    const ls = spawn(path.join(__dirname, 'lib/stream'),
        [
            '--model', path.join(__dirname, 'models/ggml-small.en-q5_1.bin'),
            '-t', '8',
            '--step', '800',
            '--length', '5000',
            '--keep', '300',
            '--max-tokens', '64',
            '--save-audio',
            // '--keep-context',
            // '-vth', '0.6'
        ])
//-t 6 --step 0 --length 30000 -vth 0.6
    ls.stdout.on("data", data => {
        let string = new TextDecoder().decode(data);
        mainWindow.webContents.send('transcription-data', string)
    });

    ls.stderr.on("data", info => {
        console.log(`stderr: ${info}`);
        let string = new TextDecoder().decode(info);
        mainWindow.webContents.send('transcription-status', string)
    });

    ls.on('error', (error) => {
        console.log(`error: ${error.message}`);
        if(mainWindow){
            mainWindow.webContents.send('transcription-status', error.message)
        }
    });

    ls.on("close", code => {
        console.log(`child process exited with code ${code}`);
    });
}

function generateSimulatedTranscript() {
    const loremWords = [
        "Lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
        "Sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
        "magna", "aliqua", "Ut", "enim", "ad", "minim", "veniam", "quis", "nostrud",
        "exercitation", "ullamco", "laboris", "nisi", "ut", "aliquip", "ex", "ea",
        "commodo", "consequat"
    ];

    const dontSaveMessages = [
        '[ Silence ]', '[silence]', '[BLANK_AUDIO]', '[ [ [ [', '[ [ [', '[ [', '[',
        '(buzzer)', '(buzzing)', '.'
    ];

    function getRandomMessage() {
        // 20% chance for dontSave messages
        if (Math.random() < 0.2) {
            return dontSaveMessages[Math.floor(Math.random() * dontSaveMessages.length)];
        }

        // Generate a random sentence from lorem words
        const wordCount = Math.floor(Math.random() * 6) + 1;
        const sentence = [];
        for (let i = 0; i < wordCount; i++) {
            sentence.push(loremWords[Math.floor(Math.random() * loremWords.length)]);
        }
        return sentence.join(' ');
    }

    function simulateStream() {
        // Clear any existing interval
        if (simulationInterval) {
            clearInterval(simulationInterval);
            simulationInterval = null;
        }

        let baseTime = Date.now();

        simulationInterval = setInterval(() => {
            if (!mainWindow || mainWindow.isDestroyed()) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                return;
            }

            const currentTime = Date.now() - baseTime;
            const message = getRandomMessage();
            
            // Every 3-5 messages, send a NEW message
            if (Math.random() < 0.25) {
                mainWindow.webContents.send('transcription-data', `${message}NEW`);
            } else {
                mainWindow.webContents.send('transcription-data', message);
            }
        }, 800);

        // Clean up interval when window is closed or reloaded
        mainWindow.on('closed', () => {
            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
            }
        });
    }

    return simulateStream;
}

// Modify the existing setTimeout block to include simulation mode
setTimeout(() => {
    if (process.argv.includes('--simulate')) {
        console.log('Running in simulation mode');
        const simulateStream = generateSimulatedTranscript();
        simulateStream();
    } else {
        spawnStreamProcess();
    }
}, 3000);

// Add cleanup for app quit
app.on('before-quit', () => {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    if (printQueue) {
        printQueue.cleanup();
    }
});

