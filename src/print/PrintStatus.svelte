<script>
    export let printId;
    export let status;
</script>

<div class="status-item" title="{status.text || 'Print status update'}">
    <span class="emoji">{status.emoji}</span>
    {#if status.text}
    <!--hover to show printId-->
    <span class="text" onmouseover={() => {
        console.log(`${printId} ${status.text}`);
    }}></span>
    {/if}
</div>

<style>
    .status-item {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.8);
        font-size: 1.2em;
        transition: all 0.2s ease;
    }
    .status-item:hover {
        background: rgba(255, 255, 255, 1);
        transform: translateY(-1px);
    }
    .emoji {
        font-size: 1.2em;
    }
    .text {
        font-size: 0.8em;
        color: #666;
        max-width: 120px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style> 