/**
 * Print action types
 */
export type PrintAction = 'PRINT_START' | 'PRINT_COMPLETE' | 'PDF_SAVE' | 'PRINT_ERROR';

/**
 * Print status types
 */
export type PrintStatus = 'SUCCESS' | 'ERROR' | 'INFO';

/**
 * Print margins configuration
 */
export interface PrintMargins {
    marginType: 'custom';
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/**
 * Base print settings interface
 */
export interface PrintSettings {
    printId: string;
    deviceName?: string;
    forcePrint?: boolean;
    silent?: boolean;
    printBackground?: boolean;
    printSelectionOnly?: boolean;
    landscape?: boolean;
    pageSize?: string;
    scaleFactor?: number;
    margins?: PrintMargins;
    inlineStyle?: string;
    svgFiltersCode?: string;
}

/**
 * Print status message interface
 */
export interface PrintStatusMessage {
    id: string;
    timestamp: number;
    action: PrintAction;
    status: PrintStatus;
    message?: string;
    error?: string;
    path?: string;
    details?: Record<string, unknown>;
}

/**
 * Print request payload interface
 */
export interface PrintRequest {
    content: string;
    settings: PrintSettings;
}

/**
 * Queue status update interface
 */
export interface QueueStatus {
    queueLength: number;
    isProcessing: boolean;
}

/**
 * Print job completion event interface
 */
export interface PrintCompletionEvent {
    printId: string;
    success: boolean;
    error?: string;
}

declare global {
    interface Window {
        electronAPI: {
            /**
             * Send content to be printed
             */
            print: (content: string, settings: PrintSettings) => void;

            /**
             * Execute a print job and return a promise
             */
            executePrint: (content: string, settings: PrintSettings) => Promise<boolean>;

            /**
             * Send print status updates
             */
            sendPrintStatus: (status: PrintStatusMessage) => void;

            /**
             * Toggle print preview mode
             */
            togglePrintPreview: (enable: boolean) => Promise<boolean>;

            /**
             * Listen for print status updates
             */
            onPrintStatus: (callback: (event: Event, status: PrintStatusMessage) => void) => void;

            /**
             * Listen for print queue updates
             */
            onQueueStatus: (callback: (event: Event, status: QueueStatus) => void) => void;

            /**
             * Listen for print job events
             */
            onPrintJob: (callback: (event: Event, data: PrintRequest & { attempt?: number; maxRetries?: number }) => void) => void;
        }
    }
} 