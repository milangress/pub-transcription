<script lang="ts">
  import ControllerManager from '@/components/managers/ControllerManager.svelte';
  import SnapshotManager from '@/components/managers/SnapshotManager.svelte';
  import PrintStatusBar from '@/components/status/PrintStatusBar.svelte';
  import { remoteSettings } from '@/stores/remoteSettings.svelte.ts';
  import { settings } from '@/stores/settings.svelte.js';
  import { snapshots } from '@/stores/snapshots.svelte.js';
  import CodeEditor from '@components/codeEditor/CodeEditor.svelte';
  import BlockTxt from '@components/pageElement/BlockTxt.svelte';
  import TransInfoMessagesLog from '@components/status/TransInfoMessagesLog.svelte';
  import type { FontFamily, TxtObject } from '../src/types';
  import { contentStore } from './stores/contentStore.svelte';

  import type { PrintRequest, PrintTask } from 'src/types';

  import WhisperManagerDialog from '@/components/managers/WhisperManagerDialog.svelte';
  import { tick } from 'svelte';
  import { WebMidi } from 'webmidi';

  import Dialog from '@/components/ui/DialogExample.svelte';
  import TitleBar from '@components/ui/TitleBar.svelte';
  import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/renderer';
  import type { IpcEvents, IpcRendererEvent } from 'src/types/ipc';
  const ipc = new IpcListener<IpcRendererEvent>();
  const emitter = new IpcEmitter<IpcEvents>();

  // Only Contains the final sentences
  let committedContent = $state<TxtObject[]>([]);

  let currentSentence = $state<TxtObject>({} as TxtObject);

  let fontFamilys = $state<FontFamily[]>([
    { name: 'Garamondt-Regular' },
    { name: 'American Typewriter' },
    { name: 'Arial' },
    { name: 'Arial Black' },
    { name: 'Arial Narrow' },
    { name: 'SpaceMono' },
    { name: 'Unifont' },
    { name: 'OracleGM-RegularMono' },
    { name: 'Neureal-Regular' },
    { name: 'NIKITA-Regular' },
    { name: 'Yorkshire' },
  ]);

  let printerSettings = $state<PrintTask>({
    deviceName: 'Xerox_Phaser_5550N',
    yes: false,
    silent: undefined,
  });

  // Page counter
  let pageNumber = $state(1);

  let isSuccessfulPrint = $state(true);
  let printStatusBar = $state<PrintStatusBar | undefined>(undefined);

  // State for sentences waiting to be committed while printing
  let isPrinting = $state(false);
  let isHandlingOverflow = $state(false); // Flag to prevent recursive overflow handling

  let mode = $state<'full' | 'mini'>('full');

  // Ensure snapshots are loaded when the app starts
  $effect(() => {
    if (settings.controllerSettings.length > 0) {
      snapshots.loadSnapshots().catch(console.error);
    }
  });

  let currentContentList = $derived([...committedContent, currentSentence]);

  // Update the style tag in the header when editorCss changes from remote
  $effect(() => {
    if (typeof document !== 'undefined') {
      // Get the existing style tag or create a new one if needed
      let styleTag = document.head.querySelector('style[data-inline-style]');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.setAttribute('data-inline-style', 'true');
        document.head.appendChild(styleTag);
      }

      // Update the content of the style tag with remote settings
      styleTag.textContent = remoteSettings.editorCss || '';
    }
  });

  async function handleOverflow(overflowingItem: TxtObject): Promise<void> {
    // Don't handle overflow if we're already handling overflow
    if (isHandlingOverflow) return;

    try {
      isHandlingOverflow = true;
      console.log('Handling overflow for:', overflowingItem.content);

      // Find the index of the overflowing item in the contentStore
      const index = contentStore.committedContent.findIndex(
        (item) => item.id === overflowingItem.id,
      );
      if (index === -1) return;

      // If this is the first item on the page and it's overflowing,
      // we need to handle it specially to avoid an infinite loop
      if (index === 0) {
        console.warn(
          'First item on page is overflowing - forcing it to print alone:',
          overflowingItem.content,
        );
        // Save the items for after printing
        const itemToPrint = contentStore.committedContent[0];
        const remainingItems = contentStore.committedContent.slice(1);

        // Set isPrinting to prevent showing current prediction during print
        isPrinting = true;

        // Clear and add only the first item
        contentStore.clearContent();
        // We need to manually add the item since clearContent removes everything
        const tempContent = [itemToPrint];
        for (const item of tempContent) {
          // Use the internal array directly to avoid unnecessary processing
          contentStore.committedContent.push(item);
        }

        await tick(); // Wait for DOM update

        // Print current page
        await printFile();

        // Clear the printed content
        contentStore.clearContent();
        await tick(); // Wait for DOM update

        // Add remaining items back
        for (const item of remainingItems) {
          contentStore.committedContent.push(item);
        }

        // Reset printing state
        isPrinting = false;
        return;
      }

      // Normal case - split at the overflowing item
      const itemsToPrint = contentStore.committedContent.slice(0, index);
      const itemsForNextPage = contentStore.committedContent.slice(index);

      // Set isPrinting to prevent showing current prediction during print
      isPrinting = true;

      // Print current page and continue with remaining items
      contentStore.clearContent();
      for (const item of itemsToPrint) {
        contentStore.committedContent.push(item);
      }
      await tick(); // Wait for DOM update
      await printFile();

      // Clear the printed content before setting the remaining items
      contentStore.clearContent();
      await tick(); // Wait for DOM update

      // Add remaining items back
      for (const item of itemsForNextPage) {
        contentStore.committedContent.push(item);
      }

      // Reset printing state
      isPrinting = false;
    } finally {
      isHandlingOverflow = false;
    }
  }

  async function printFile(): Promise<void> {
    if (!printStatusBar) {
      console.error('❌ No print status bar found');
      isSuccessfulPrint = false;
      return;
    }
    console.log('🖨️ Starting print process');
    isPrinting = true; // Set printing state to hide current prediction
    await tick(); // Wait for DOM update

    try {
      const pageElement = document.querySelector('page');
      if (!pageElement) {
        console.error('❌ No page element found');
        isSuccessfulPrint = false;
        return;
      }

      // Remove current elements before printing more efficiently
      pageElement.querySelectorAll('.current').forEach((element) => element.remove());

      const pageContent = pageElement.innerHTML;
      if (!pageContent) {
        console.error('❌ Invalid page content');
        isSuccessfulPrint = false;
        return;
      }

      // Create a print request in the status bar
      const printId = printStatusBar.addPrintRequest()?.toString();
      if (!printId) {
        console.error('❌ Failed to create print ID');
        isSuccessfulPrint = false;
        return;
      }

      // Create request with minimal references
      const printRequest: PrintRequest = {
        printId,
        pageNumber: pageNumber,
        do: {
          print: {
            deviceName: printerSettings.deviceName,
            yes: printerSettings.yes,
            silent: printerSettings.silent,
          },
          pdfSave: {
            yes: true,
          },
        },
        pageContent: {
          editorCss: remoteSettings.editorCss,
          svgFilters: remoteSettings.svgFilters,
          html: pageContent,
        },
      };

      // Send request and clear references
      emitter.send('print', printRequest);

      // Don't clear content here - it's managed by handleOverflow
      // The contentStore.clearContent() call should happen in handleOverflow

      // Increment page number after successful print
      pageNumber++;
      isSuccessfulPrint = true;
    } catch (error) {
      console.error('❌ Error during print:', error);
      isSuccessfulPrint = false;
    } finally {
      // Reset printing state even if there was an error
      isPrinting = false;
    }
  }

  // Initialize WebMidi
  WebMidi.enable().catch((err) => console.error('WebMidi could not be enabled:', err));

  // Listen for WebMidi events
  WebMidi.addListener('connected', (e) => {
    console.log('WebMidi device connected:', e);
    settings.setupControllers(WebMidi);
  });

  WebMidi.addListener('disconnected', (e) => {
    console.log('WebMidi device disconnected:', e);
  });

  // Handle editor commands
  ipc.on('editor:command', async (_, command) => {
    if (command === 'save-snapshot') {
      await snapshots.saveSnapshot();
    }
  });

  function clearAll(): void {
    console.log('🗑️ Clearing all content');
    committedContent = [];
  }

  // Function to open editor window for either CSS or SVG filters
  async function openEditor(language: 'css' | 'html'): Promise<void> {
    try {
      const content = language === 'css' ? settings.editorCss : settings.svgFilters;
      await emitter.invoke('editor:openFile', {
        content,
        language,
      });
      console.log(`Opened ${language} editor window`);
    } catch (error) {
      console.error(`Failed to open editor: ${error}`);
    }
  }

  // Add IPC listener for mode changes
  ipc.on('window:mode', (_, newMode: 'full' | 'mini') => {
    mode = newMode;
  });
