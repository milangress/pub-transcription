<script lang="ts">
  import Page from './Page.svelte'

  
  interface Props {
    // Props
    scale?: number;
    onScaleChange?: any;
    showControls?: boolean;
    showDebug?: boolean;
    position?: string; // 'right', 'center', 'left'
    children?: import('svelte').Snippet;
  }

  let {
    scale = 1,
    onScaleChange = undefined,
    showControls = true,
    showDebug = false,
    position = 'right',
    children
  }: Props = $props();
</script>

<div
  class="page-wrapper"
  class:right={position === 'right'}
  class:center={position === 'center'}
  class:left={position === 'left'}
>
  <Page {scale} {onScaleChange} {showControls} {showDebug} centered={false}>
    {@render children?.()}
  </Page>
</div>

<style>
  .page-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .page-wrapper.right {
    justify-content: flex-end;
    padding-right: 2rem;
  }

  .page-wrapper.center {
    justify-content: center;
  }

  .page-wrapper.left {
    justify-content: flex-start;
    padding-left: 2rem;
  }

  @media print {
    .page-wrapper {
      transform: none !important;
    }
  }
</style>
