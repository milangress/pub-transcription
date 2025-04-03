<script lang="ts">
  import type { PrintStatusMessage } from '@preload/types.d.ts'
  import { onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import PrintStatus from './PrintStatus.svelte'

  interface StatusEmojis {
    LOCAL_REQUEST: string
    QUEUED: string
    PRINT_START: string
    PRINT_COMPLETE: {
      SUCCESS: string
      ERROR: string
    }
    PDF_SAVE: {
      SUCCESS: string
    }
    PRINT_ERROR: string
  }

  interface StatusEntry {
    emoji: string
    text: string
  }

  let printStatuses = $state(new Map<string, StatusEntry>());
  let successPrintCount = $state(0);
  let successPdfCount = $state(0);
  let failureCount = $state(0);

  // Status emoji mapping based on action and status
  const STATUS_EMOJIS: StatusEmojis = {
    LOCAL_REQUEST: '🥚',
    QUEUED: '🐣',
    PRINT_START: '🎀',
    PRINT_COMPLETE: {
      SUCCESS: '🖨️',
      ERROR: '🥵'
    },
    PDF_SAVE: {
      SUCCESS: '💦'
    },
    PRINT_ERROR: '🥵'
  }

  function updateStatus(printId: string, newStatus: string, text = ''): void {
    if (!printId) {
      console.warn('⚠️ Attempted to update status without printId')
      return
    }
    console.log(`🔄 Updating status for ${printId} to ${newStatus}${text ? ` (${text})` : ''}`)
    printStatuses.set(printId, { emoji: newStatus, text })
    printStatuses = new Map(printStatuses) // Create new Map to trigger reactivity
  }

  function scheduleSuccessCleanup(id: string, type: 'print' | 'PDF'): void {
    setTimeout(() => {
      printStatuses.delete(id)
      printStatuses = new Map(printStatuses) // Create new Map to trigger reactivity
      console.log(`🧹 Cleaned up successful ${type} status: ${id}`)
    }, 20000)
  }

  export function addPrintRequest(): number {
    const printId = Date.now()
    updateStatus(printId.toString(), STATUS_EMOJIS.LOCAL_REQUEST, 'Print request created')
    console.log(`🥚 Added new print request with ID: ${printId}`)
    return printId
  }

  // Add print request handler
  onMount(() => {
    window.electronAPI.onPrintQueued(
      (
        _event: Event,
        { success, error, printId }: { success: boolean; error?: string; printId: string }
      ) => {
        if (success) {
          updateStatus(printId, '🐣', 'Print job queued successfully')
        } else {
          updateStatus(printId, '🥵', `Print queue error: ${error}`)
        }
      }
    )

    window.electronAPI.onPrintStatus((_event: Event, message: PrintStatusMessage) => {
      const { id, action, status, ...details } = message
      let emoji = '❓'
      let text = 'Unknown status'

      switch (action) {
        case 'PRINT_START':
          emoji = '🎀'
          text = details.message || 'Starting print...'
          break
        case 'PRINT_COMPLETE':
          emoji = status === 'SUCCESS' ? '🖨️' : '🥵'
          text = details.message || (status === 'SUCCESS' ? 'Print complete' : 'Print failed')
          if (status === 'SUCCESS') {
            successPrintCount++
            scheduleSuccessCleanup(id, 'print')
          } else {
            failureCount++
          }
          break
        case 'PDF_SAVE':
          emoji = status === 'SUCCESS' ? '💦' : '🥵'
          text = details.message || (status === 'SUCCESS' ? 'PDF saved' : 'PDF save failed')
          if (status === 'SUCCESS') {
            successPdfCount++
            scheduleSuccessCleanup(id, 'PDF')
          } else {
            failureCount++
          }
          break
        case 'PRINT_ERROR':
          emoji = '🥵'
          text = details.message || 'Print error occurred'
          failureCount++
          break
      }

      updateStatus(id, emoji, text)
    })

    return () => {
      console.log('🛑 PrintStatusBar cleanup stopped')
    }
  })
</script>

<div class="status-bar">
  <div class="counter" title="Success Prints / Success PDFs / Failures">
    <span class="success">{successPrintCount}</span>/<span class="success">{successPdfCount}</span
    >/<span class="failure">{failureCount}</span>
  </div>
  {#each Array.from(printStatuses) as [printId, status] (printId)}
    <div transition:fly={{ y: 100, duration: 1000 }}>
      <PrintStatus {printId} {status} />
    </div>
  {/each}
</div>

<style>
  .status-bar {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    flex-direction: row-reverse;
    gap: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-width: 80vw;
    overflow-x: auto;
    backdrop-filter: blur(4px);
    overflow-y: hidden;
  }
  @media print {
    .status-bar {
      display: none;
    }
  }

  .counter {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 12px;
    font-size: 0.9em;
    font-family: monospace;
    font-weight: bold;
  }

  .success {
    color: #22c55e;
  }

  .failure {
    color: #ef4444;
  }

  /* Hide scrollbar but keep functionality */
  .status-bar::-webkit-scrollbar {
    display: none;
  }
  .status-bar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
