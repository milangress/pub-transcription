/// <reference types="svelte" />
/// <reference types="electron" />
/// <reference path="../electron/types.d.ts" />

declare module "*.svelte" {
    const component: any;
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