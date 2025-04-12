import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow } from 'electron';

import { setupEditorIPC } from './ipc/editor';
import { createMenu } from './menu';
import { printQueue } from './print/PrintQueue';
import { setupIpcHandlers } from './services/ipcHandlers';
import { createSession } from './services/SessionManager';
import { spawnWhisperStream, stopStreamProcess } from './services/WhisperStream';
import { checkApplicationFolder } from './utils/applicationFolder';
import { mainWindowManager } from './window/MainWindow';
import { printWindowManager } from './window/PrintWindow';

const isDev = (): boolean => !app.isPackaged;

// App initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  app.commandLine.appendSwitch('disable-renderer-backgrounding');

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Register IPC handlers
  setupIpcHandlers();

  // Initialize menu
  createMenu();

  // Setup IPC handlers
  setupEditorIPC();

  // Create the main window
  const mainWindow = mainWindowManager.getOrCreateMainWindow();

  // Create the print window
  printWindowManager.getOrCreatePrintWindow();

  // Check if we should move to Applications folder
  checkApplicationFolder(isDev);

  // Create a new session for this recording
  createSession()
    .then((session) => {
      console.log(`Created new recording session: ${session.name}`);

      // Start WhisperStream (it will handle simulation mode internally)
      global.streamProcess = spawnWhisperStream(mainWindow);
    })
    .catch((error) => {
      console.error('Failed to create session:', error);

      // Still start WhisperStream
      global.streamProcess = spawnWhisperStream(mainWindow);
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindowManager.getOrCreateMainWindow();
    }
  });
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
  // Stop the stream process when all windows are closed
  stopStreamProcess();
  app.quit();
});

// Cleanup on app quit
app.on('before-quit', () => {
  // Stop the stream process
  stopStreamProcess();

  // Clean up the print queue
  printQueue.cleanup();

  // Clean up the main window manager
  mainWindowManager.cleanup();
});
