/// <reference types="svelte" />
/// <reference types="electron" />
/// <reference path="../electron/types.d.ts" />

declare module "*.svelte" {
    import type { ComponentType } from "svelte";
    const component: ComponentType;
    export default component;
}

declare module "svelte" {
    interface ComponentConstructorOptions {
        target: HTMLElement;
        anchor?: HTMLElement | null;
        props?: Record<string, any>;
        context?: Map<any, any>;
        hydrate?: boolean;
        intro?: boolean;
        $$inline?: boolean;
    }
}

// Add environment variables type support
interface ImportMetaEnv {
    VITE_APP_TITLE: string;
    // Add other env variables here
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Add any global types here
declare global {
    interface Window {
        electron?: {
            // Add your IPC methods here
            send: (channel: string, data?: any) => void;
            receive: (channel: string, func: Function) => void;
        };
    }
}

export { };
