<script lang="ts">
    import { untrack } from 'svelte'

  interface Props {
    // Props
    scale?: number
    showControls?: boolean
    centered?: boolean
    children?: import('svelte').Snippet
  }

  let {
    scale = $bindable(1),
    showControls = true,
    centered = true,
    children
  }: Props = $props()

  // State
  let page: HTMLElement | undefined = $state()
  let pageContainer: HTMLElement | undefined = $state()
  let pageContext: HTMLElement | undefined = $state()

  function fittedToPage() {
    if (!page || !pageContext) return scale
    const pageRect = page.getBoundingClientRect()
    const contextRect = pageContext.getBoundingClientRect()
    const optimalScale = Math.min(
      (contextRect.width * 0.95) / (pageRect.width / scale),
      (contextRect.height * 0.95) / (pageRect.height / scale)
    )
    return optimalScale
  }

  function adjustedScale(delta: number) {
    return Math.max(0.1, Math.min(2, scale + delta))
  }

  $effect(() => {
    untrack(() => {
      scale = fittedToPage()
    })
  })
</script>

{#if showControls}
  <div id="scale-controls">
    <button onclick={() => scale = adjustedScale(-0.1)}>-</button>
    <span>{scale.toFixed(2)}</span>
    <button onclick={() => scale = adjustedScale(0.1)}>+</button>
    <button onclick={() => scale = fittedToPage()}>0</button>
  </div>
{/if}

<div class="page-context" class:centered bind:this={pageContext}>
  <div class="page-container" bind:this={pageContainer} style:transform={`scale(${scale})`}>
    <page size="A3" bind:this={page}>
      <div class="content-context">
        {@render children?.()}
      </div>
    </page>
  </div>
</div>

<style>

  #scale-controls {
    position: absolute;
    top: 10px;
    right: 20px;
    z-index: 1001;
    display: flex;
    gap: 10px;
    align-items: center;
  }

  #scale-controls button {
    padding: 5px 10px;
    cursor: pointer;
  }

  /* Page styles */
  .page-context {
    text-align: left;
    font-size: 2em;
    font-weight: 100;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    position: relative;
    overflow: hidden;
  }

  .page-context.centered {
    position: fixed;
    height: 100%;
    z-index: 500;
  }

  .content-context {
    height: 100%;
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
    background: url('../../scan.png'); /* this path is corrrect!!! */
    background-size: 100% 100%;
    transform-origin: center;
    transition: all 0.3s ease;
  }

  /* Container for maintaining aspect ratio and centering */
  .page-container {
    transform-origin: center;
    transition: all 0.3s ease;
  }

  @media print {
    :global(*) {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    page[size='A3'] {
      background: white;
    }

    #debug-info,
    #scale-controls {
      display: none;
    }
    .page-context {
      transform: none !important;
    }
    .page-container {
      transform: none !important;
    }
    page[size='A3'] {
      transform: none !important;
    }
  }
</style>
