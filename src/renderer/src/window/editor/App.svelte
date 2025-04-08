<script lang="ts">
  import { settings } from '@/stores/settings.svelte.js';
  import CodeEditor from '@components/codeEditor/CodeEditor.svelte';
  import BlockTxt from '@components/pageElement/BlockTxt.svelte';
  import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/renderer';
  import type { IpcEvents, IpcRendererEvent } from 'src/types/ipc';
  import { onMount } from 'svelte';

  // Initialize settings store
  settings.init();

  const emitter = new IpcEmitter<IpcEvents>();
  const ipc = new IpcListener<IpcRendererEvent>();

  let editorValue = $state('');
  let editorLanguage = $state<'css' | 'html'>('css');
  let currentFilePath = $state<string | null>(null);
  let isDocumentEdited = $state(false);
  let storageKey = $state<string>('editor:unknown');
  let ignoreNextChange = $state(false);

  // Load content from localStorage on startup
  onMount(() => {
    // If this is a new session, make sure we don't have a document marked as edited
    emitter.invoke('editor:set-document-edited', false);

    // Set default represented filename
    emitter.invoke('editor:set-represented-file', storageKey);

    // Set up keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  // Handle keyboard shortcuts
  function handleKeyDown(event: KeyboardEvent): void {
    // Check for Cmd+S (Mac) or Ctrl+S (Windows/Linux)
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      saveContent();
    }
  }

  $effect(() => {
    if (!editorValue) {
      console.log('editorValue', editorValue);
      updateStorageKey();
      const savedContent = localStorage.getItem(storageKey);
      if (savedContent) {
        editorValue = savedContent;
      }
    }
  });

  // Handle editor init event
  ipc.on('editor:init', (_, options) => {
    editorValue = options.content;
    editorLanguage = options.language;

    // Update storage key based on language
    updateStorageKey();

    // Try to load from localStorage first
    const savedContent = localStorage.getItem(storageKey);
    if (savedContent) {
      // Don't mark as edited on initial load from localStorage
      ignoreNextChange = true;
      editorValue = savedContent;
    }
  });

  // Handle when a file is opened
  ipc.on('editor:opened-file', (_, filePath) => {
    currentFilePath = filePath;
    updateStorageKey();

    // Save to localStorage
    localStorage.setItem(storageKey, editorValue);

    // Reset the edited state
    isDocumentEdited = false;
    emitter.invoke('editor:set-document-edited', false);
  });

  ipc.on('editor:setLanguage', (_, language) => {
    editorLanguage = language;
    updateStorageKey();
  });

  // Handle save events from menu
  ipc.on('editor:save', () => {
    saveContent();
  });

  ipc.on('editor:save-as', async () => {
    // Force a new save dialog by temporarily clearing the current file path
    const oldFilePath = currentFilePath;
    currentFilePath = null;
    await saveContent();

    // If user canceled the save dialog, restore the old file path
    if (!currentFilePath && oldFilePath) {
      currentFilePath = oldFilePath;
      updateStorageKey();
    }
  });

  // Handle save complete event
  ipc.on('editor:save-complete', (_, filePath) => {
    if (filePath) {
      currentFilePath = filePath;

      // Update storage key to use the file path
      storageKey = `editor:file:${filePath}`;

      // Save to localStorage
      localStorage.setItem(storageKey, editorValue);

      console.log(`File saved to ${filePath}`);
    }
  });

  // Update storage key based on current state
  function updateStorageKey(): void {
    if (currentFilePath) {
      storageKey = `editor:file:${currentFilePath}`;
    } else {
      storageKey = `editor:${editorLanguage}:unknown`;
    }
  }

  // Save content to file and localStorage
  async function saveContent(): Promise<void> {
    if (!currentFilePath) {
      // If no file path, open save dialog
      const filePath = await emitter.invoke('editor:save-dialog');
      if (filePath) {
        currentFilePath = filePath;
        updateStorageKey();

        // Set the represented filename in the window
        await emitter.invoke('editor:set-represented-file', filePath);
      } else {
        // User canceled the dialog
        return;
      }
    }

    // Save content to file
    if (currentFilePath) {
      emitter.send('editor:save-to-file', { content: editorValue, filePath: currentFilePath });

      // Set document as not edited
      isDocumentEdited = false;
      await emitter.invoke('editor:set-document-edited', false);
    }

    // Always save to localStorage
    localStorage.setItem(storageKey, editorValue);
  }

  // Update appropriate setting when editor value changes and send to remote
  function handleEditorChange(value: string): void {
    console.log('handleEditorChange', value);
    editorValue = value;

    // Don't mark as edited if we're ignoring this change (e.g., initial load from localStorage)
    if (ignoreNextChange) {
      ignoreNextChange = false;
    } else {
      isDocumentEdited = true;
      emitter.invoke('editor:set-document-edited', true);
    }

    // Save to localStorage
    localStorage.setItem(storageKey, value);

    // Send the update to remote settings in other windows
    // This will not affect the main settings store in other windows
    if (editorLanguage === 'css') {
      emitter.send('editor:settings-updated', { editorCss: value });
    } else if (editorLanguage === 'html') {
      emitter.send('editor:settings-updated', { svgFilters: value });
    }
  }

  function saveSnapshotOfRemoteSettings(): void {
    emitter.send('editor:command', 'save-snapshot', {
      editorCss: editorValue,
      svgFilters: settings.svgFilters,
    });
  }
</script>

<div class="print-window">
  <div class="header">
    <BlockTxt
      content={`Editor (${editorLanguage})${isDocumentEdited ? ' *' : ''}`}
      settings={{
        editorCss: editorLanguage === 'css' ? editorValue : settings.editorCss,
        controllerSettings: settings.controllerSettings,
        svgFilters: editorLanguage === 'html' ? editorValue : settings.svgFilters,
      }}
    />
  </div>

  <div class="actions">
    <button onclick={() => saveContent()}>Save</button>
    <button onclick={() => saveSnapshotOfRemoteSettings()}>Save Snapshot</button>
  </div>

  <div class="editor-container">
    <CodeEditor
      bind:value={editorValue}
      language={editorLanguage}
      controllerSettings={settings.controllerSettings}
      onChange={handleEditorChange}
      pureStyle={true}
    />
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
  }

  .print-window {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #fff;
  }
  :global(cm-gutters) {
    app-region: drag;
    user-select: none;
  }

  .header {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
  }

  .actions {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 10;
  }

  .actions button {
    padding: 0.5rem;
    background: #eee;
    border: 1px solid #ccc;
    border-radius: 3px;
    cursor: pointer;
    margin-right: 0.5rem;
  }

  .actions button:hover {
    background: #ddd;
  }

  .editor-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
