<script lang="ts">
  import PrintStatusBar from '@/components/status/PrintStatusBar.svelte'
  import CodeEditor from '@components/codeEditor/CodeEditor.svelte'
  import ControllerManager from '@components/midi/ControllerManager.svelte'
  import BlockTxt from '@components/pageElement/BlockTxt.svelte'
  import TransInfoMessagesLog from '@components/status/TransInfoMessagesLog.svelte'
  import { settings } from '@stores/settings.js'
  import type {
      BlockTxtSettings,
      FontFamily,
      PrinterSettings,
      TxtObject
  } from 'src/renderer/src/types'

  import type { PrintSettings } from 'src/types'

  import type { SvelteComponent } from 'svelte'
  import { tick } from 'svelte'
  import { WebMidi } from 'webmidi'

  let {
    excludedFragments = [
      '[ Silence ]',
      '[silence]',
      '[BLANK_AUDIO]',
      '[ [ [ [',
      '[ [ [',
      '[ [',
      '[',
      '(buzzer)',
      '(buzzing)',
      '.'
    ]
  } = $props()

  // Only Contains the final sentences
  let committedContent = $state<TxtObject[]>([])

  // Contains all incoming TTS sentences
  let allIncomingTTSMessages = $state<string[]>([])

  let currentSentence = $state<TxtObject>({} as TxtObject)

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
    { name: 'Yorkshire' }
  ])

  let printerSettings = $state<PrinterSettings>({
    deviceName: 'Xerox_Phaser_5550N',
    forcePrint: false
  })

  let isSuccessfulPrint = $state(true)
  let printStatusBar = $state<PrintStatusBar | undefined>(undefined)

  // State for sentences waiting to be committed while printing
  let isPrinting = $state(false)
  let isHandlingOverflow = $state(false) // Flag to prevent recursive overflow handling

  // Initialize settings when the app starts
  $effect(() => {
    if (!$settings.controllerSettings.length) settings.init()
  })

  let codeEditorContentSaved = $derived(settings.codeEditorContentSaved.subscribe)
  let currentContentList = $derived([...committedContent, currentSentence])

  window.electron.ipcRenderer.on('transcription-data', (_, value: string) => {
    allIncomingTTSMessages = [value, ...allIncomingTTSMessages]
    const formattedSentence = formatTTSasTxtObject(value)

    if (isHandlingOverflow) {
      console.warn('Overflow handling in progress, discarding:', value)
      return
    }

    if (String(value).endsWith('NEW')) {
      // Final sentence received
      currentSentence = {} as TxtObject // Clear current visualization

      // Only commit if it's not in the unwanted list
      if (
        !excludedFragments.some(
          (x) => x.toLowerCase() === formattedSentence.content.toLowerCase().trim()
        )
      ) {
        console.log('Commiting finalSentence', formattedSentence.content)
        committedContent = [...committedContent, formattedSentence]
      }
    } else {
      // Always show partial results, even if they would be filtered when final
      currentSentence = formattedSentence
    }
  })

  function formatTTSasTxtObject(tts: string): TxtObject {
    const removeNEWKeyword = String(tts).replace('NEW', '').trim()
    const txtSettings: BlockTxtSettings = {
      inlineStyle: $settings.inlineStyle,
      controllerSettings: $settings.controllerSettings,
      svgFilters: $settings.svgFilters
    }
    return {
      type: BlockTxt as unknown as typeof SvelteComponent,
      content: removeNEWKeyword,
      settings: JSON.parse(JSON.stringify(txtSettings)), // Deep copy of current settings
      id: Math.random()
    }
  }

  // Watch for code changes and mark as unsaved
  $effect(() => {
    if ($settings.inlineStyle || $settings.svgFilters) {
      settings.markUnsaved()
    }
  })

  async function handleOverflow(overflowingItem: TxtObject): Promise<void> {
    // Don't handle overflow if we're already handling overflow
    if (isHandlingOverflow) return

    try {
      isHandlingOverflow = true
      console.log('Handling overflow for:', overflowingItem.content)

      // Find the index of the overflowing item
      const index = committedContent.findIndex((item) => item.id === overflowingItem.id)
      if (index === -1) return

      // If this is the first item on the page and it's overflowing,
      // we need to handle it specially to avoid an infinite loop
      if (index === 0) {
        console.warn(
          'First item on page is overflowing - forcing it to print alone:',
          overflowingItem.content
        )
        // Print just this item on its own page
        const itemToPrint = [overflowingItem]
        const remainingItems = committedContent.slice(1)

        // Update committed content to only include the overflowing item
        committedContent = itemToPrint
        await tick() // Wait for DOM update

        // Print current page and continue with remaining items
        await printFile()
        // Clear the printed content before setting the remaining items
        committedContent = []
        await tick() // Wait for DOM update
        committedContent = remainingItems
        return
      }

      // Normal case - split at the overflowing item
      const itemsToPrint = committedContent.slice(0, index)
      const itemsForNextPage = committedContent.slice(index)

      // Print current page and continue with remaining items
      committedContent = itemsToPrint
      await tick() // Wait for DOM update
      await printFile()
      // Clear the printed content before setting the remaining items
      committedContent = []
      await tick() // Wait for DOM update
      committedContent = itemsForNextPage
    } finally {
      isHandlingOverflow = false
    }
  }

  async function printFile(): Promise<void> {
    console.log('🖨️ Starting print process')
    await tick() // Wait for DOM update

    try {
      const pageElement = document.querySelector('page')
      if (!pageElement) {
        console.error('❌ No page element found')
        isSuccessfulPrint = false
        return
      }

      // Remove any current elements before printing
      const currentElements = pageElement.querySelectorAll('.current')
      currentElements.forEach((element) => {
        element.remove()
        console.log('removed current element', element.textContent?.trim())
      })

      const pageContent = pageElement.innerHTML
      if (!pageContent || typeof pageContent !== 'string') {
        console.error('❌ Invalid page content')
        isSuccessfulPrint = false
        return
      }

      // Create a print request in the status bar
      const printId = printStatusBar?.addPrintRequest().toString() // Convert to string
      console.log(`📝 Created print request with ID: ${printId}`)

      console.log('Printing text: ', pageElement.textContent?.trim())
      if (!printId) return

      const printSettings: PrintSettings = {
        ...printerSettings,
        printId,
        silent: true,
        inlineStyle: $settings.inlineStyle,
        svgFilters: $settings.svgFilters
      }

      window.electron.ipcRenderer.send('print', pageContent, printSettings)
      committedContent = []
    } catch (error) {
      console.error('❌ Error during print:', error)
      isSuccessfulPrint = false
    }
  }

  // Initialize WebMidi
  WebMidi.enable().catch((err) => console.error('WebMidi could not be enabled:', err))

  // Listen for WebMidi events
  WebMidi.addListener('connected', (e) => {
    console.log('WebMidi device connected:', e)
    settings.setupControllers(WebMidi)
  })

  WebMidi.addListener('disconnected', (e) => {
    console.log('WebMidi device disconnected:', e)
  })

  // function openPDFFolder(): void {
  //   window.electronAPI.openPDFFolder()
  // }

  function clearAll(): void {
    console.log('🗑️ Clearing all content')
    committedContent = []
  }
