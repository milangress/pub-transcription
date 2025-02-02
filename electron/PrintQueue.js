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
 * 
 * @param {BrowserWindow} printWindow - The electron window used for printing
 * @param {Function} createWindowCallback - Callback to create a new print window if needed
 * @param {EventEmitter} printEvents - Event emitter for print events
 */
class PrintQueue {
    constructor(printWindow, createWindowCallback, printEvents) {
        this.queue = [];
        this.isProcessing = false;
        this.maxRetries = 3;
        this.timeout = 5 * 60 * 1000; // 5 minutes timeout
        this.createWindowCallback = createWindowCallback;
        this.printEvents = printEvents;
        this.setPrintWindow(printWindow);
    }

    setPrintWindow(window) {
        this.printWindow = window;
        this.updateQueueStatus();
    }

    async add(content, settings) {
        const jobPromise = new Promise((resolve, reject) => {
            const job = {
                content,
                settings,
                resolve,
                reject,
                retries: 0,
                addedAt: Date.now()
            };
            
            this.queue.push(job);
            console.log(`Added job to queue. Queue length: ${this.queue.length}`);
            this.updateQueueStatus();
            this.processNext();
        });

        // Return both the immediate success and the job completion promise
        return {
            queued: true,
            completion: jobPromise
        };
    }
    
    updateQueueStatus() {
        const status = this.getQueueStatus();
        if (this.printWindow && !this.printWindow.isDestroyed()) {
            this.printWindow.webContents.send('queue-status', status);
        }
    }
    
    async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        this.updateQueueStatus();
        const job = this.queue[0];
        
        try {
            // Ensure we have a print window
            if (!this.printWindow || this.printWindow.isDestroyed()) {
                if (this.createWindowCallback) {
                    this.printWindow = this.createWindowCallback();
                    // Wait for print window to be ready
                    await new Promise(resolve => {
                        const checkReady = setInterval(() => {
                            if (this.printWindow && !this.printWindow.webContents.isLoading()) {
                                clearInterval(checkReady);
                                resolve();
                            }
                        }, 100);
                    });
                } else {
                    throw new Error('Print window is not available and cannot be created');
                }
            }
            
            // Send content to print window and wait for response
            const result = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    cleanup();
                    
                    // If we haven't exceeded max retries, move job to end of queue
                    if (job.retries < this.maxRetries) {
                        job.retries++;
                        this.queue.push({
                            ...job,
                            addedAt: Date.now() // Reset the timestamp
                        });
                        console.log(`Job timed out, retrying later. Attempt ${job.retries}/${this.maxRetries}`);
                        resolve({ success: false, retrying: true });
                    } else {
                        console.log(`Job failed after ${this.maxRetries} attempts`);
                        reject(new Error(`Print job failed after ${this.maxRetries} attempts`));
                    }
                }, this.timeout);
                
                const cleanup = () => {
                    this.printEvents.removeListener('print-complete', handleComplete);
                    clearTimeout(timeoutId);
                };

                const handleComplete = ({ printId, success, error }) => {
                    if (printId !== job.settings.printId) return;
                    cleanup();
                    if (success) {
                        resolve({ success: true });
                    } else {
                        resolve({ success: false, error });
                    }
                };
                
                this.printEvents.on('print-complete', handleComplete);
                
                // Send the job to the print window
                try {
                    if (!this.printWindow || this.printWindow.isDestroyed()) {
                        throw new Error('Print window is not available');
                    }
                    // Ensure content is a string and settings has printId
                    if (typeof job.content !== 'string') {
                        throw new Error('Print content must be a string');
                    }
                    if (!job.settings?.printId) {
                        throw new Error('Print ID is required in settings');
                    }
                    console.log(`Sending job ${job.settings.printId} to print window`);
                    this.printWindow.webContents.send('print-job', { 
                        content: job.content, 
                        settings: job.settings,
                        attempt: job.retries + 1,
                        maxRetries: this.maxRetries
                    });
                } catch (error) {
                    cleanup();
                    reject(new Error('Failed to send job to print window: ' + error.message));
                }
            });
            
            if (result.success) {
                console.log(`Job ${job.settings.printId} completed successfully`);
                job.resolve(result);
            } else if (!result.retrying) {
                console.log(`Job ${job.settings.printId} failed: ${result.error}`);
                job.reject(new Error(result.error || 'Print failed'));
            }
        } catch (error) {
            console.error('Print job error:', error);
            job.reject(error);
        } finally {
            // Always clean up the current job
            this.queue.shift();
            this.isProcessing = false;
            this.updateQueueStatus();
            
            // Process next job after a delay to allow for SVG filters and window stabilization
            if (this.queue.length > 0) {
                console.log(`Will process next job in 1s. Queue length: ${this.queue.length}`);
                setTimeout(() => {
                    console.log('Processing next job after delay');
                    this.processNext();
                }, 1000);
            } else {
                console.log('Queue is empty');
            }
        }
    }
    
    getQueueStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            currentJob: this.queue[0] ? {
                addedAt: this.queue[0].addedAt,
                retries: this.queue[0].retries,
                settings: this.queue[0].settings
            } : null
        };
    }

    cleanup() {
        if (this.queue.length > 0) {
            console.log(`Cleaning up ${this.queue.length} remaining print jobs`);
        }
        this.queue = [];
        this.isProcessing = false;
    }
}

module.exports = PrintQueue; 