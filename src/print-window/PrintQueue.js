class PrintQueue {
    constructor(printWindow, createPrintWindow) {
        this.queue = [];
        this.isProcessing = false;
        this.maxRetries = 3;
        this.timeout = 5 * 60 * 1000; // 5 minutes timeout
        this.createPrintWindow = createPrintWindow;
        this.setPrintWindow(printWindow);
    }

    setPrintWindow(window) {
        this.printWindow = window;
    }

    async add(content, settings) {
        return new Promise((resolve, reject) => {
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
            if (!this.printWindow || this.printWindow.isDestroyed()) {
                this.createPrintWindow();
                // Wait for print window to be ready
                await new Promise(resolve => {
                    const checkReady = setInterval(() => {
                        if (this.printWindow && !this.printWindow.webContents.isLoading()) {
                            clearInterval(checkReady);
                            resolve();
                        }
                    }, 100);
                });
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
                    require('electron').ipcMain.removeListener('print-status', handleStatus);
                    clearTimeout(timeoutId);
                };
                
                const handleStatus = (event, status) => {
                    cleanup();
                    resolve(status);
                };
                
                require('electron').ipcMain.once('print-status', handleStatus);
                
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
                job.resolve(result);
            } else if (!result.retrying) {
                job.reject(new Error(result.error || 'Print failed'));
            }
        } catch (error) {
            console.error('Print job error:', error);
            job.reject(error);
        } finally {
            this.queue.shift(); // Remove the processed job
            this.isProcessing = false;
            this.updateQueueStatus();
            
            // Process next job after a small delay to allow for cleanup
            setTimeout(() => this.processNext(), 1000);
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