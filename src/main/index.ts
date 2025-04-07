import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { join } from 'path';
import icon from '../../resources/favicon.png?asset';

import { AudioRecorder } from './audioRecorder';
import { simulatedTranscriptController } from './dev/simulateTranscriptForDevTesting';
import { setupIpcHandlers } from './ipcHandlers';
import { PrintQueue } from './PrintQueue';
import { createStreamProcess } from './streamProcess';
import { checkApplicationFolder } from './utils/applicationFolder';
import { printWindowManager } from './windows/PrintWindow';

// Create event emitter for print events
const printEvents = new EventEmitter();

// Global references
let mainWindow: BrowserWindow | null = null;
let simulationController: ReturnType<typeof simulatedTranscriptController> | null = null;
let printQueue: PrintQueue | null = null;
let audioRecorder: AudioRecorder | null = null;

const isDev = (): boolean => !app.isPackaged;

function createWindow(): void {
  // Create the browser window.
  const options = {
    width: 1200,
    height: 950,
    webPreferences: {
      titleBarStyle: {
        hiddenInset: true,
      },
      nodeIntegration: true,
      preload: join(__dirname, '../preload/index.js'),
    },
    icon,
    show: false,
  };

  mainWindow = new BrowserWindow(options);

  if (isDev()) {
    printWindowManager.getOrCreatePrintWindow();
    mainWindow.webContents.openDevTools();
  } else {
    printWindowManager.getOrCreatePrintWindow();
  }

  // Load the app
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Initialize print queue if it doesn't exist
  if (!printQueue) {
    printQueue = new PrintQueue(printEvents);
  }

  // Register IPC handlers
  setupIpcHandlers();

  // Window event handlers
  let isWindowShown = false;
  let isContentLoaded = false;

  function checkAndStartProcesses(): void {
    if (isWindowShown && isContentLoaded && mainWindow) {
      startProcesses();
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    isWindowShown = true;
    checkAndStartProcesses();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    isContentLoaded = true;
    checkAndStartProcesses();
  });

  // Handle window closing
  mainWindow.on('closed', () => {
    // If there are active print jobs, show the print window
    if (printQueue?.hasActiveJobs()) {
      printWindowManager.showPrintWindow();
    }

    // Clean up stream process
    if (global.streamProcess) {
      global.streamProcess.kill();
      global.streamProcess = null;
    }

    mainWindow = null;
  });
}

// Initialize audio devices
const initAudioDevices = (): void => {
  audioRecorder = new AudioRecorder();
  const devices = audioRecorder.getAvailableDevices();
  for (let i = 0; i < devices.length; i++) {
    console.log(`index: ${i}, device name: ${devices[i]}`);
  }
};

// Function to start processes after window is ready
function startProcesses(): void {
  if (!mainWindow) return;

  if (process.argv.includes('--simulate')) {
    console.log('Running in simulation mode');
    simulationController = simulatedTranscriptController(mainWindow);
    simulationController.start();
  } else {
    createStreamProcess(mainWindow);
  }
}

// App initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  app.commandLine.appendSwitch('disable-renderer-backgrounding');

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  // Check if we should move to Applications folder
  checkApplicationFolder(isDev);

  initAudioDevices();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});

// Cleanup on app quit
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
