<script>
    import { onMount } from 'svelte';

    // Props
    export let scale = 1;
    export let onScaleChange = undefined;
    export let showControls = true;
    export let showDebug = false;
    export let centered = true;

    // State
    let page;
    let pageContainer;
    let status = 'Ready';
    let lastUpdate = 'Never';

    // Reactive statements
    $: if (page && pageContainer && scale) {
        status = `Scale: ${scale.toFixed(2)}`;
        lastUpdate = new Date().toLocaleTimeString();
    }

    function adjustScale(delta) {
        const newScale = Math.max(0.1, Math.min(2, scale + delta));
        if (onScaleChange) {
            onScaleChange(newScale);
        } else {
            scale = newScale;
        }
    }
</script>

{#if showDebug}
    <div id="debug-info">
        <div>Status: <span>{status}</span></div>
        <div>Last update: <span>{lastUpdate}</span></div>
    </div>
{/if}

{#if showControls}
    <div id="scale-controls">
        <button on:click={() => adjustScale(-0.1)}>-</button>
        <span>{scale.toFixed(1)}</span>
        <button on:click={() => adjustScale(0.1)}>+</button>
    </div>
{/if}

<div class="page-context" class:centered>
    <div class="page-container" bind:this={pageContainer} style:transform={`scale(${scale})`}>
        <page size="A3" bind:this={page}>
            <div class="content-context">
                <slot></slot>
            </div>
        </page>
    </div>
</div>

<style>
    /* Debug styles */
    #debug-info {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: #f0f0f0;
        padding: 10px;
        border-bottom: 1px solid #ccc;
        font-family: monospace;
        z-index: 1000;
    }

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
        box-shadow: 0 0 0.5cm rgba(0,0,0,0.5);
    }

    page[size="A3"] {
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
        page[size="A3"] {
            background: white;
        }

        #debug-info, #scale-controls {
            display: none;
        }
        .page-context {
            transform: none !important;
        }
        .page-container {
            transform: none !important;
        }
        page[size="A3"] {
            transform: none !important;
        }
    }
</style> 