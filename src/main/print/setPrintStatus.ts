import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { app, BrowserWindow } from 'electron';
import type { PrintStatusMessage } from '../../types';
import type { IpcRendererEvent } from '../../types/ipc';
import { printLogger } from '../utils/logger';
import { notificationManager } from './NotificationManager';
import { createPrintStatusMessage, PRINT_ACTIONS, PRINT_STATUS } from './printStatusMessage';

class NotifyStatus {
  private emitter: IpcEmitter<IpcRendererEvent>;

  constructor() {
    this.emitter = new IpcEmitter<IpcRendererEvent>();
  }

  /**
   * Send a status message to all open windows
   */
  private sendToAllWindows(status: PrintStatusMessage): void {
    const allWindows = BrowserWindow.getAllWindows();
    const windows = [...allWindows].filter(Boolean);
    printLogger.info('Sending to windows', 'print-status', status.message);
    windows.forEach((window) => {
      if (window && !window.isDestroyed()) {
        this.emitter.send(window.webContents, 'print-status', status);
      } else {
        printLogger.warn('Window is not available', window);
      }
    });
  }

  /**
   * Notify that print has started
   */
  printStart(printId: string, message?: string): void {
    const status = createPrintStatusMessage(printId, PRINT_ACTIONS.PRINT_START, PRINT_STATUS.INFO, {
      message: message || '(っ◔◡◔)っ ♥🎀 we are trying to print 🎀♥',
    });
    this.sendToAllWindows(status);
  }

  /**
   * Notify that print has completed successfully
   */
  printSuccess(printId: string, message?: string): void {
    const status = createPrintStatusMessage(
      printId,
      PRINT_ACTIONS.PRINT_COMPLETE,
      PRINT_STATUS.SUCCESS,
      { message: message || '🖨️ Print completed' },
    );
    this.sendToAllWindows(status);

    // Update notification for print completion
    notificationManager.showNotification(printId, 'Print Completed', {
      body: '🖨️ Print job completed successfully',
      silent: true,
    });
  }

  /**
   * Notify that print has failed
   */
  printError(printId: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = createPrintStatusMessage(
      printId,
      PRINT_ACTIONS.PRINT_ERROR,
      PRINT_STATUS.ERROR,
      {
        message: `🥵 Error: ${errorMessage}`,
        error: errorMessage,
      },
    );
    this.sendToAllWindows(status);

    // Update notification for print failure
    notificationManager.showNotification(printId, 'Print Failed', {
      body: `Printing failed: ${errorMessage}`,
      silent: false,
    });
  }

  /**
   * Notify that PDF has been saved successfully
   */
  pdfSuccess(printId: string, pdfPath: string): void {
    const status = createPrintStatusMessage(printId, PRINT_ACTIONS.PDF_SAVE, PRINT_STATUS.SUCCESS, {
      message: `💦 Wrote PDF successfully to ${pdfPath}`,
      path: pdfPath,
    });
    this.sendToAllWindows(status);
    app.dock?.bounce();
  }
}

export const notifyStatus = new NotifyStatus();
