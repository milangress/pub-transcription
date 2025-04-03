import type { SvelteComponent } from 'svelte';
import type {
    PrintSettings as ElectronPrintSettings,
    PrintRequest,
    PrintStatusMessage,
    QueueStatus
} from '../../electron/types';

export interface FontFamily {
    name: string;
}

export interface PrinterSettings {
    deviceName: string;
    forcePrint: boolean;
}

export interface BlockTxtSettings {
    inlineStyle: string;
    controllerSettings: ControllerSetting[];
    fontFamily?: FontFamily;
    svgFilters?: string;
}

export interface ControllerSetting {
    name: string;
    var: string;
    value: number;
    default: number;
    step: number;
    knobNR: number;
    range: [number, number];
    keys?: string[];
}

export interface Settings {
    controllerSettings: ControllerSetting[];
    inlineStyle: string;
    svgFilters: string;
    fontFamily?: FontFamily;
}

export interface TxtObject {
    type: typeof SvelteComponent;
    content: string;
    settings: BlockTxtSettings;
    id: number;
}

// Re-export electron types
export type { PrintRequest, ElectronPrintSettings as PrintSettings, PrintStatusMessage, QueueStatus };

declare global {
    interface Window {
        electronAPI: {
            // Transcription-related channels
            onTranscriptionData: (callback: (event: Event, data: string) => void) => void;
            onTranscriptionStatus: (callback: (event: Event, status: any) => void) => void;
            
            // Print-related channels
            onPrintStatus: (callback: (event: Event, status: PrintStatusMessage) => void) => void;
            onPrintQueued: (callback: (event: Event, data: { success: boolean; printId: string; error?: string }) => void) => void;
            onPrintJob: (callback: (event: Event, data: PrintRequest & { attempt?: number; maxRetries?: number }) => void) => void;
            onQueueStatus: (callback: (event: Event, status: QueueStatus) => void) => void;
            
            // Print functions
            print: (content: string, settings: ElectronPrintSettings) => void;
            executePrint: (content: string, settings: ElectronPrintSettings) => Promise<boolean>;
            sendPrintStatus: (status: PrintStatusMessage) => void;
            togglePrintPreview: (enable: boolean) => Promise<boolean>;
            
            // Store functions
            getStoreValue: (key: string) => Promise<any>;
            setStoreValue: (key: string, value: any) => Promise<void>;
            
            // Other utilities
            openPDFFolder: () => Promise<void>;
        }
    }
} 