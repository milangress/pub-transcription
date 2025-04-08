import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/renderer';
import type { IpcEvents, IpcRendererEvent } from 'src/types/ipc';
import { untrack } from 'svelte';
import { settings } from './settings.svelte';

const emitter = new IpcEmitter<IpcEvents>();

class RemoteSettingsStore {
  editorCss = $state('');
  svgFilters = $state('');
  controllerSettings = settings.controllerSettings;
  controllerValues = settings.controllerValues;
  #initialized = $state(false);

  constructor() {
    // Initialize with settings from main settings store
    this.init();
  }

  init(): void {
    if (this.#initialized) return;

    // Set up listeners for settings sync from editor windows
    const ipc = new IpcListener<IpcRendererEvent>();
    ipc.on('settings-sync', (_, syncedSettings) => {
      console.log('Received remote settings update:', syncedSettings);
      if (syncedSettings.editorCss !== undefined) {
        this.editorCss = syncedSettings.editorCss;
      }
      if (syncedSettings.svgFilters !== undefined) {
        this.svgFilters = syncedSettings.svgFilters;
      }
    });

    // Initialize with current settings
    this.editorCss = $state.snapshot(settings.editorCss);
    this.svgFilters = $state.snapshot(settings.svgFilters);

    $effect.root(() => {
      // Watch for changes in the main settings store
      $effect(() => {
        console.log('settings.editorCss', settings.editorCss);
        if (settings.editorCss && settings.svgFilters) {
          untrack(() => {
            // Only update if our values are different from the main settings
            // to avoid circular updates
            if (this.editorCss !== settings.editorCss) {
              this.editorCss = $state.snapshot(settings.editorCss);
            }
            if (this.svgFilters !== settings.svgFilters) {
              this.svgFilters = $state.snapshot(settings.svgFilters);
            }
          });
        }
      });
    });

    this.#initialized = true;
  }

  // Send our settings to other windows through the main process
  sendToRemote(): void {
    emitter.send('editor:settings-updated', {
      editorCss: this.editorCss,
      svgFilters: this.svgFilters,
    });
  }

  // Update remote settings with new values and optionally send to remote
  update(values: { editorCss?: string; svgFilters?: string }, sendToRemote = true): void {
    if (values.editorCss !== undefined) {
      this.editorCss = values.editorCss;
    }
    if (values.svgFilters !== undefined) {
      this.svgFilters = values.svgFilters;
    }
    if (sendToRemote) {
      this.sendToRemote();
    }
  }
}

// Create and export a single instance of the remote settings store
export const remoteSettings = new RemoteSettingsStore();
