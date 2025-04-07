import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/main';
import { app, shell } from 'electron';
import Store from 'electron-store';
import { EventEmitter } from 'events';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';

import type { PrintCompletionEvent, SettingsSnapshot } from '../types';
import type { IpcEvents, IpcRendererEvent } from '../types/ipc';
import { PrintQueue } from './PrintQueue';
import { notificationManager } from './render/NotificationManager';
import { notifyStatus } from './render/setPrintStatus';
import { deleteSnapshot, getSnapshots, loadSnapshot, saveSnapshot } from './utils/snapshotManager';
import { printWindowManager } from './windows/PrintWindow';

const store = new Store();
const ipc = new IpcListener<IpcEvents>();
const emitter = new IpcEmitter<IpcRendererEvent>();
const printEvents = new EventEmitter();

let printQueue: PrintQueue | null = null;

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
  ipc.on('print', async (event, request) => {
    try {
      if (!printQueue) {
        printQueue = new PrintQueue(printEvents);
      }

      if (!request.content || typeof request.content !== 'string') {
        throw new Error('Invalid content format');
      }
      if (!request.settings || !request.settings.printId) {
        throw new Error('Print settings or ID missing');
      }

      console.log('📝 Print request received:', {
        contentLength: request.content.length,
        PrintId: request.settings.printId,
      });

      // Create notification for queued print job
      notificationManager.showNotification(request.settings.printId, 'Print Job Queued', {
        body: `Your print job has been added to the queue.`,
        silent: true,
      });

      await printQueue.add(request.content, request.settings);

      // Send queue notification immediately
      emitter.send(event.sender, 'print-queued', {
        success: true,
        printId: request.settings.printId,
      });
    } catch (error) {
      console.error('Print queue error:', error);

      // Show error notification
      if (request.settings?.printId) {
        notificationManager.showNotification(request.settings.printId, 'Print Error', {
          body: `Error: ${error instanceof Error ? error.message : String(error)}`,
          silent: false,
        });
      }

      emitter.send(event.sender, 'print-queued', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        printId: request.settings?.printId,
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
    try {
      return await saveSnapshot(snapshot);
    } catch (error) {
      console.error('Error in save-settings-snapshot handler:', error);
      throw error;
    }
  });

  ipc.handle('get-settings-snapshots', async () => {
    try {
      return await getSnapshots();
    } catch (error) {
      console.error('Error in get-settings-snapshots handler:', error);
      return {
        snapshots: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipc.handle('load-settings-snapshot', async (_event, id: string) => {
    try {
      return await loadSnapshot(id);
    } catch (error) {
      console.error(`Error in load-settings-snapshot handler for ID ${id}:`, error);
      throw error;
    }
  });

  ipc.handle('delete-settings-snapshot', async (_event, id: string) => {
    try {
      return await deleteSnapshot(id);
    } catch (error) {
      console.error(`Error in delete-settings-snapshot handler for ID ${id}:`, error);
      return false;
    }
  });

  // PDF folder handler
  ipc.handle('open-pdf-folder', async () => {
    const pdfDir = join(app.getPath('userData'), 'pdfs');
    if (!existsSync(pdfDir)) {
      await fs.mkdir(pdfDir, { recursive: true });
    }
    await shell.openPath(pdfDir);
    return true;
  });

  // Print execution handler
  ipc.handle('PrintWindow:ReadyToBePrinted', async (_event, request) => {
    try {
      // Get the print window from the manager
      const printWindow = printWindowManager.getOrCreatePrintWindow();

      console.log('📝 Execute print request:', {
        contentLength: request.content.length,
        printId: request.settings.printId,
      });

      if (!request.settings || !request.settings.printId) {
        throw new Error('Print ID is required');
      }

      const printOptions = {
        ...DEFAULT_PRINT_OPTIONS,
        silent: request.settings.silent ?? DEFAULT_PRINT_OPTIONS.silent,
      };

      const pdfOptions = {
        margins: printOptions.margins,
        pageSize: printOptions.pageSize,
        landscape: printOptions.landscape,
        printBackground: printOptions.printBackground,
      };

      notifyStatus.printStart(request.settings.printId);

      // Handle direct printing
      if (request.settings.forcePrint === true) {
        await new Promise<void>((resolve, reject) => {
          console.log('Printing...', printOptions);
          printWindow.webContents.print(printOptions, (success, errorType) => {
            if (!success) {
              console.error('Printing failed', errorType);
              notifyStatus.printError(request.settings.printId, errorType);
              reject(new Error(errorType));
            } else {
              console.log('Printing completed');
              notifyStatus.printSuccess(request.settings.printId);
              resolve();
            }
          });
        });
      }

      // Handle PDF saving
      const dateString = new Date().toISOString().replace(/:/g, '-');
      const pdfDir = join(app.getPath('userData'), 'pdfs');

      if (!existsSync(pdfDir)) {
        await fs.mkdir(pdfDir, { recursive: true });
      }

      const pdfPath = join(pdfDir, `transcript-${dateString}.pdf`);
      console.log('Printing to PDF...', pdfPath, pdfOptions);
      const pdfData = await printWindow.webContents.printToPDF(pdfOptions);

      if (pdfData) {
        await fs.writeFile(pdfPath, pdfData);
        console.log(`Wrote PDF successfully to ${pdfPath}`);

        notifyStatus.pdfSuccess(request.settings.printId, pdfPath);

        // Create or update notification about completed job
        // This notification combines both print and PDF status if forcePrint was enabled
        const notificationTitle = request.settings.forcePrint
          ? 'Print Job & PDF Completed'
          : 'PDF Generated Successfully';

        const notificationBody = request.settings.forcePrint
          ? `Print completed and PDF saved. Click to open.`
          : `PDF saved successfully. Click to open.`;

        notificationManager.showNotification(request.settings.printId, notificationTitle, {
          body: notificationBody,
          silent: true,
          path: pdfPath,
        });

        printEvents.emit('INTERNAL-PrintQueueEvent:complete', {
          printId: request.settings.printId,
          success: true,
        } as PrintCompletionEvent);
      }

      return true;
    } catch (error) {
      console.error('Print/PDF error:', error);
      notifyStatus.printError(request.settings.printId, error);

      // Emit error event for PrintQueue
      const completionEvent: PrintCompletionEvent = {
        printId: request.settings.printId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      printEvents.emit('INTERNAL-PrintQueueEvent:complete', completionEvent);

      throw error;
    }
  });

  // Print status handler
  ipc.on('print-status', (_event, status) => {
    if (!status.printId) {
      console.error('❌ Print status received without printId:', status);
      return;
    }

    // Ensure we have a print window through the manager
    printWindowManager.getOrCreatePrintWindow();

    if (status.success) {
      notifyStatus.printSuccess(status.printId, status.error || '🖨️ Print completed');
    } else {
      notifyStatus.printError(status.printId, status.error || 'Print failed');
    }
  });

  // Set up print events listener for when print queue jobs are completed
  printEvents.on('INTERNAL-PrintQueueEvent:complete', (event: PrintCompletionEvent) => {
    // If we have a notification for this print job, update it based on success/failure
    if (notificationManager.hasNotification(event.printId)) {
      if (!event.success && event.error) {
        // Don't dismiss on error - notification already updated in PrintWindow:ReadyToBePrinted handler
      } else {
        // For successful jobs, the notification will be dismissed after a delay
        // to give the user time to see the success message
        setTimeout(() => {
          notificationManager.dismissNotification(event.printId);
        }, 5000); // Dismiss after 5 seconds
      }
    }
  });
}
