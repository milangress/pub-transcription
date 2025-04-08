<script lang="ts">
  import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/renderer';
  import { printJobSchema, type PrintJob } from 'src/types/index';
  import type { IpcEvents, IpcRendererEvent } from 'src/types/ipc';
  import { onMount } from 'svelte';
  import LogContainer from './components/LogContainer.svelte';
  import PageWrapper from './components/PageSimulatorWrapper.svelte';
  const ipc = new IpcListener<IpcRendererEvent>();
  const emitter = new IpcEmitter<IpcEvents>();

  let status = $state('Waiting for print job...');
  let lastJobTime = $state('Never');
  let stylesLoaded = $state('No');
  // eslint-disable-next-line no-undef
  let children = $state<NodeListOf<HTMLSpanElement> | null>(null);
  let printLogs = $state<
    Array<{
      timestamp: string;
      message: string;
      pdfUrl: string | null;
      spanCount: number | null;
      type: string;
      printId: string | null;
    }>
  >([]);
  let currentPrintId = $state<string | null>(null);
  let isPrintPreview = $state(false);
  let currentAttempt = $state(0);
  let maxRetries = $state(0);
  let queueLength = $state(0);
  let isQueueProcessing = $state(false);
  let printStartTime = $state<number | null>(null);

  function addLogEntry(
    message: string,
    pdfUrl: string | null = null,
    spanCount: number | null = null,
    type = 'client',
  ) {
    const timestamp = new Date().toLocaleTimeString();
    printLogs = [
      ...printLogs,
      {
        timestamp,
        message,
        pdfUrl,
        spanCount,
        type,
        printId: currentPrintId,
      },
    ];
  }

  function updateLogEntryWithPdfUrl(printId: string, pdfUrl: string) {
    printLogs = printLogs.map((log) => {
      if (log.printId === printId) {
        return { ...log, pdfUrl };
      }
      return log;
    });
  }

  async function executePrint(printJobUnsave: PrintJob) {
    const printJob = printJobSchema.parse(printJobUnsave);
    currentPrintId = printJob.printId;
    console.log('Executing print with ID:', currentPrintId);

    try {
      await emitter.invoke('PrintWindow:ReadyToBePrinted', printJob);
      // Status updates will come from main process
    } catch (error) {
      console.error('Print error:', error);
      const message = error instanceof Error ? error.message : String(error);
      addLogEntry(`Error: ${message}`, null, null, 'error');
      throw error instanceof Error ? error : new Error(String(error)); // Propagate error for queue handling
    }
  }

  onMount(() => {
    console.log('Print window initialized');

    // Listen for print status updates
    ipc.on('print-status', (_event, data) => {
      console.log('Print status update:', data);

      if (!data?.id) {
        console.warn('Received print status without ID:', data);
        return;
      }

      const { action, status: printStatus, message, id } = data;
      currentPrintId = id;

      // Update status based on action and status
      switch (action) {
        case 'PRINT_START':
          status = message || 'Starting print job...';
          lastJobTime = new Date().toLocaleTimeString();
          addLogEntry(message || 'Print job started', null, null, 'server');
          break;

        case 'PRINT_COMPLETE':
          if (printStatus === 'SUCCESS') {
            const duration = printStartTime
              ? ((Date.now() - printStartTime) / 1000).toFixed(2)
              : '0.00';
            status = message || `Print completed successfully (${duration}s)`;
            addLogEntry(
              message || `Print completed successfully (${duration}s)`,
              null,
              children?.length,
              'server',
            );
          } else {
            status = message || 'Print failed';
            addLogEntry(message || 'Print failed', null, null, 'server');
          }
          printStartTime = null;
          break;

        case 'PDF_SAVE':
          if (printStatus === 'SUCCESS' && message) {
            const pdfPath = message.match(/to (.+)$/)?.[1];
            if (pdfPath) {
              updateLogEntryWithPdfUrl(id, `file://${pdfPath}`);
              addLogEntry('PDF saved successfully', `file://${pdfPath}`, null, 'server');
            }
          }
          break;

        case 'PRINT_ERROR':
          status = message || 'Print error occurred';
          addLogEntry(message || 'Print error occurred', null, null, 'server');
          printStartTime = null;
          break;
      }
    });

    // Also add back server message handling for transcription status
    ipc.on('whisper-ccp-stream:status', (_event, message) => {
      if (typeof message === 'string') {
        addLogEntry(message, null, null, 'server');
      }
    });

    // Handle print job setup
    ipc.on('PrintWindow:printJob', async (_event, printJobUnsave: PrintJob) => {
      try {
        const newPrintJob = printJobSchema.parse(printJobUnsave);
        console.log('onPrintJob', newPrintJob);

        // Set current print ID first
        currentPrintId = newPrintJob.printId;
        currentAttempt = newPrintJob.attempt;
        maxRetries = newPrintJob.maxRetries;
        printStartTime = Date.now();

        console.log(
          `Processing print job with ID: ${currentPrintId} (Attempt ${currentAttempt}/${maxRetries})`,
        );

        status = `Processing print job (Attempt ${currentAttempt}/${maxRetries})`;
        lastJobTime = new Date().toLocaleTimeString();
        addLogEntry(`Processing print job (Attempt ${currentAttempt}/${maxRetries})`);

        // Get the container
        const container = document.getElementById('print-container');
        if (!container) {
          throw new Error('Print container not found');
        }
        container.innerHTML = '';

        // Inject any dynamic styles
        if (newPrintJob.pageContent.inlineStyle) {
          const styleSheet = document.createElement('style');
          styleSheet.textContent = newPrintJob.pageContent.inlineStyle;
          document.head.appendChild(styleSheet);

          // Update styles loaded status
          const styleLength = newPrintJob.pageContent.inlineStyle.length;
          stylesLoaded = `Yes - ${styleLength} - ${new Date().toLocaleTimeString()}`;
          addLogEntry(`Styles loaded (${styleLength} bytes)`);
        } else {
          console.warn('No inline styles provided for print job');
          stylesLoaded = 'No';
        }

        // Inject SVG filters if they exist
        if (newPrintJob.pageContent.svgFilters) {
          console.log('Adding SVG filters');
          // reuse the same div for all svg filters
          let filtersDiv = document.getElementById('svg-filters');
          if (!filtersDiv) {
            filtersDiv = document.createElement('div');
            filtersDiv.id = 'svg-filters';
            filtersDiv.style.display = 'none';
            document.body.appendChild(filtersDiv);
          }
          filtersDiv.innerHTML = newPrintJob.pageContent.svgFilters;
        } else {
          console.warn('No SVG filters provided for print job');
        }

        // Set the content
        container.innerHTML = newPrintJob.pageContent.html;
        children = container.querySelectorAll('span');

        if (children && children.length === 0) {
          console.warn('Print content contains no text spans');
        }

        status = 'Content loaded, waiting 5 seconds before print...';
        addLogEntry('Content loaded, preparing to print', null, children?.length ?? 0);

        // Wait for debug/inspection
        await new Promise((resolve) => setTimeout(resolve, 5000));

        status = 'Printing...';
        addLogEntry('Starting print process...', null, children?.length ?? 0);

        console.log('Executing print with settings:', newPrintJob);

        // Execute print with the same settings including printId
        await executePrint(newPrintJob);
      } catch (error) {
        console.error('Print job error:', error);
        const message = error instanceof Error ? error.message : String(error);
        status = `Error: ${message}`;
        addLogEntry(`Error: ${message}`, null, null, 'error');
      }
    });

    // Handle queue status updates
    ipc.on('queue-status', (_event, status) => {
      console.log('Queue status update:', status);
      queueLength = status.queueLength || 0;
      isQueueProcessing = status.isProcessing;

      // Update status message based on queue state
      if (queueLength > 0) {
        if (isQueueProcessing) {
          addLogEntry(`Processing print queue (${queueLength} remaining)`, null, null, 'server');
        } else {
          addLogEntry(`Print queue paused (${queueLength} pending)`, null, null, 'server');
        }
      } else if (queueLength === 0 && !isQueueProcessing) {
        addLogEntry('Print queue empty', null, null, 'server');
      }
    });
  });
