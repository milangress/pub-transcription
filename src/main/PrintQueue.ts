import { app } from 'electron';
import { EventEmitter } from 'events';
import type { PrintJob, QueueStatus } from '../types/index.ts';
import { printLogger } from './utils/logger';
import { printWindowManager } from './window/PrintWindow.js';

interface PrintQueueJob extends PrintJob {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  retries: number;
  addedAt: number;
}

interface PrintJobResult {
  success: boolean;
  error?: string;
  retrying?: boolean;
}

interface ExtendedQueueStatus extends QueueStatus {
  currentJob: {
    addedAt: number;
    retries: number;
    job: PrintQueueJob;
  } | null;
}

interface PrintQueueResult {
  queued: boolean;
  completion: Promise<unknown>;
}

/**
 * PrintQueue manages a queue of print jobs for electron windows.
 * Handles print job processing, retries, timeouts and window management.
 *
 * Features:
 * - Configurable retry attempts for failed jobs
 * - Timeout handling for stalled jobs
 * - Auto-recreation of print windows if destroyed
 * - Queue status updates via IPC
 * - Graceful cleanup of pending jobs
 */
export class PrintQueue {
  private queue: PrintQueueJob[] = [];
  private isProcessing = false;
  private readonly maxRetries = 3;
  private readonly timeout = 1 * 60 * 1000; // 1 minute timeout
  private printEvents: EventEmitter;

  constructor(eventEmitter?: EventEmitter) {
    this.printEvents = eventEmitter || new EventEmitter();
    this.updateQueueStatus();
  }

  // This function allows setting or replacing the event emitter after creation
  setPrintEvents(eventEmitter: EventEmitter): void {
    this.printEvents = eventEmitter;
  }

  getPrintEvents(): EventEmitter {
    return this.printEvents;
  }

  async add(printJob: PrintJob): Promise<PrintQueueResult> {
    const jobPromise = new Promise((resolve, reject) => {
      const job: PrintQueueJob = {
        ...printJob,
        resolve,
        reject,
        retries: 0,
        addedAt: Date.now(),
      };

      this.queue.push(job);
      printLogger.info(`Added job to queue. Queue length: ${this.queue.length}`);
      this.updateQueueStatus();
      this.processNext();
    });

    // Return both the immediate success and the job completion promise
    return {
      queued: true,
      completion: jobPromise,
    };
  }

  private updateQueueStatus(): void {
    const status = this.getQueueStatus();
    // Update the app badge count to reflect queue length
    app.badgeCount = status.queueLength;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    this.updateQueueStatus();
    const job = this.queue[0];

    try {
      // Process the job using the printWindow
      const result = await new Promise<PrintJobResult>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          cleanup();

          // If we haven't exceeded max retries, move job to end of queue
          if (job.retries < this.maxRetries) {
            job.retries++;
            this.queue.push({
              ...job,
              addedAt: Date.now(), // Reset the timestamp
            });
            printLogger.warn(
              `Job timed out, retrying later. Attempt ${job.retries}/${this.maxRetries}`,
            );
            resolve({ success: false, retrying: true });
          } else {
            printLogger.error(`Job failed after ${this.maxRetries} attempts`);
            reject(new Error(`Print job failed after ${this.maxRetries} attempts`));
          }
        }, this.timeout);

        const cleanup = (): void => {
          this.printEvents.removeListener('INTERNAL-PrintQueueEvent:complete', handleComplete);
          clearTimeout(timeoutId);
        };

        const handleComplete = ({
          printId,
          success,
          error,
        }: {
          printId: string;
          success: boolean;
          error?: string;
        }): void => {
          if (printId !== job.printId) return;
          cleanup();
          if (success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error });
          }
        };

        this.printEvents.on('INTERNAL-PrintQueueEvent:complete', handleComplete);

        // Send the job to the print window via the printWindow
        try {
          printLogger.info(`Sending job ${job.printId} to print window`);

          printWindowManager
            .sendJobToPrintWindow({
              ...job,
              attempt: job.retries,
              maxRetries: this.maxRetries,
            })
            .catch((err) => {
              cleanup();
              reject(err);
            });
        } catch (error) {
          cleanup();
          reject(
            new Error(
              `Failed to send job to print window: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        }
      });

      if (result.success) {
        printLogger.info(`Job ${job.printId} completed successfully`);
        job.resolve(result);
      } else if (!result.retrying) {
        printLogger.warn(`Job ${job.printId} failed: ${result.error}`);
        job.reject(new Error(result.error || 'Print failed'));
      }
    } catch (error) {
      printLogger.error('Print job error:', error);
      job.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Always clean up the current job
      this.queue.shift();
      this.isProcessing = false;
      this.updateQueueStatus();

      // Process next job after a delay to allow for SVG filters and window stabilization
      if (this.queue.length > 0) {
        printLogger.info(`Will process next job in 1s. Queue length: ${this.queue.length}`);
        setTimeout(() => {
          printLogger.info('Processing next job after delay');
          this.processNext();
        }, 1000);
      } else {
        printLogger.info('Queue is empty');
      }
    }
  }

  getQueueStatus(): ExtendedQueueStatus {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      currentJob: this.queue[0]
        ? {
            addedAt: this.queue[0].addedAt,
            retries: this.queue[0].retries,
            job: this.queue[0],
          }
        : null,
    };
  }

  cleanup(): void {
    if (this.queue.length > 0) {
      printLogger.info(`Cleaning up ${this.queue.length} remaining print jobs`);

      // Emit completion events for all remaining jobs to clean up notifications
      this.queue.forEach((job) => {
        this.printEvents.emit('INTERNAL-PrintQueueEvent:complete', {
          printId: job.printId,
          success: false,
          error: 'Print queue was cleared',
        });
      });
    }
    this.queue = [];
    this.isProcessing = false;
    // Reset badge count when cleaning up the queue
    app.badgeCount = 0;
  }

  /**
   * Check if there are any active jobs in the queue
   * @returns true if there are jobs in the queue or a job is being processed
   */
  hasActiveJobs(): boolean {
    return this.queue.length > 0 || this.isProcessing;
  }
}

export const printQueue = new PrintQueue();
