<script>
    import { quintOut } from 'svelte/easing';
    import { slide } from 'svelte/transition';
    export let printId;
    export let status;
</script>

<div class="status-item" title="{printId} – {status.text || 'Print status update'}">
    {#key status.emoji}
    <span transition:slide="{{duration: 600, axis: 'x', easing: quintOut}}" class="emoji">{status.emoji}</span>
    {/key}
    <!-- {#if status.text}-->
    <!--hover to show printId-->
    <!-- <button class="text" 
        aria-label={`Print status: ${printId} ${status.text}`}
        on:click={() => {
            console.log(`${printId} ${status.text}`);
        }}>
    </button> -->
    <!-- {/if} -->
</div>

<style>
    .status-item {
        display: flex;
        align-items: center;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.8);
        font-size: 1.2em;
        transition: all 0.2s ease;
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
        background: none;
        border: none;
        padding: 0;
        cursor: default;
    }
</style> 