</script>

<!-- svelte:head meta title -->
<svelte:head>
  <title>a-trans(crip)tion-live-coding-VJ-PDF-printing-tool</title>
  <!-- The static style tag below is kept for initial rendering, but will be replaced/updated by the $effect -->
  <style data-inline-style>
{settings.editorCss}
  </style>
</svelte:head>

<TitleBar />

<div class="text-preview-container">
  <BlockTxt
    content="Text Preview"
    editorCss={remoteSettings.editorCss}
    controllerValues={settings.controllerValues}
  />
</div>

<Dialog
  buttonText="Open Dialog"
  title="Account settings"
  description={() => 'Manage your account settings and preferences.'}
>
  <p>Additional dialog content here...</p>
</Dialog>

<WhisperManagerDialog />
<main>
  {#if currentContentList.length > 0}
    <div class={mode === 'mini' ? 'print-context-mini' : 'print-context'}>
      <page size="A3" id="page">
        <div class="content-context">
          {#each contentStore.committedContent as item (item.id)}
            <item.type
              content={item.content}
              editorCss={item.editorCss}
              controllerValues={item.controllerValues}
              onOverflow={() => handleOverflow(item)}
            />
          {/each}
          {#if !isPrinting && contentStore.currentPrediction}
            <contentStore.currentPrediction.type
              content={contentStore.currentPrediction.content}
              editorCss={contentStore.currentPrediction.editorCss}
              controllerValues={settings.controllerValues}
              isCurrent
            />
          {/if}
          <div
            class="page-number #num"
            style="position: absolute; bottom: 1em; right: 1em;font-size: 2rem;"
          >
            <BlockTxt
              content={`${pageNumber}`}
              editorCss={remoteSettings.editorCss}
              controllerValues={settings.controllerValues}
            />
          </div>
        </div>
      </page>
    </div>
  {/if}

  {#if mode === 'full'}
    <div class="print-non" class:printFailed={!isSuccessfulPrint}>
      <div class="infobox">
        <div class="codeEditorHeader">
          <div class="dot" class:greenDot={settings.codeEditorContentSaved}></div>
          <button onclick={() => openEditor('css')}>Open in Editor Window</button>
        </div>
        <div class="codeEditorContainer">
          <CodeEditor
            bind:value={settings.editorCss}
            language="css"
            controllerSettings={settings.controllerSettings}
            {fontFamilys}
          />
        </div>

        <hr />

        <ControllerManager bind:controllerSettings={settings.controllerSettings}
        ></ControllerManager>

        <hr />

        <div class="printControls">
          <button onclick={printFile}>PRINT</button>
          <input id="pageNumberInput" bind:value={pageNumber} type="number" />
          <button onclick={clearAll}>CLEAR ALL</button>
          <button onclick={() => emitter.invoke('open-pdf-folder')}> OPEN PDFs FOLDER </button>
          <input bind:value={printerSettings.deviceName} type="text" disabled />
          <label><input bind:checked={printerSettings.yes} type="checkbox" />Force Print</label>
        </div>

        <hr />

        <SnapshotManager />

        <hr />

        <div class="codeEditorHeader">
          <h3>SVG Filters</h3>
          <button onclick={() => openEditor('html')}> ❇️ </button>
        </div>
        <div class="svgFiltersContainer">
          <CodeEditor
            bind:value={settings.svgFilters}
            language="html"
            controllerSettings={settings.controllerSettings}
          />
        </div>
        <div style="display: none">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html settings.svgFilters}
        </div>
        <TransInfoMessagesLog />
      </div>
    </div>
  {/if}

  <PrintStatusBar bind:this={printStatusBar} />
</main>

<svelte:window />

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    --title-bar-height: 28px;
  }

  .text-preview-container {
    position: fixed;
    top: calc(var(--title-bar-height) + 10px);
    left: 10px;
    z-index: 1000;
    font-size: 2rem;
    pointer-events: none;
    /* background: white; */
  }

  main {
    text-align: left;
    font-family: 'SpaceMono', 'Garamondt-Regular', 'American Typewriter', monospace;
    display: grid;
    grid-template-columns: 1fr;
    height: 100%;
    padding: 0.5rem;
  }
  page {
    background: white;
    display: block;
    box-shadow: 0 0 0.5cm rgba(0, 0, 0, 0.5);
  }
  .print-context-mini {
    --page-left: 50%;
  }

  page {
    width: calc(297.3mm * 0.86);
    height: calc(420.2mm * 0.895);
    padding: 2cm;
    background: url('../src/assets/scan.png');
    background-size: 100% 100%;
    outline: 1px solid red;
    position: fixed;
    top: 50%;
    left: var(--page-left, 70%);
    transform: translate(-50%, -50%) scale(var(--page-scale, 0.5)) translate3d(0, 0, 0);
    z-index: 500;
    contain: strict;
  }

  page:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: url('../src/assets/scan.png');
    mix-blend-mode: multiply;
  }
  .print-context {
    text-align: left;
    font-size: 2em;
    font-weight: 100;
    z-index: 500;
    position: fixed;
  }

  :global(h1) {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }
  .infobox {
    font-family: 'SpaceMono', serif;
    max-width: 40vw;
    border: 1px solid black;
    margin: 1rem;
    padding: 1rem;
  }
  .content-context {
    height: 100%;
  }
  .content-context:hover {
    outline: 2px solid #00ff00;
  }

  .printControls {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .printFailed {
    background: red;
  }

  .dot {
    background: red;
    width: 0.5em;
    height: 0.5em;
    border-radius: 50%;
  }
  .greenDot {
    background: green;
  }

  #pageNumberInput {
    width: 5em;
    text-align: center;
  }

  .codeEditorHeader {
    display: flex;
    justify-content: space-between;
    align-items: right;
    margin-bottom: 0.5rem;
  }

  .codeEditorContainer {
    height: 60vh;
    overflow: auto;
  }

  .codeEditorHeader h3 {
    margin: 0;
  }

  .svgFiltersContainer {
    contain: strict;
    height: 60vh;
    overflow: auto;
  }

  @media print {
    * {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .print-non {
      display: none;
    }
    .print-context {
      width: 100%;
    }
    page[size='A3'] {
      transform: none;
      top: 0;
      left: 0;
    }
    :global(body, page, main) {
      background: white;
      margin: 0;
      padding: 0;
      box-shadow: none;
      display: block;
    }
    :global(span.current) {
      display: none !important;
    }
  }
</style>
