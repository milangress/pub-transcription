<script>
    import PrintStatus from './PrintStatus.svelte';
    import { onMount } from 'svelte';

    let printStatuses = new Map();
    let successPrintCount = 0;
    let successPdfCount = 0;
    let failureCount = 0;
    
    // Status emoji mapping based on action and status
    const STATUS_EMOJIS = {
        LOCAL_REQUEST: '🥚',
        QUEUED: '🐣',
        PRINT_START: '🎀',
        PRINT_COMPLETE: {
            SUCCESS: '🖨️',
            ERROR: '🥵'
        },
        PDF_SAVE: {
            SUCCESS: '💦'
        },
        PRINT_ERROR: '🥵'
    };
    
    function updateStatus(printId, newStatus, text = '') {
        if (!printId) {
            console.warn('⚠️ Attempted to update status without printId');
            return;
        }
        console.log(`🔄 Updating status for ${printId} to ${newStatus}${text ? ` (${text})` : ''}`);
        printStatuses.set(printId, { emoji: newStatus, text });
        printStatuses = printStatuses; // Trigger reactivity
    }

    export function addPrintRequest() {
        const printId = Date.now();
        updateStatus(printId, STATUS_EMOJIS.LOCAL_REQUEST, 'Print request created');
        console.log(`🥚 Added new print request with ID: ${printId}`);
        return printId;
    }

    // Add print request handler
    onMount(() => {
        window.electronAPI.onPrintQueued((event, { success, error, printId }) => {
            if (success) {
                updateStatus(printId, '🐣', 'Print job queued successfully');
            } else {
                updateStatus(printId, '🥵', `Print queue error: ${error}`);
            }
        });

        window.electronAPI.onPrintStatus((event, message) => {
            const { id, action, status, ...details } = message;
            let emoji = '❓';
            let text = 'Unknown status';

            switch (action) {
                case 'PRINT_START':
                    emoji = '🎀';
                    text = details.message || 'Starting print...';
                    break;
                case 'PRINT_COMPLETE':
                    emoji = status === 'SUCCESS' ? '🖨️' : '🥵';
                    text = details.message || (status === 'SUCCESS' ? 'Print complete' : 'Print failed');
                    if (status === 'SUCCESS') {
                        successPrintCount++;
                    } else {
                        failureCount++;
                    }
                    break;
                case 'PDF_SAVE':
                    emoji = status === 'SUCCESS' ? '💦' : '🥵';
                    text = details.message || (status === 'SUCCESS' ? 'PDF saved' : 'PDF save failed');
                    if (status === 'SUCCESS') {
                        successPdfCount++;
                    } else {
                        failureCount++;
                    }
                    break;
                case 'PRINT_ERROR':
                    emoji = '🥵';
                    text = details.message || 'Print error occurred';
                    failureCount++;
                    break;
            }

            updateStatus(id, emoji, text);
        });

        // Clean up old statuses after 1 minute
        const cleanup = setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            for (const [printId] of printStatuses) {
                if (now - printId > 60000) {
                    console.log(`🧹 Cleaning up old print status: ${printId}`);
                    printStatuses.delete(printId);
                    cleaned++;
                }
            }
            if (cleaned > 0) {
                printStatuses = printStatuses; // Trigger reactivity
                console.log(`🧹 Cleaned up ${cleaned} old print statuses`);
            }
        }, 10000);

        return () => {
            clearInterval(cleanup);
            console.log('🛑 PrintStatusBar cleanup interval stopped');
        };
    });
</script>

<div class="status-bar">
    <div class="counter" title="Success Prints / Success PDFs / Failures">
        <span class="success">{successPrintCount}</span>/<span class="success">{successPdfCount}</span>/<span class="failure">{failureCount}</span>
    </div>
    {#each Array.from(printStatuses) as [printId, status]}
        <PrintStatus {printId} {status} />
    {/each}
</div>

<style>
    .status-bar {
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: row-reverse;
        gap: 8px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-width: 80vw;
        overflow-x: auto;
        backdrop-filter: blur(4px);
    }
    @media print {
        .status-bar {
            display: none;
        }
    }

    .counter {
        display: flex;
        align-items: center;
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 12px;
        font-size: 0.9em;
        font-family: monospace;
        font-weight: bold;
    }

    .success {
        color: #22c55e;
    }

    .failure {
        color: #ef4444;
    }

    /* Hide scrollbar but keep functionality */
    .status-bar::-webkit-scrollbar {
        display: none;
    }
    .status-bar {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style> 