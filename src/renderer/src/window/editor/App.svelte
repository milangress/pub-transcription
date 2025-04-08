<script lang="ts">
  import { settings } from '@/stores/settings.svelte.js';
  import CodeEditor from '@components/codeEditor/CodeEditor.svelte';
  import BlockTxt from '@components/pageElement/BlockTxt.svelte';
  import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/renderer';
  import type { IpcEvents, IpcRendererEvent } from 'src/types/ipc';

  // Initialize settings store
  settings.init();

  const emitter = new IpcEmitter<IpcEvents>();
  let editorValue = $state('');
  let editorLanguage = $state<'css' | 'html'>('css');

  // Handle editor init event
  const ipc = new IpcListener<IpcRendererEvent>();

  ipc.on('editor:init', (_, options) => {
    editorValue = options.content;
    editorLanguage = options.language;
  });

  ipc.on('editor:setLanguage', (_, language) => {
    editorLanguage = language;
  });

  // Update appropriate setting when editor value changes and send to remote
  function handleEditorChange(value: string): void {
    console.log('handleEditorChange', value);
    editorValue = value;

    // Send the update to remote settings in other windows
    // This will not affect the main settings store in other windows
    if (editorLanguage === 'css') {
      emitter.send('editor:settings-updated', { editorCss: value });
    } else if (editorLanguage === 'html') {
      emitter.send('editor:settings-updated', { svgFilters: value });
    }
  }
  // Save a snapshot of the remote settings inside of the main window
  function saveSnapshotOfRemoteSettings(): void {
    console.log('saveSnapshotOfRemoteSettings');
  }
</script>

<div class="print-window">
  <div class="header">
    <BlockTxt
      content={`Editor (${editorLanguage})`}
      settings={{
        editorCss: settings.editorCss,
        controllerSettings: settings.controllerSettings,
        svgFilters: settings.svgFilters,
      }}
    />
  </div>

  <div class="actions">
    <button onclick={() => saveSnapshotOfRemoteSettings()}>Save Snapshot</button>
  </div>

  <div class="editor-container">
    <CodeEditor
      bind:value={editorValue}
      language={editorLanguage}
      controllerSettings={settings.controllerSettings}
      onChange={handleEditorChange}
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
