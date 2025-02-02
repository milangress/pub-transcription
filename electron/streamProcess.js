const { spawn } = require('child_process');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');


/**
 * Creates and manages a child process for real-time audio stream transcription.
 * 
 * @param {BrowserWindow} mainWindow - The Electron main window instance to send transcription events
 * @param {string} baseDir - Base directory path for locating the stream executable and model files
 * @returns {ChildProcess} The spawned child process instance
 * 
 * The process handles:
 * - Spawning the stream executable with model and configuration parameters
 * - Streaming transcription data back to the main window
 * - Error handling and status updates
 * - Process lifecycle management
 */

function createStreamProcess(mainWindow, baseDir) {
    // Create audio directory in userData if it doesn't exist
    const audioDir = path.join(app.getPath('userData'), 'audio');
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    }

    // Change working directory to audioDir before spawning process
    const options = {
        cwd: audioDir
    };

    console.log(`Audio directory: '${audioDir}'`);

    const streamPath = path.join(baseDir, 'lib/stream');

    console.log(`Stream path: '${streamPath}'`);

    const ls = spawn(streamPath,
        [
            '--model', path.join(baseDir, 'models/ggml-small.en-q5_1.bin'),
            '-t', '8',
            '--step', '800',
            '--length', '5000',
            '--keep', '300',
            '--max-tokens', '64',
            '--save-audio',
        ], options);

    ls.stdout.on("data", data => {
        let string = new TextDecoder().decode(data);
        mainWindow.webContents.send('transcription-data', string);
    });

    ls.stderr.on("data", info => {
        console.log(`stderr: ${info}`);
        let string = new TextDecoder().decode(info);
        mainWindow.webContents.send('transcription-status', string);
    });

    ls.on('error', (error) => {
        console.log(`error: ${error.message}`);
        if(mainWindow) {
            mainWindow.webContents.send('transcription-status', error.message);
        }
    });

    ls.on("close", code => {
        console.log(`child process exited with code ${code}`);
    });

    return ls;
}

module.exports = {
    createStreamProcess
}; 