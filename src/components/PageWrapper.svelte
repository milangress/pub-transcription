<script>
    import Page from './Page.svelte';
    
    // Props
    export let scale = 1;
    export let onScaleChange = undefined;
    export let showControls = true;
    export let showDebug = false;
    export let position = 'right'; // 'right', 'center', 'left'
</script>

<div class="page-wrapper" class:right={position === 'right'} class:center={position === 'center'} class:left={position === 'left'}>
    <Page 
        {scale}
        {onScaleChange}
        {showControls}
        {showDebug}
        centered={false}
    >
        <slot></slot>
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
</style> 