</script>

<!-- svelte:head meta title -->
<svelte:head>
  <title>a-trans(crip)tion-live-coding-VJ-PDF-printing-tool</title>
</svelte:head>

<main>
  {#if currentContentList.length > 0}
    <div class="print-context">
      <page size="A3">
        <div class="content-context">
          {#each committedContent as item (item.id)}
            <item.type
              content={item.content}
              settings={item.settings}
              onOverflow={() => handleOverflow(item)}
            />
          {/each}
          {#if !isPrinting && currentSentence?.type}
            <currentSentence.type
              content={currentSentence.content}
              settings={$settings}
              isCurrent
            />
          {/if}
        </div>
      </page>
    </div>
  {/if}

  <div class="print-non" class:printFailed={!isSuccessfulPrint}>
    <div class="infobox">
      <div class="dot" class:greenDot={codeEditorContentSaved}></div>
      <CodeEditor
        bind:value={$settings.inlineStyle}
        language="css"
        controllerSettings={$settings.controllerSettings}
        svgFiltersCode={$settings.svgFilters}
        {fontFamilys}
      />

      <hr />

      <BlockTxt content="Text Preview" settings={$settings} />

      <hr />

      <select bind:value={fontFamilys}>
        {#each fontFamilys as fam}
          <option value={fam}>
            {fam.name}
          </option>
        {/each}
      </select>

      <ControllerManager bind:controllerSettings={$settings.controllerSettings}></ControllerManager>

      <hr />
      <div class="printControls">
        <button onclick={printFile}>PRINT</button>
        <button onclick={clearAll}>CLEAR ALL</button>
        <button onclick={() => window.electron.ipcRenderer.send('open-pdfs-folder')}>
          OPEN PDFs FOLDER
        </button>
        <input bind:value={printerSettings.deviceName} type="text" disabled />
        <label><input bind:checked={printerSettings.forcePrint} type="checkbox" />Force Print</label
        >
      </div>
      <hr />
      <CodeEditor
        bind:value={$settings.svgFilters}
        language="html"
        controllerSettings={$settings.controllerSettings}
        svgFiltersCode={$settings.svgFilters}
      />
      <div style="display: none">
        {@html $settings.svgFilters}
      </div>
      <TransInfoMessagesLog />
    </div>
  </div>

  <PrintStatusBar bind:this={printStatusBar} />
</main>

<svelte:window />

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
  }
  main {
    text-align: left;
    font-family: 'Garamondt-Regular', 'American Typewriter', monospace;
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

  page[size='A3'] {
    width: calc(297.3mm * 0.86);
    height: calc(420.2mm * 0.895);
    padding: 2cm;
    background: url('../scan.png');
    background-size: 100% 100%;
    outline: 1px solid red;
    position: fixed;
    top: 50%;
    left: 70%;
    transform: translate(-50%, -50%) scale(0.5) translate3d(0, 0, 0);
    z-index: 500;
    contain: strict;
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
