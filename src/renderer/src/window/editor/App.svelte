<script lang="ts">
  import { settings } from '@/stores/settings.svelte.js';
  import CodeEditor from '@components/codeEditor/CodeEditor.svelte';
  import BlockTxt from '@components/pageElement/BlockTxt.svelte';

  // Initialize settings store
  settings.init();

  let editorValue = $state('');
</script>

<div class="print-window">
  <div class="header">
    <BlockTxt content="Editor" {settings} />
  </div>

  <div class="editor-container">
    <CodeEditor
      bind:value={editorValue}
      language="css"
      controllerSettings={settings.controllerSettings}
      onChange={(value) => {
        editorValue = value;
      }}
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

  .editor-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