</script>

<div id="print-window-wrapper">
  <div id="print-debug-info" class="debug-info">
    <div class="debug-row">
      <div class="debug-info-left">
        <div>Status: <span>{status}</span></div>
        <div>Last job received: <span>{lastJobTime}</span></div>
        <div>Styles loaded: <span>{stylesLoaded}</span></div>
        <div>Spans: <span>{children ? children.length : 0}</span></div>
        {#if currentAttempt > 1}
          <div class="retry-info">Retry attempt: <span>{currentAttempt}/{maxRetries}</span></div>
        {/if}
        <div class="queue-info">
          Queue: <span class:active={isQueueProcessing}
            >{queueLength} job{queueLength !== 1 ? 's' : ''}
            {isQueueProcessing ? '(processing)' : ''}</span
          >
        </div>
      </div>
      <div class="debug-controls"></div>
    </div>
  </div>

  <div class="page-container-wrapper">
    <PageWrapper showControls={!isPrintPreview} position="center">
      <div id="print-container"></div>
    </PageWrapper>
  </div>

  <div id="print-log-container" class="debug-info">
    <LogContainer logs={printLogs} />
  </div>
</div>

<style>
  :global(body, html) {
    padding: 0;
    margin: 0;
  }
  #print-window-wrapper {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  #print-debug-info {
    flex: 0 0 auto;
    background: #f0f0f0;
    padding: 10px;
    border-bottom: 1px solid #ccc;
    font-family: monospace;
    z-index: 1000;
  }

  .debug-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .debug-info-left {
    flex: 1;
  }

  .debug-controls {
    flex-shrink: 0;
    margin-left: 16px;
  }

  .page-container-wrapper {
    flex: 1;
    position: relative;
    height: 0;
    min-height: 0;
    overflow: hidden;
  }

  @media print {
    #print-debug-info,
    #print-log-container {
      display: none;
    }
    .debug-info {
      display: none;
    }
  }

  .retry-info {
    color: #ff9800;
    font-weight: bold;
  }

  .queue-info {
    margin-top: 4px;
  }

  .queue-info span {
    color: #666;
  }

  .queue-info span.active {
    color: #2196f3;
    font-weight: bold;
  }
</style>
