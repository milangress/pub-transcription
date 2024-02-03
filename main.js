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

const store = new Store();


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function isDev() {
    return !app.isPackaged;
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js'),
            // enableRemoteModule: true,
            // contextIsolation: false
        },
        icon: path.join(__dirname, 'public/favicon.png'),
        show: false,
        // titleBarStyle: 'hidden',
    });

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

    ipcMain.on('print', (event, printSettings) => {
        console.log('printSettings', printSettings)
        print(printSettings)
    })

    ipcMain.handle('getStoreValue', (event, key) => {
        return store.get(key);
    });

    ipcMain.handle('setStoreValue', (event, key, value) => {
        return store.set(key, value);
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
        console.log(`stdout: ${data}`);
        let string = new TextDecoder().decode(data);
        mainWindow.webContents.send('trans-data', string)
    });

    ls.stderr.on("data", info => {
        console.log(`stderr: ${info}`);
        let string = new TextDecoder().decode(info);
        mainWindow.webContents.send('trans-info', string)
    });

    ls.on('error', (error) => {
        console.log(`error: ${error.message}`);
        if(mainWindow){
            mainWindow.webContents.send('trans-info', error.message)
        }
    });

    ls.on("close", code => {
        console.log(`child process exited with code ${code}`);
    });
}
setTimeout(() => {
    spawnStreamProcess()
}, 3000)



function print(printSettingsFrontend = {}) {
    console.log('Trying To Print', printSettingsFrontend)
    const options = {
        margins: {
            marginType: 'custom',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        },
        // deviceName: 'Xerox_Phaser_5550N',
        pageSize: 'A3',
        scaleFactor: 100,
        printBackground: false,
        printSelectionOnly: false,
        landscape: false,
        silent: true,
        ...printSettingsFrontend
    }
    mainWindow.webContents.send('trans-info', '(っ◔◡◔)っ ♥🎀 we are trying to print 🎀♥')
    if (printSettingsFrontend.forcePrint === true) {
        try {
            mainWindow.webContents.print(options, (success, errorType) => {
                if (!success) {
                    console.log(errorType)
                    mainWindow.webContents.send('trans-info', '🥵 Printing failed')
                    mainWindow.webContents.send('trans-info', errorType)
                    mainWindow.webContents.send('print-success', false)
                } else {
                    mainWindow.webContents.send('trans-info', '🖨️ Printed successfully')
                    mainWindow.webContents.send('print-success', 'print')
                }
            })
        } catch (e) {
            console.error('PRINT FAILED', e)
            mainWindow.webContents.send('trans-info', `🥵 Printing failed: ${e}`)
        }
    } else {
        console.info('Printing is disabled. Set forcePrint to true to override this.')
        mainWindow.webContents.send('trans-info', `⚠️🔗 Printing is disabled. Set forcePrint to true to override this.`)
    }

    try {

        const dateString = new Date().toISOString().replace(/:/g, '-') + 'temp.pdf'
        const pdfPath = path.join(os.homedir(), 'Desktop', dateString)
        mainWindow.webContents.printToPDF(options).then(data => {
            fs.writeFile(pdfPath, data, (error) => {
                if (error) throw error
                console.log(`Wrote PDF successfully to ${pdfPath}`)
                mainWindow.webContents.send('trans-info', `💦 Wrote PDF successfully to ${pdfPath}`)
                mainWindow.webContents.send('print-success', 'pdf')
            })
        }).catch(error => {
            console.log(`Failed to write PDF to ${pdfPath}: `, error)
            mainWindow.webContents.send('trans-info', `🥵 Failed to write PDF to ${pdfPath}: ${JSON.stringify(error)}`)
            mainWindow.webContents.send('print-success', false)

        })

    } catch (e) {
        console.error('PDF FAILED', e)
        mainWindow.webContents.send('trans-info', `🥵 Failed to write PDF: ${JSON.stringify(e)}`)
    }
}
