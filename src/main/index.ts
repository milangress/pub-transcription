import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';

import { setupIpcHandlers } from './ipcHandlers';
import { PrintQueue } from './PrintQueue';
import { checkApplicationFolder } from './utils/applicationFolder';
import { AudioRecorder } from './utils/audioRecorder';
import { mainWindowManager } from './window/MainWindow';
import { printWindowManager } from './window/PrintWindow';

// Create event emitter for print events
const printEvents = new EventEmitter();

// Global references
let printQueue: PrintQueue | null = null;
let audioRecorder: AudioRecorder | null = null;

const isDev = (): boolean => !app.isPackaged;

// Initialize audio devices
const initAudioDevices = (): void => {
  audioRecorder = new AudioRecorder();
  const devices = audioRecorder.getAvailableDevices();
  for (let i = 0; i < devices.length; i++) {
    console.log(`index: ${i}, device name: ${devices[i]}`);
  }
};

// App initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  app.commandLine.appendSwitch('disable-renderer-backgrounding');

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Initialize print queue if it doesn't exist
  if (!printQueue) {
    printQueue = new PrintQueue(printEvents);
  }

  // Register IPC handlers
  setupIpcHandlers();

  // Pass printQueue to the main window manager
  mainWindowManager.setPrintQueue(printQueue, printEvents);

  // Create the main window
  mainWindowManager.getOrCreateMainWindow();

  // Create the print window
  printWindowManager.getOrCreatePrintWindow();

  // Check if we should move to Applications folder
  checkApplicationFolder(isDev);

  initAudioDevices();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindowManager.getOrCreateMainWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (audioRecorder) {
    audioRecorder.stop();
    audioRecorder = null;
  }
  if (printQueue) {
    printQueue.cleanup();
  }

  // Clean up the main window manager
  mainWindowManager.cleanup();
});
