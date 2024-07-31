<script>
    import { onMount } from 'svelte';
    import PageWrapper from '../components/PageWrapper.svelte';
    import LogContainer from './LogContainer.svelte';
    
    let status = 'Waiting for print job...';
    let lastJobTime = 'Never';
    let stylesLoaded = 'No';
    let currentScale = 0.25;
    let children = 0;
    let printLogs = [];
    let currentPrintId = null;
    
    function addLogEntry(message, pdfUrl = null, spanCount = null, type = 'client') {
        const timestamp = new Date().toLocaleTimeString();
        printLogs = [...printLogs, { 
            timestamp,
            message,
            pdfUrl,
            spanCount,
            type,
            printId: currentPrintId
        }];
    }

    function updateLogEntryWithPdfUrl(printId, pdfUrl) {
        printLogs = printLogs.map(log => {
            if (log.printId === printId) {
                return { ...log, pdfUrl };
            }
            return log;
        });
    }
    
    onMount(() => {
        // Debug IPC setup
        console.log('Setting up IPC listeners...');
        
        // Listen for server messages
        window.electronAPI.onTransInfo((_event, message) => {
            console.log('🔍 trans-info received:', { event: _event, message, type: typeof message });
            
            // Check if the message contains a PDF path
            if (typeof message === 'string') {
                const pdfMatch = message.match(/Wrote PDF successfully to (.+)$/);
                if (pdfMatch) {
                    console.log('📄 PDF path found:', pdfMatch[1]);
                    const pdfPath = pdfMatch[1];
                    updateLogEntryWithPdfUrl(currentPrintId, `file://${pdfPath}`);
                }
                
                // Log all server messages for debugging
                console.log('📨 Server message:', message);
                addLogEntry(message, null, null, 'server');
            } else {
                console.log('⚠️ Received non-string message:', message);
            }
        });

        // Test if IPC is working
        console.log('IPC handlers set up. Available API:', Object.keys(window.electronAPI));

        // Initialize IPC listeners for print jobs
        window.electronAPI.onPrintJob(async (_event, { content, settings }) => {
            try {
                currentPrintId = Date.now();
                console.log('🖨️ New print job started with ID:', currentPrintId);
                
                status = 'Received print job';
                lastJobTime = new Date().toLocaleTimeString();
                addLogEntry('Received new print job');
                
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
                addLogEntry(`Styles loaded (${styleLength} bytes)`);

                // Inject SVG filters if they exist
                if (settings?.svgFiltersCode) {
                    const filtersDiv = document.createElement('div');
                    filtersDiv.style.display = 'none';
                    filtersDiv.innerHTML = settings.svgFiltersCode;
                    document.body.appendChild(filtersDiv);
                }
                
                // Set the content
                container.innerHTML = content;

                // count spans inside container
                children = container.querySelectorAll('span');
                
                status = 'Content loaded, waiting 5 seconds before print...';
                addLogEntry('Content loaded, preparing to print', null, children.length);
                
                // Wait for debug/inspection
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                status = 'Printing...';
                addLogEntry('Starting print process...', null, children.length);
                
                try {
                    console.log('📤 Sending print request to main process...');
                    // Print
                    await window.electronAPI.executePrint({
                        content: container.innerHTML,
                        settings: settings
                    });
                    
                    console.log('📥 Print request completed');
                    // Send success status back
                    window.electronAPI.sendPrintStatus({ success: true });
                    status = 'Print complete, waiting for next job';
                    addLogEntry('Print completed successfully', null, children.length);
                } catch (error) {
                    console.error('❌ Print error:', error);
                    status = 'Error: ' + error.message;
                    addLogEntry(`Print failed: ${error.message}`, null, children.length);
                    window.electronAPI.sendPrintStatus({ 
                        success: false, 
                        error: error.message 
                    });
                }
            } catch (error) {
                console.error('❌ Print job error:', error);
                status = 'Error: ' + error.message;
                addLogEntry(`Error: ${error.message}`);
                window.electronAPI.sendPrintStatus({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
    });
</script>

<div id="print-window-wrapper">
    <div id="print-debug-info">
        <div>Status: <span>{status}</span></div>
        <div>Last job received: <span>{lastJobTime}</span></div>
        <div>Styles loaded: <span>{stylesLoaded}</span></div>
        <div>Spans: <span>{children ? children.length : 0}</span></div>
    </div>

    <div class="page-container-wrapper">
        <PageWrapper 
            scale={currentScale}
            onScaleChange={(newScale) => currentScale = newScale}
            showControls={true}
            showDebug={false}
            position="center"
        >
            <div id="print-container"></div>
        </PageWrapper>
    </div>

    <LogContainer logs={printLogs} />
</div>

<style>
    #print-window-wrapper {
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    #print-debug-info {
        flex: 0 0 auto;
        background: #f0f0f0;
        padding: 10px;
        border-bottom: 1px solid #ccc;
        font-family: monospace;
        z-index: 1000;
    }

    .page-container-wrapper {
        flex: 1;
        position: relative;
        height: 0;
        min-height: 0;
        overflow: hidden;
    }

    @media print {
        #print-debug-info {
            display: none;
        }
    }
</style> 