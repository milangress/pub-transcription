<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { useDebounce } from '../hooks/useDebounce.svelte';
  type Props = {
    rows?: number;
    lines: string[];
    header?: Snippet;
  };

  let { rows = 10, header, lines }: Props = $props();

  let debouncedLogLines = useDebounce(lines, 500);

  export function setLines(newLines: string[]) {
    debouncedLogLines.update(newLines);
  }
  $effect(() => {
    if (lines) {
      untrack(() => {
        setLines(lines);
      });
    }
  });

  // Container refs for virtual scrolling
  let containerRef = $state<HTMLDivElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);

  // Virtual scrolling state
  let scrollTop = $state(0);
  let containerHeight = $state(0);
  let lineHeight = $state(0);
  let hasNewMessages = $state(false);
  let shouldScrollToBottom = $state(false);

  // Calculate visible range
  const visibleLines = $derived.by(() => {
    if (!lineHeight) return { start: 0, end: debouncedLogLines.value.length };

    const visibleRows = Math.ceil(containerHeight / lineHeight);
    const bufferRows = Math.ceil(visibleRows / 2); // Add half a page as buffer

    const startIndex = Math.max(0, Math.floor(scrollTop / lineHeight) - bufferRows);
    const endIndex = Math.min(
      debouncedLogLines.value.length,
      Math.ceil((scrollTop + containerHeight) / lineHeight) + bufferRows,
    );

    return {
      start: startIndex,
      end: endIndex,
      isNearBottom: debouncedLogLines.value.length - endIndex < 1,
    };
  });

  $effect(() => {
    checkForNewMessages(debouncedLogLines.value.length);
  });

  function checkForNewMessages(linesLenght: number) {
    if (visibleLines.end < linesLenght - 1) {
      hasNewMessages = true;
    }
  }

  // Calculate padding to maintain scroll position
  const padding = $derived.by(() => ({
    top: visibleLines.start * lineHeight,
    bottom: (debouncedLogLines.value.length - visibleLines.end) * lineHeight,
  }));

  // Handle scroll events
  function onScroll(event: Event) {
    shouldScrollToBottom = false;
    const target = event.target as HTMLDivElement;
    scrollTop = target.scrollTop;

    // Clear new messages indicator when scrolled to bottom
    if (visibleLines.isNearBottom) {
      hasNewMessages = false;
      shouldScrollToBottom = true;
    }
  }

  // Initialize measurements after mount
  function initMeasurements(node: HTMLDivElement) {
    const update = () => {
      const lineEl = node.querySelector('.log-line');
      if (lineEl) {
        lineHeight = lineEl.getBoundingClientRect().height;
      }
      containerHeight = containerRef?.clientHeight ?? 0;
    };

    // Initial measurement
    update();

    // Update on resize
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(node);

    return {
      destroy() {
        resizeObserver.disconnect();
      },
    };
  }

  // Auto-scroll to bottom when near bottom and new lines are added
  $effect(() => {
    if (containerRef && visibleLines.isNearBottom && shouldScrollToBottom) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  });
</script>

<div
  class="log-output"
  class:has-new-messages={hasNewMessages}
  bind:this={containerRef}
  onscroll={onScroll}
  style:--rows={rows}
>
  {#if header}
    <div class="log-header">
      {@render header()}
    </div>
  {/if}

  <div
    class="log-content"
    bind:this={contentRef}
    style:padding-top="{padding.top}px"
    style:padding-bottom="{padding.bottom}px"
    use:initMeasurements
  >
    {#each debouncedLogLines.value.slice(visibleLines.start, visibleLines.end) as line, i (visibleLines.start + i)}
      <div class="log-line">
        {line}
      </div>
    {/each}
  </div>
</div>

<style>
  .log-output {
    background-color: rgb(255, 255, 255);
    color: #000000;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', monospace;
    font-size: var(--font-size-sm);
    line-height: 1.5;
    height: calc(var(--rows) * 1.5em);
    overflow-y: auto;
    contain: strict;
    border: var(--border-width) solid var(--border-color);
  }

  .log-output.has-new-messages {
    border-bottom: 3px solid var(--accent-color);
  }

  .log-header {
    position: sticky;
    top: 0;
    background-color: #000;
    padding: var(--spacing-sm);
    border-bottom: var(--border-width) solid var(--border-color);
    z-index: 10;
    contain: content;
  }

  .log-content {
    padding: var(--spacing-sm);
    contain: content;
  }

  .log-line {
    white-space: pre;
    contain: content;
  }

  /* Style scrollbar for better visibility */
  .log-output::-webkit-scrollbar {
    width: 16px;
  }

  .log-output::-webkit-scrollbar-track {
    background: transparent;
    border-left: 1px solid var(--border-color);
  }

  .log-output::-webkit-scrollbar-thumb {
    background-color: var(--accent-color);
    border: 3px solid var(--accent-color);
    border-radius: 6px;
    width: 16px;
    height: 23px;
  }

  .log-output::-webkit-scrollbar-thumb:hover {
    background-color: var(--accent-color-hover);
  }
</style>
