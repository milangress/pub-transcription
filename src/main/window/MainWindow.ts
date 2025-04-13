import { BrowserWindow, app } from 'electron';
import { join } from 'path';
import icon from '../../../resources/favicon.png?asset';
import { printQueue } from '../print/PrintQueue';
import { isDev } from '../utils/helper';
import { windowLogger } from '../utils/logger';
import { printWindowManager } from './PrintWindow';

/**
 * Manages the main window instance, handling creation, recreation, and state
 */
export class MainWindow {
  private mainWindow: BrowserWindow | null = null;

  /**
   * Creates a main window if one doesn't exist or returns the existing one
   */
  public getOrCreateMainWindow(): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    const options = {
      width: 1200,
      height: 950,
      titleBarStyle: 'hidden',
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

    this.mainWindow = new BrowserWindow(options);

    if (isDev()) {
      this.mainWindow.webContents.openDevTools();
    }

    // Load the app
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    this.mainWindow.webContents.once('did-finish-load', () => {
      windowLogger.info('Main window did-finish-load');
    });

    // Handle window closing
    this.mainWindow.on('closed', () => {
      // If there are active print jobs, show the print window
      if (printQueue.hasActiveJobs()) {
        printWindowManager.showPrintWindow();
      }

      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  /**
   * Gets current main window instance
   */
  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Shows the main window
   */
  public showMainWindow(): void {
    const window = this.getOrCreateMainWindow();
    if (window && !window.isDestroyed()) {
      window.show();
    }
  }

  /**
   * Cleans up resources when application is quitting
   */
  public cleanup(): void {
    // Clean up any resources if needed
  }
}

// Create a singleton instance
export const mainWindowManager = new MainWindow();
