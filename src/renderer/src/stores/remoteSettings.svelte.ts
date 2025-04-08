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

  /**
   * Update the .el{} block in editorCss with current stack content
   */
  #updateEditorCssWithStack(newContent?: string): void {
    // Find or create the .el{} block
    const elBlockRegex = /\.el\s*{([^}]*)}/;
    const match = this.editorCss.match(elBlockRegex);

    if (match) {
      // Get existing content
      const existingLines = match[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Add new content if provided
      if (newContent) {
        const newLines = newContent.split('\n').map((line) => line.trim());
        existingLines.push(...newLines);
      }

      // Keep only the last 20 lines
      const finalLines = existingLines.slice(-10);

      // Create the new block with proper indentation
      const blockContent = finalLines.map((line) => '  ' + line).join('\n');
      const newElBlock = `.el {\n${blockContent}${blockContent ? '\n' : ''}}`;

      // Replace existing block
      this.editorCss = this.editorCss.replace(elBlockRegex, newElBlock);
    } else {
      // Create new block if it doesn't exist
      const lines = newContent ? newContent.split('\n').map((line) => line.trim()) : [];
      const blockContent = lines.map((line) => '  ' + line).join('\n');
      const newElBlock = `.el {\n${blockContent}${blockContent ? '\n' : ''}}`;
      this.editorCss = this.editorCss + '\n\n' + newElBlock;
    }

    // Sync changes
    this.sendToRemote();
  }

  init(): void {
    if (this.#initialized) return;

    // Set up listeners for settings sync from editor windows
    const ipc = new IpcListener<IpcRendererEvent>();

    // Listen for stack mode commands
    ipc.on('editor:stackmode', (_, data) => {
      if (data.clear) {
        this.#updateEditorCssWithStack(''); // Clear by passing empty content
      } else if (data.content) {
        this.#updateEditorCssWithStack(data.content);
      }
    });

    ipc.on('settings-sync', (_, syncedSettings) => {
      console.log(
        'Received remote settings update:',
        syncedSettings.editorCss,
        syncedSettings.svgFilters?.length,
      );
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
