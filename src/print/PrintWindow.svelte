<script>
    import { onMount } from 'svelte';
    
    let status = 'Waiting for print job...';
    let lastJobTime = 'Never';
    let stylesLoaded = 'No';
    let currentScale = 0.5;
    
    let page;
    let pageContainer;
    
    function updatePagePosition() {
        if (!page || !pageContainer) return;
        
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const pageHeight = page.offsetHeight * currentScale;
        const pageWidth = page.offsetWidth * currentScale;

        // Always center the page
        pageContainer.style.transform = `translate(-50%, -50%) scale(${currentScale})`;

        // If page is larger than viewport, enable scrolling
        if (pageHeight > viewportHeight - 150 || pageWidth > viewportWidth - 100) {
            document.body.style.overflow = 'auto';
        } else {
            document.body.style.overflow = 'hidden';
        }
    }

    function adjustScale(delta) {
        currentScale = Math.max(0.1, Math.min(2, currentScale + delta)); // Limit scale between 0.1 and 2
        updatePagePosition();
    }

    onMount(() => {
        // Initialize IPC listeners
        window.electronAPI.onPrintJob(async (_event, { content, settings }) => {
            try {
                status = 'Received print job';
                lastJobTime = new Date().toLocaleTimeString();
                
                // Get the container
                const container = document.getElementById('print-container');
                container.innerHTML = '';
                
                // Inject any dynamic styles
                const styleSheet = document.createElement('style');
                styleSheet.textContent = settings?.inlineStyle || '';
                document.head.appendChild(styleSheet);
                
                // Update styles loaded status
                const styleLength = settings?.inlineStyle?.length;
                stylesLoaded = `Yes - ${styleLength} - ${new Date().toLocaleTimeString()}`;

                // Inject SVG filters if they exist
                if (settings?.svgFiltersCode) {
                    const filtersDiv = document.createElement('div');
                    filtersDiv.style.display = 'none';
                    filtersDiv.innerHTML = settings.svgFiltersCode;
                    document.body.appendChild(filtersDiv);
                }
                
                // Set the content
                container.innerHTML = content;
                
                status = 'Content loaded, waiting 5 seconds before print...';
                
                // Wait for debug/inspection
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                status = 'Printing...';
                
                try {
                    // Print
                    await window.electronAPI.executePrint({
                        content: container.innerHTML,
                        settings: settings
                    });
                    
                    // Send success status back
                    window.electronAPI.sendPrintStatus({ success: true });
                    status = 'Print complete, waiting for next job';
                } catch (error) {
                    console.error('Print error:', error);
                    status = 'Error: ' + error.message;
                    window.electronAPI.sendPrintStatus({ 
                        success: false, 
                        error: error.message 
                    });
                }
            } catch (error) {
                console.error('Print error:', error);
                status = 'Error: ' + error.message;
                window.electronAPI.sendPrintStatus({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // Handle window resize
        window.addEventListener('resize', updatePagePosition);
        return () => window.removeEventListener('resize', updatePagePosition);
    });
</script>

<div id="debug-info">
    <div>Status: <span>{status}</span></div>
    <div>Last job received: <span>{lastJobTime}</span></div>
    <div>Styles loaded: <span>{stylesLoaded}</span></div>
</div>

<div id="scale-controls">
    <button on:click={() => adjustScale(-0.1)}>-</button>
    <span>{currentScale.toFixed(1)}</span>
    <button on:click={() => adjustScale(0.1)}>+</button>
</div>

<main>
    <div class="print-context">
        <div class="page-container" bind:this={pageContainer}>
            <page size="A3" bind:this={page}>
                <div class="content-context">
                    <div id="print-container"></div>
                </div>
            </page>
        </div>
    </div>
</main>

<style>
    /* Debug styles */
    #debug-info {
        position: fixed;
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
        position: fixed;
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

    /* Svelte styles */
    :global(html), :global(body) {
        margin: 0;
        padding: 0;
        height: 100vh;
        overflow: auto;
    }
    
    main {
        text-align: left;
        font-family: "Garamondt-Regular","American Typewriter",monospace;
        min-height: 100vh;
        padding: 0.5rem;
        position: relative;
    }
    
    .print-context {
        text-align: left;
        font-size: 2em;
        font-weight: 100;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 100px 0; /* Space for debug info */
        z-index: 500;
        position: fixed;
        width: 100%;
    }

    .content-context {
        height: 100%;
    }

    .content-context:hover {
        outline: 2px solid #00ff00;
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
        background: url('/scan.png');
        background-size: 100% 100%;
        transform-origin: center;
        transition: all 0.3s ease;
        outline: 1px solid red;
    }

    /* Container for maintaining aspect ratio and centering */
    .page-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform-origin: center;
        transition: all 0.3s ease;
        z-index: 500;
    }

    @media print {
        :global(*) {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
        }
        #debug-info, #scale-controls {
            display: none;
        }
        .print-context {
            width: 100%;
        }
        page[size="A3"] {
            margin: 0;
            transform: none !important;
            top: 0;
            left: 0;
        }
        :global(body), page, main {
            background: white;
            margin: 0;
            padding: 0;
            box-shadow: none;
            display: block;
        }
        :global(span.current) {
            display: none !important;
        }
    }
</style> 