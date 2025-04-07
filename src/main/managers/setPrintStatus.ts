import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { BrowserWindow } from 'electron';
import type { PrintStatusMessage } from '../../types';
import type { IpcRendererEvent } from '../../types/ipc';
import { createPrintStatusMessage, PRINT_ACTIONS, PRINT_STATUS } from '../printMessages';
import { notificationManager } from './NotificationManager';

export function notifyStatus(): {
  printStart: (printId: string, message?: string) => void;
  printSuccess: (printId: string, message?: string) => void;
  printError: (printId: string, error: unknown) => void;
  pdfSuccess: (printId: string, pdfPath: string) => void;
} {
  const emitter = new IpcEmitter<IpcRendererEvent>();

  /**
   * Send a status message to all open windows
   */
  function sendToAllWindows(status: PrintStatusMessage): void {
    const allWindows = BrowserWindow.getAllWindows();
    const windows = [...allWindows].filter(Boolean);

    windows.forEach((window) => {
      console.log('Sending to window', 'print-status', status);
      if (window && !window.isDestroyed()) {
        emitter.send(window.webContents, 'print-status', status);
      } else {
        console.log('Window is not available', window);
      }
    });
  }

  /**
   * Notify that print has started
   */
  function printStart(printId: string, message?: string): void {
    const status = createPrintStatusMessage(printId, PRINT_ACTIONS.PRINT_START, PRINT_STATUS.INFO, {
      message: message || '(っ◔◡◔)っ ♥🎀 we are trying to print 🎀♥',
    });
    sendToAllWindows(status);
  }

  /**
   * Notify that print has completed successfully
   */
  function printSuccess(printId: string, message?: string): void {
    const status = createPrintStatusMessage(
      printId,
      PRINT_ACTIONS.PRINT_COMPLETE,
      PRINT_STATUS.SUCCESS,
      { message: message || '🖨️ Print completed' },
    );
    sendToAllWindows(status);

    // Update notification for print completion
    notificationManager.showNotification(printId, 'Print Completed', {
      body: '🖨️ Print job completed successfully',
      silent: true,
    });
  }

  /**
   * Notify that print has failed
   */
  function printError(printId: string, error: unknown): void {
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
    sendToAllWindows(status);

    // Update notification for print failure
    notificationManager.showNotification(printId, 'Print Failed', {
      body: `Printing failed: ${errorMessage}`,
      silent: false,
    });
  }

  /**
   * Notify that PDF has been saved successfully
   */
  function pdfSuccess(printId: string, pdfPath: string): void {
    const status = createPrintStatusMessage(printId, PRINT_ACTIONS.PDF_SAVE, PRINT_STATUS.SUCCESS, {
      message: `💦 Wrote PDF successfully to ${pdfPath}`,
      path: pdfPath,
    });
    sendToAllWindows(status);
  }

  return {
    printStart,
    printSuccess,
    printError,
    pdfSuccess,
  };
}
