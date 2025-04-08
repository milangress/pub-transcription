import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/main';
import { app, BrowserWindow } from 'electron';
import Store from 'electron-store';
import { EventEmitter } from 'events';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';

import type { PrintCompletionEvent, SettingsSnapshot } from '../../types';
import { printJobSchema } from '../../types/index';
import type { IpcEvents, IpcRendererEvent } from '../../types/ipc';
import { notificationManager } from '../print/NotificationManager';
import { printQueue } from '../print/PrintQueue';
import { notifyStatus } from '../print/setPrintStatus';
import { openPdfFolder } from '../utils/helper';
import { ipcLogger } from '../utils/logger';
import { printWindowManager } from '../window/PrintWindow';
import { deleteSnapshot, getSnapshots, loadSnapshot, saveSnapshot } from './snapshots';

const store = new Store();
const ipc = new IpcListener<IpcEvents>();
const emitter = new IpcEmitter<IpcRendererEvent>();
export const printEvents = new EventEmitter();

// Share the EventEmitter with the print queue
printQueue.setPrintEvents(printEvents);

// Default print options
const DEFAULT_PRINT_OPTIONS = {
  margins: {
    marginType: 'custom' as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  pageSize: 'A3' as const,
  printBackground: true,
  printSelectionOnly: false,
  landscape: false,
  silent: true,
  scaleFactor: 100,
};

export function setupIpcHandlers(): void {
  // Print request handler
  ipc.on('print', async (event, requestUnsave) => {
    try {
      const printJob = printJobSchema.parse(requestUnsave);

      ipcLogger.info('📝 Print request received:', printJob.printId);

      // Create notification for queued print job
      notificationManager.showNotification(printJob.printId, 'Print Job Queued', {
        body: `Your print job has been added to the queue.`,
        silent: true,
      });

      await printQueue.add(printJob);

      // Send queue notification immediately
      emitter.send(event.sender, 'print-queued', {
        success: true,
        printId: printJob.printId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const printId = requestUnsave?.printId ?? '000';
      ipcLogger.error('Print queue error:', errorMessage);

      notificationManager.showNotification(printId, 'Print Error', {
        body: `Error: ${errorMessage}`,
        silent: false,
      });

      emitter.send(event.sender, 'print-queued', {
        success: false,
        error: errorMessage,
        printId,
      });
    }
  });

  // Store value handlers
  ipc.handle('getStoreValue', (_event, key) => {
    return store.get(key);
  });

  ipc.handle('setStoreValue', (_event, key, value) => {
    return store.set(key, value);
  });

  // Settings snapshot handlers
  ipc.handle('save-settings-snapshot', async (_event, snapshot: SettingsSnapshot) => {
    return await saveSnapshot(snapshot);
  });

  ipc.handle('get-settings-snapshots', async () => {
    return await getSnapshots();
  });

  ipc.handle('load-settings-snapshot', async (_event, id: string) => {
    return await loadSnapshot(id);
  });

  ipc.handle('delete-settings-snapshot', async (_event, id: string) => {
    return await deleteSnapshot(id);
  });

  // Handle settings sync between windows
  ipc.on('editor:settings-updated', (_event, settings) => {
    ipcLogger.info('Settings updated from editor, syncing to other windows');
    // Broadcast to all windows
    BrowserWindow.getAllWindows().forEach((window) => {
      if (window.webContents.isDestroyed()) return;
      try {
        // Use webContents.send directly since emitter.sendTo doesn't exist
        window.webContents.send('settings-sync', settings);
      } catch (err) {
        ipcLogger.error('Error sending settings sync to window:', err);
      }
    });
  });

  // PDF folder handler
  ipc.handle('open-pdf-folder', async () => {
    return openPdfFolder();
  });

  // Print execution handler
  ipc.handle('PrintWindow:ReadyToBePrinted', async (_event, request) => {
    try {
      const printJob = printJobSchema.parse(request);
      // Get the print window from the manager
      const printWindow = printWindowManager.getOrCreatePrintWindow();

      ipcLogger.info('📝 Execute print request:', {
        contentLength: printJob.pageContent.html.length,
        printId: printJob.printId,
      });

      const printOptions = {
        ...DEFAULT_PRINT_OPTIONS,
        silent: printJob.do.print.silent ?? DEFAULT_PRINT_OPTIONS.silent,
      };

      const pdfOptions = {
        margins: printOptions.margins,
        pageSize: printOptions.pageSize,
        landscape: printOptions.landscape,
        printBackground: printOptions.printBackground,
      };

      notifyStatus.printStart(printJob.printId);

      // Handle direct printing
      if (printJob.do.print.yes === true) {
        await new Promise<void>((resolve, reject) => {
          ipcLogger.info('Printing...', printOptions);
          printWindow.webContents.print(printOptions, (success, errorType) => {
            if (!success) {
              ipcLogger.error('Printing failed', errorType);
              notifyStatus.printError(printJob.printId, errorType);
              reject(new Error(errorType));
            } else {
              ipcLogger.info('Printing completed');
              notifyStatus.printSuccess(printJob.printId);
              resolve();
            }
          });
        });
      }

      // Default to handle PDF saving
      if (printJob.do.pdfSave?.yes !== false) {
        const dateString = new Date().toISOString().replace(/:/g, '-');
        const pdfDir = join(app.getPath('userData'), 'pdfs');

        if (!existsSync(pdfDir)) {
          await fs.mkdir(pdfDir, { recursive: true });
        }

        const pdfPath = join(pdfDir, `transcript-${dateString}.pdf`);
        ipcLogger.debug('Printing to PDF...', pdfPath, pdfOptions);
        const pdfData = await printWindow.webContents.printToPDF(pdfOptions);

        if (pdfData) {
          await fs.writeFile(pdfPath, pdfData);
          ipcLogger.info(`Wrote PDF successfully to ${pdfPath}`);

          notifyStatus.pdfSuccess(printJob.printId, pdfPath);

          const notificationTitle = printJob.do.print.yes
            ? 'Print Job & PDF Completed'
            : 'PDF Generated Successfully';

          const notificationBody = printJob.do.print.yes
            ? `Print completed and PDF saved. Click to open.`
            : `PDF saved successfully. Click to open.`;

          notificationManager.showNotification(printJob.printId, notificationTitle, {
            body: notificationBody,
            silent: true,
            path: pdfPath,
          });
        }
      }

      // Emit completion event regardless
      printEvents.emit('INTERNAL-PrintQueueEvent:complete', {
        printId: printJob.printId,
        success: true,
      } as PrintCompletionEvent);

      return true;
    } catch (error) {
      ipcLogger.error('Print/PDF error:', error);
      const printId = request?.printId || '000';

      notifyStatus.printError(printId, error);

      // Emit error event for PrintQueue
      const completionEvent: PrintCompletionEvent = {
        printId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      printEvents.emit('INTERNAL-PrintQueueEvent:complete', completionEvent);

      throw error;
    }
  });
}
