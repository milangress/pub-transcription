import { BrowserWindow, app } from 'electron';
import { EventEmitter } from 'events';
import { join } from 'path';
import icon from '../../../resources/favicon.png?asset';
import { PrintQueue } from '../PrintQueue';
import { spawnWhisperStream } from '../services/WhisperStream';
import { isDev } from '../utils/helper';
import { simulatedTranscriptController } from '../utils/simulateTranscriptForDevTesting';
import { printWindowManager } from './PrintWindow';
/**
 * Manages the main window instance, handling creation, recreation, and state
 */
export class MainWindow {
  private mainWindow: BrowserWindow | null = null;
  private printQueue: PrintQueue | null = null;
  private printEvents: EventEmitter | null = null;
  private simulationController: ReturnType<typeof simulatedTranscriptController> | null = null;

  /**
   * Set the printQueue and events reference
   */
  public setPrintQueue(printQueue: PrintQueue, printEvents: EventEmitter): void {
    this.printQueue = printQueue;
    this.printEvents = printEvents;
  }

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

    // Window event handlers
    let isWindowShown = false;
    let isContentLoaded = false;

    const checkAndStartProcesses = (): void => {
      if (isWindowShown && isContentLoaded && this.mainWindow) {
        this.startProcesses();
      }
    };

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      isWindowShown = true;
      checkAndStartProcesses();
    });

    this.mainWindow.webContents.once('did-finish-load', () => {
      isContentLoaded = true;
      checkAndStartProcesses();
    });

    // Handle window closing
    this.mainWindow.on('closed', () => {
      // If there are active print jobs, show the print window
      if (this.printQueue?.hasActiveJobs()) {
        printWindowManager.showPrintWindow();
      }

      // Clean up stream process
      if (global.streamProcess) {
        global.streamProcess.kill();
        global.streamProcess = null;
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
   * Starts the processes needed for the application
   */
  private startProcesses(): void {
    if (!this.mainWindow) return;

    if (process.argv.includes('--simulate')) {
      console.log('Running in simulation mode');
      this.simulationController = simulatedTranscriptController(this.mainWindow);
      this.simulationController.start();
    } else {
      // Store the stream process in the global variable for access across the app
      global.streamProcess = spawnWhisperStream(this.mainWindow);
    }
  }

  /**
   * Cleans up resources when application is quitting
   */
  public cleanup(): void {
    if (this.simulationController) {
      this.simulationController.stop();
      this.simulationController = null;
    }

    // Clean up stream process
    if (global.streamProcess) {
      global.streamProcess.kill();
      global.streamProcess = null;
    }
  }
}

// Create a singleton instance
export const mainWindowManager = new MainWindow();
