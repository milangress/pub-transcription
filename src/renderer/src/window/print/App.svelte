<script>
  import { onMount } from 'svelte'
  import LogContainer from '../../components/print-window/LogContainer.svelte'
  import PreviewButton from '../../components/ui/PreviewButton.svelte'
  import PageWrapper from '../shared/page/PageWrapper.svelte'

  let status = 'Waiting for print job...'
  let lastJobTime = 'Never'
  let stylesLoaded = 'No'
  let currentScale = 1
  let children = 0
  let printLogs = []
  let currentPrintId = null
  let isPrintPreview = false
  let previewTimer
  let currentAttempt = 0
  let maxRetries = 0
  let queueLength = 0
  let isQueueProcessing = false
  let printStartTime = null

  function addLogEntry(message, pdfUrl = null, spanCount = null, type = 'client') {
    const timestamp = new Date().toLocaleTimeString()
    printLogs = [
      {
        timestamp,
        message,
        pdfUrl,
        spanCount,
        type,
        printId: currentPrintId
      },
      ...printLogs
    ]
  }

  function updateLogEntryWithPdfUrl(printId, pdfUrl) {
    printLogs = printLogs.map((log) => {
      if (log.printId === printId) {
        return { ...log, pdfUrl }
      }
      return log
    })
  }

  async function togglePrintPreview() {
    try {
      isPrintPreview = true
      addLogEntry('Print preview started')

      // Clear any existing timer
      if (previewTimer) {
        clearTimeout(previewTimer)
        previewTimer = null
      }

      // Enable print media emulation
      const success = await window.electronAPI.togglePrintPreview(true)
      if (!success) {
        addLogEntry('Failed to start print preview', null, null, 'server')
        isPrintPreview = false
        return
      }

      // Set new timer
      previewTimer = setTimeout(async () => {
        try {
          // Disable print media emulation
          const disableSuccess = await window.electronAPI.togglePrintPreview(false)
          if (!disableSuccess) {
            addLogEntry('Failed to end print preview', null, null, 'server')
          } else {
            addLogEntry('Print preview ended')
          }
        } catch (error) {
          console.error('Preview end error:', error)
          addLogEntry(`Preview end error: ${error.message}`, null, null, 'server')
        } finally {
          isPrintPreview = false
          previewTimer = null
        }
      }, 5000)
    } catch (error) {
      console.error('Preview error:', error)
      addLogEntry(`Preview error: ${error.message}`, null, null, 'server')
      isPrintPreview = false
      if (previewTimer) {
        clearTimeout(previewTimer)
        previewTimer = null
      }
    }
  }

  async function executePrint(content, settings) {
    if (!settings?.printId) {
      throw new Error('Print ID is required')
    }

    currentPrintId = settings.printId
    console.log('📝 Executing print with ID:', currentPrintId)

    try {
      await window.electronAPI.executePrint(content, settings)
      // Status updates will come from main process
    } catch (error) {
      console.error('❌ Print error:', error)
      addLogEntry(`Error: ${error.message}`, null, null, 'error')
      throw error // Propagate error for queue handling
    }
  }

  onMount(() => {
    console.log('🖨️ Print window initialized')

    // Listen for print status updates
    window.electronAPI.onPrintStatus((_event, data) => {
      console.log('📥 Print status update:', data)

      if (!data?.id) {
        console.warn('⚠️ Received print status without ID:', data)
        return
      }

      const { action, status: printStatus, message, id } = data
      currentPrintId = id

      // Update status based on action and status
      switch (action) {
        case 'PRINT_START':
          status = message || 'Starting print job...'
          lastJobTime = new Date().toLocaleTimeString()
          addLogEntry(message || 'Print job started', null, null, 'server')
          break

        case 'PRINT_COMPLETE':
          if (printStatus === 'SUCCESS') {
            const duration = ((Date.now() - printStartTime) / 1000).toFixed(2)
            status = message || `🖨️ Print completed successfully (${duration}s)`
            addLogEntry(
              message || `Print completed successfully (${duration}s)`,
              null,
              children?.length,
              'server'
            )
          } else {
            status = message || '❌ Print failed'
            addLogEntry(message || 'Print failed', null, null, 'server')
          }
          printStartTime = null
          break

        case 'PDF_SAVE':
          if (printStatus === 'SUCCESS' && message) {
            const pdfPath = message.match(/to (.+)$/)?.[1]
            if (pdfPath) {
              updateLogEntryWithPdfUrl(id, `file://${pdfPath}`)
              addLogEntry('PDF saved successfully', `file://${pdfPath}`, null, 'server')
            }
          }
          break

        case 'PRINT_ERROR':
          status = message || '❌ Print error occurred'
          addLogEntry(message || 'Print error occurred', null, null, 'server')
          printStartTime = null
          break
      }
    })

    // Also add back server message handling for transcription status
    window.electronAPI.onTranscriptionStatus((_event, message) => {
      if (typeof message === 'string') {
        addLogEntry(message, null, null, 'server')
      }
    })

    // Handle print job setup
    window.electronAPI.onPrintJob(
      async (_event, { content, settings = {}, attempt, maxRetries: maxRetriesVal }) => {
        try {
          console.log('onPrintJob', { content, settings, attempt, maxRetriesVal })
          debugger
          // Validate essential data
          if (!settings?.printId) {
            console.error('❌ Print job received without printId:', settings)
            throw new Error('Print job received without printId')
          }

          // Set current print ID first
          currentPrintId = settings.printId
          currentAttempt = attempt || 1
          maxRetries = maxRetriesVal || 1
          printStartTime = Date.now()

          if (!content) {
            const error = new Error('Print job received without content')
            console.error('❌', error.message)
            addLogEntry(error.message, null, null, 'error')
            throw error
          }

          console.log(
            `🖨️ Processing print job with ID: ${currentPrintId} (Attempt ${currentAttempt}/${maxRetries})`
          )
          status = `Processing print job (Attempt ${currentAttempt}/${maxRetries})`
          lastJobTime = new Date().toLocaleTimeString()
          addLogEntry(`Processing print job (Attempt ${currentAttempt}/${maxRetries})`)

          // Get the container
          const container = document.getElementById('print-container')
          container.innerHTML = ''

          // Inject any dynamic styles
          if (settings?.inlineStyle) {
            const styleSheet = document.createElement('style')
            styleSheet.textContent = settings.inlineStyle
            document.head.appendChild(styleSheet)

            // Update styles loaded status
            const styleLength = settings.inlineStyle.length
            stylesLoaded = `Yes - ${styleLength} - ${new Date().toLocaleTimeString()}`
            addLogEntry(`Styles loaded (${styleLength} bytes)`)
          } else {
            console.warn('⚠️ No inline styles provided for print job')
            stylesLoaded = 'No'
          }

          // Inject SVG filters if they exist
          if (settings?.svgFiltersCode) {
            console.log('🎨 Adding SVG filters')
            // reuse the same div for all svg filters
            let filtersDiv = document.getElementById('svg-filters')
            if (!filtersDiv) {
              filtersDiv = document.createElement('div')
              filtersDiv.id = 'svg-filters'
              filtersDiv.style.display = 'none'
              document.body.appendChild(filtersDiv)
            }
            filtersDiv.innerHTML = settings.svgFiltersCode
          } else {
            console.warn('⚠️ No SVG filters provided for print job')
          }

          // Set the content
          container.innerHTML = content
          children = container.querySelectorAll('span')

          if (children.length === 0) {
            console.warn('⚠️ Print content contains no text spans')
          }

          status = 'Content loaded, waiting 5 seconds before print...'
          addLogEntry('Content loaded, preparing to print', null, children.length)

          // Wait for debug/inspection
          await new Promise((resolve) => setTimeout(resolve, 5000))

          status = 'Printing...'
          addLogEntry('Starting print process...', null, children.length)

          console.log('Executing print with settings:', { ...settings, printId: currentPrintId })

          // Execute print with the same settings including printId
          await executePrint(container.innerHTML, settings)
        } catch (error) {
          console.error('❌ Print job error:', error)
          status = `Error: ${error.message}`
          addLogEntry(`Error: ${error.message}`, null, null, 'error')
        }
      }
    )

    // Handle queue status updates
    window.electronAPI.onQueueStatus((_event, status) => {
      console.log('📊 Queue status update:', status)
      queueLength = status.queueLength || 0
      isQueueProcessing = status.isProcessing

      // Update status message based on queue state
      if (queueLength > 0) {
        if (isQueueProcessing) {
          addLogEntry(`Processing print queue (${queueLength} remaining)`, null, null, 'server')
        } else {
          addLogEntry(`Print queue paused (${queueLength} pending)`, null, null, 'server')
        }
      } else if (queueLength === 0 && !isQueueProcessing) {
        addLogEntry('Print queue empty', null, null, 'server')
      }
    })

    return () => {
      if (previewTimer) {
        clearTimeout(previewTimer)
        previewTimer = null
      }
      window.electronAPI.togglePrintPreview(false).catch((error) => {
        console.error('Failed to disable print preview on unmount:', error)
      })
    }
  })
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
      <div class="debug-controls">
        <PreviewButton {isPrintPreview} onClick={togglePrintPreview} />
      </div>
    </div>
  </div>

  <div class="page-container-wrapper">
    <PageWrapper
      scale={currentScale}
      onScaleChange={(newScale) => (currentScale = newScale)}
      showControls={!isPrintPreview}
      showDebug={false}
      position="center"
    >
      <div id="print-container"></div>
    </PageWrapper>
  </div>

  <div id="print-log-container" class="debug-info">
    <LogContainer logs={printLogs} />
  </div>
</div>

<style>
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
