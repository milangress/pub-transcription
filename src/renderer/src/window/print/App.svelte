<script lang="ts">
  import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/renderer';
  import { onMount, tick } from 'svelte';
  import { printJobSchema, type PrintJob, type PrintRequest } from '../../../../types/index.js';
  import type { IpcEvents, IpcRendererEvent } from '../../../../types/ipc.js';

  const ipc = new IpcListener<IpcRendererEvent>();
  const emitter = new IpcEmitter<IpcEvents>();

  // eslint-disable-next-line no-undef
  let children = $state<NodeListOf<HTMLSpanElement> | null>(null);

  let currentPrintId = $state<string | null>(null);

  // Refs for DOM elements
  let printContainer: HTMLElement;

  // Content state
  let printContent = $state('');
  let svgFiltersContent = $state('');
  // Reference to the dynamically injected style element
  let styleElement: HTMLStyleElement | null = $state(null);

  class Status {
    #logs: { msg: string; error: boolean | Error; warning: boolean }[] = $state([
      {
        msg: 'Waiting for print job...',
        error: false,
        warning: false,
      },
    ]);

    #pushLog({
      msg,
      error = false,
      warning = false,
    }: {
      msg: string;
      error?: boolean | Error;
      warning?: boolean;
    }) {
      const entry = { msg, error, warning };
      this.#logs.push(entry);
    }

    #sideEffect(entry) {
      const time = new Date().toTimeString().split(' ')[0];
      const printIdTitle = currentPrintId ? `${currentPrintId} - ` : '';
      const message = `[${time}] ${printIdTitle}${entry.msg}`;
      document.title = message;
      if (entry.error) console.error(message);
      if (entry.warning) console.warn(message);
      console.log(message);
    }

    set msg(value: string) {
      this.#pushLog({ msg: value });
      this.#sideEffect(this.state);
    }

    set warn(value: string) {
      this.#pushLog({ msg: value, warning: true });
      this.#sideEffect(this.state);
    }

    set err(err: Error | string | unknown) {
      // TODO: send error back to main process
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.#pushLog({ msg: `${errorMsg}`, error: err instanceof Error ? err : true });
      this.#sideEffect(this.state);
    }

    get err(): Error {
      if (this.state.error instanceof Error) return this.state.error;
      return new Error(this.state.msg);
    }

    get state() {
      return this.#logs[this.#logs.length - 1];
    }
  }

  const status = new Status();

  async function executePrint(printRequest: PrintRequest) {
    currentPrintId = printRequest.printId;
    status.msg = 'ReadyToBePrinted:' + currentPrintId;

    try {
      await emitter.invoke('PrintWindow:ReadyToBePrinted', printRequest);
    } catch (error) {
      status.err = error;
    }
  }

  onMount(() => {
    status.msg = 'Print window initialized';

    // Handle print job setup
    ipc.on('PrintWindow:printJob', async (_event, printJobUnsave: PrintJob) => {
      try {
        const printJob = printJobSchema.parse(printJobUnsave);

        status.msg = `Processing: ${printJob.printId} (Attempt ${printJob.attempt}/${printJob.maxRetries})`;

        // Clear the container
        printContent = '';

        // Update styles
        if (printJob.pageContent.editorCss) {
          // Remove previous style element if it exists
          if (styleElement) {
            document.head.removeChild(styleElement);
          }

          // Create and inject new style element
          styleElement = document.createElement('style');
          styleElement.textContent = printJob.pageContent.editorCss;
          document.head.appendChild(styleElement);

          status.msg = `Styles loaded (${printJob.pageContent.editorCss.length} bytes)`;
        } else {
          status.warn = 'No inline styles provided for print job';
        }

        // Inject SVG filters if they exist
        if (printJob.pageContent.svgFilters) {
          status.msg = 'Adding SVG filters';
          svgFiltersContent = printJob.pageContent.svgFilters;
        } else {
          status.warn = 'No SVG filters provided for print job';
          svgFiltersContent = '';
        }

        // Set the content
        printContent = printJob.pageContent.html;

        // Wait for Svelte to update the DOM
        await tick();

        // Get child spans for debugging
        if (printContainer) {
          children = printContainer.querySelectorAll('span');

          if (children.length === 0) {
            status.warn = 'Print content contains no text spans';
          }
        }

        status.msg = 'Content loaded, waiting 5 seconds before print...';

        await new Promise((resolve) => setTimeout(resolve, 5000));

        status.msg = 'Printing...';

        console.log('Executing print with settings:', printJob);

        // Execute print with the same settings including printId
        await executePrint(printJob);
      } catch (error) {
        status.err = error;
      }
    });
  });
</script>

<div id="print-window-wrapper">
  <!-- SVG filters container-->
  {#if svgFiltersContent}
    <div id="svg-filters" style="display: none">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html svgFiltersContent}
    </div>
  {/if}

  <div class="page-context">
    <page size="A3">
      <div bind:this={printContainer} id="print-container">
        <!-- eslint-disable-next-line svelte/no-at-html-tags-->
        {@html printContent}
      </div>
    </page>
  </div>
</div>

<style>
  :global(body, html) {
    padding: 0;
    margin: 0;
    overflow: scroll;
  }

  .page-context {
    margin: 1cm;
  }

  page[size='A3'] {
    font-size: 2em;
    font-weight: 100;
    text-align: left;
    display: block;
    width: calc(297.3mm * 0.86);
    height: calc(420.2mm * 0.895);
    padding: 2cm;
    background: url('../../assets/scan.png');
    background-size: 100% 100%;
    outline: 1px solid red;
  }

  @media print {
    :global(body, html) {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    page[size='A3'] {
      background: white;
      outline: none;
    }
    .page-context {
      margin: 0;
    }
  }
</style>
