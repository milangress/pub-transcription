import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow } from 'electron';

import { setupEditorIPC } from './ipc/editor';
import { createMenu } from './menu';
import { printQueue } from './print/PrintQueue';
import { setupIpcHandlers } from './services/ipcHandlers';
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
  mainWindowManager.getOrCreateMainWindow();

  // Create the print window
  printWindowManager.getOrCreatePrintWindow();

  // Check if we should move to Applications folder
  checkApplicationFolder(isDev);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindowManager.getOrCreateMainWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  printQueue.cleanup();

  // Clean up the main window manager
  mainWindowManager.cleanup();
});
