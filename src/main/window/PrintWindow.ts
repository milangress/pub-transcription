import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { BrowserWindow, app } from 'electron';
import { join } from 'path';
import type { PrintJob } from '../../types';
import type { IpcRendererEvent } from '../../types/ipc';
import { isDev } from '../utils/helper';

const emitter = new IpcEmitter<IpcRendererEvent>();

/**
 * Manages the print window instance, handling creation, recreation, and state
 */
export class PrintWindowManager {
  private printWindow: BrowserWindow | null = null;
  private debuggerAttached = false;

  /**
   * Creates a print window if one doesn't exist or returns the existing one
   */
  public getOrCreatePrintWindow(): BrowserWindow {
    if (this.printWindow && !this.printWindow.isDestroyed()) {
      return this.printWindow;
    }

    const options = {
      width: 450,
      height: 650,
      show: isDev() || app.isPackaged,
      webPreferences: {
        scrollBounce: false,
        nodeIntegration: true,
        contextIsolation: false,
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
      },
    };

    this.printWindow = new BrowserWindow(options);

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      this.printWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/debug.html`);
    } else {
      this.printWindow.loadFile(join(__dirname, '../renderer/debug.html'));
    }

    // Initialize debugger state for new window
    this.debuggerAttached = false;

    // Clean up debugger on window close
    this.printWindow.on('closed', () => {
      if (this.debuggerAttached && this.printWindow?.webContents) {
        try {
          this.printWindow.webContents.debugger.detach();
        } catch (error) {
          console.error('Failed to detach debugger:', error);
        }
        this.debuggerAttached = false;
      }
      this.printWindow = null;
    });

    return this.printWindow;
  }

  public async awaitWindowReady(): Promise<BrowserWindow> {
    const window = this.getOrCreatePrintWindow();
    if (!window || window.isDestroyed()) {
      throw new Error('Print window is not available');
    }

    if (window.webContents.isLoading()) {
      await new Promise<void>((resolve) => {
        const checkReady = setInterval(() => {
          if (!window.webContents.isLoading()) {
            clearInterval(checkReady);
            resolve();
          }
        }, 100);
      });
    }
    return this.enforcePrintWindow();
  }

  /**
   * Sends content to the print window for printing
   */
  public async sendJobToPrintWindow(printJob: PrintJob): Promise<void> {
    const printWindow = await this.awaitWindowReady();

    if (typeof printJob.pageContent.html !== 'string') {
      throw new Error('Print content must be a string');
    }

    if (!printJob.printId) {
      throw new Error('Print ID is required in settings');
    }

    console.log(`Sending job ${printJob.printId} to print window`);
    emitter.send(printWindow.webContents, 'PrintWindow:printJob', printJob);
  }

  /**
   * Gets current print window instance
   */
  public getPrintWindow(): BrowserWindow | null {
    return this.printWindow;
  }

  /**
   * Shows the print window
   */
  public showPrintWindow(): void {
    const window = this.getOrCreatePrintWindow();
    if (window && !window.isDestroyed()) {
      window.show();
    }
  }

  private enforcePrintWindow(): BrowserWindow {
    if (this.printWindow && !this.printWindow.isDestroyed()) {
      return this.printWindow;
    }
    throw new Error('Print window is not available');
  }
}

// Create a singleton instance
export const printWindowManager = new PrintWindowManager();
