<script lang="ts">
  import { run } from 'svelte/legacy'

  import { onMount } from 'svelte'

  let { logs = $bindable([]) } = $props()
  let logContainer: HTMLDivElement = $state()
  let shouldAutoScroll = $state(true)
  let previousLogsLength = $state(logs.length)
  const MAX_STORED_LOGS = 200
  let isFirstLoad = $state(true)

  let previousLogs = $state([])

  // Load saved logs on mount
  onMount(async () => {
    try {
      const savedLogs = (await window.electronAPI.getStoreValue('printLogs')) || []
      if (savedLogs.length > 0) {
        // Add session divider only on first load
        const sessionDivider = {
          timestamp: new Date().toLocaleTimeString(),
          message: '---------------- Previous Session ----------------',
          type: 'divider',
          isOldSession: true
        }

        // Mark all saved logs as old session
        const oldLogs = savedLogs.map((log) => ({
          ...log,
          isOldSession: true
        }))

        previousLogs = [...oldLogs, sessionDivider]
        previousLogsLength = previousLogs.length
        isFirstLoad = false

        // Initial scroll to bottom
        requestAnimationFrame(() => {
          scrollToBottom()
        })
      }
    } catch (error) {
      console.error('Failed to load saved logs:', error)
    }
  })

  // Check if user is near bottom
  function isNearBottom() {
    if (!logContainer) return true
    const threshold = 150
    const position = logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight
    return position <= threshold
  }

  // Handle scroll events
  function handleScroll() {
    shouldAutoScroll = isNearBottom()
  }

  // Toggle auto-scroll
  function toggleAutoScroll() {
    shouldAutoScroll = !shouldAutoScroll
    if (shouldAutoScroll) {
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
  }

  function scrollToBottom() {
    if (!logContainer) return
    logContainer.scrollTop = logContainer.scrollHeight
  }

  // Clear logs function
  async function clearLogs() {
    if (confirm('Are you sure you want to clear all logs?')) {
      logs = []
      await window.electronAPI.setStoreValue('printLogs', [])
    }
  }
  let mergedLogs = $derived([...previousLogs, ...logs])
  // Save logs when they change
  run(() => {
    if (mergedLogs.length !== previousLogsLength) {
      // Save all logs including dividers
      const logsToStore = mergedLogs.slice(-MAX_STORED_LOGS)
      window.electronAPI
        .setStoreValue('printLogs', logsToStore)
        .catch((error) => console.error('Failed to save logs:', error))
      previousLogsLength = mergedLogs.length

      // If auto-scroll is enabled, scroll after the DOM updates
      if (shouldAutoScroll) {
        requestAnimationFrame(() => {
          scrollToBottom()
        })
      }
    }
  })
</script>

<div class="print-log">
  <div class="log-header">
    <div class="log-title">Print Job Log</div>
    <div class="log-controls">
      <button
        class="auto-scroll-toggle"
        class:active={shouldAutoScroll}
        onclick={toggleAutoScroll}
        title={shouldAutoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
      >
        {shouldAutoScroll ? '📌 Auto-scroll on' : '🔓 Auto-scroll off'}
      </button>
      <button class="clear-logs-btn" onclick={clearLogs} title="Clear all logs"> 🗑️ </button>
      <div class="log-count">{mergedLogs.length} entries ({logs.length} fresh)</div>
    </div>
  </div>
  <div class="log-container" bind:this={logContainer} onscroll={handleScroll}>
    {#each mergedLogs as log}
      <div
        class="log-entry"
        class:server-message={log.type === 'server'}
        class:old-session={log.isOldSession}
        class:session-divider={log.type === 'divider'}
      >
        <span class="log-timestamp">[{log.timestamp}]</span>
        <span class="log-message">{log.message}</span>
        <div class="log-details">
          {#if log.spanCount !== null && log.spanCount !== undefined}
            <span class="span-count" class:span-count-zero={log.spanCount === 0}
              >{log.spanCount} spans</span
            >
          {/if}
          {#if log.pdfUrl}
            <a href={log.pdfUrl} target="_blank" class="pdf-link">View PDF</a>
          {/if}
          {#if log.type === 'server'}
            <span class="server-badge">Server</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .print-log {
    flex: 0 0 auto;
    background: #f0f0f0;
    border-top: 1px solid #ccc;
    font-family: monospace;
    padding: 8px;
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .log-controls {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .auto-scroll-toggle {
    font-size: 0.8em;
    padding: 2px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    color: #666;
  }

  .auto-scroll-toggle:hover {
    background: #f8f8f8;
  }

  .auto-scroll-toggle.active {
    background: #e6f3ff;
    border-color: #007bff;
    color: #007bff;
  }

  .log-title {
    font-weight: bold;
  }

  .log-count {
    font-size: 0.9em;
    color: #666;
  }

  .log-container {
    height: calc(5 * (1.2em + 4px + 4px)); /* 5 entries: line-height + padding */
    overflow-y: auto;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px;
  }

  .log-entry {
    font-size: 0.9em;
    padding: 2px 0;
    margin: 2px 0;
    color: #444;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 1.2em;
  }

  .server-message {
    background: #7afd94;
  }

  .log-timestamp {
    color: #666;
    flex-shrink: 0;
  }

  .log-message {
    flex: 1;
  }

  .log-details {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
  }

  .span-count {
    color: #666;
    font-size: 0.8em;
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .span-count-zero {
    color: #ffffff;
    background: #ff0000;
  }

  .server-badge {
    color: #ffffff;
    font-size: 0.8em;
    background: #09dd13;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 500;
  }

  .pdf-link {
    background: #007bff;
    color: white;
    text-decoration: none;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8em;
    flex-shrink: 0;
  }

  .pdf-link:hover {
    background: #0056b3;
  }

  .clear-logs-btn {
    font-size: 0.8em;
    padding: 2px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    color: #666;
  }

  .clear-logs-btn:hover {
    background: #fff0f0;
    border-color: #ff4444;
    color: #ff4444;
  }

  .old-session {
    opacity: 0.7;
    background: #fafafa;
  }

  .old-session:hover {
    opacity: 1;
  }

  .session-divider {
    text-align: center;
    color: #999;
    font-style: italic;
    background: #f5f5f5;
    border-top: 1px dashed #ddd;
    border-bottom: 1px dashed #ddd;
  }

  .session-divider .log-timestamp {
    opacity: 0.5;
  }

  .session-divider .log-message {
    text-align: center;
  }
  @media print {
    .log-container {
      display: none;
    }
  }
</style>
