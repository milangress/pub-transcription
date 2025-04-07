<script lang="ts">
  import Page from './PageSimulator.svelte'

  interface Props {
    // Props
    scale?: number
    showControls?: boolean
    position?: string // 'right', 'center', 'left'
    children?: import('svelte').Snippet
  }

  let {
    scale = 1,
    showControls = true,
    position = 'right',
    children
  }: Props = $props()
</script>

<div
  class="page-wrapper"
  class:right={position === 'right'}
  class:center={position === 'center'}
  class:left={position === 'left'}
>
  <Page {scale} {showControls} centered={false}>
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
