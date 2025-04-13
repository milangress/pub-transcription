<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    rows?: number;
    lines: string[];
    header?: Snippet;
  };

  let { rows = 10, lines, header }: Props = $props();

  // Container refs for virtual scrolling
  let containerRef = $state<HTMLDivElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);

  // Virtual scrolling state
  let scrollTop = $state(0);
  let containerHeight = $state(0);
  let lineHeight = $state(0);

  // Calculate visible range
  const visibleLines = $derived.by(() => {
    if (!lineHeight) return { start: 0, end: lines.length };

    const visibleRows = Math.ceil(containerHeight / lineHeight);
    const bufferRows = Math.ceil(visibleRows / 2); // Add half a page as buffer

    const startIndex = Math.max(0, Math.floor(scrollTop / lineHeight) - bufferRows);
    const endIndex = Math.min(
      lines.length,
      Math.ceil((scrollTop + containerHeight) / lineHeight) + bufferRows,
    );

    return {
      start: startIndex,
      end: endIndex,
    };
  });

  // Calculate padding to maintain scroll position
  const padding = $derived.by(() => ({
    top: visibleLines.start * lineHeight,
    bottom: (lines.length - visibleLines.end) * lineHeight,
  }));

  // Handle scroll events
  function onScroll(event: Event) {
    const target = event.target as HTMLDivElement;
    scrollTop = target.scrollTop;
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
</script>

<div class="log-output" bind:this={containerRef} onscroll={onScroll} style:--rows={rows}>
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
    {#each lines.slice(visibleLines.start, visibleLines.end) as line, i (visibleLines.start + i)}
      <div class="log-line">
        {line}
      </div>
    {/each}
  </div>
</div>

<style>
  .log-output {
    background-color: #000;
    color: #fff;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', monospace;
    font-size: var(--font-size-sm);
    line-height: 1.5;
    height: calc(var(--rows) * 1.5em);
    overflow-y: auto;
    contain: strict;
    border: var(--border-width) solid var(--border-color);
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
    width: 12px;
  }

  .log-output::-webkit-scrollbar-track {
    background: #1a1a1a;
  }

  .log-output::-webkit-scrollbar-thumb {
    background-color: #333;
    border: 3px solid #1a1a1a;
    border-radius: 6px;
  }

  .log-output::-webkit-scrollbar-thumb:hover {
    background-color: #444;
  }
</style>
