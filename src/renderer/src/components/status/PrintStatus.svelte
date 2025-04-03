<script lang="ts">
  import { quintOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'

  interface Status {
    emoji: string
    text?: string
  }

  let { printId, status } = $props<{
    printId: string;
    status: Status;
  }>();
</script>

<div class="status-item" title="{printId} – {status.text || 'Print status update'}">
  {#key status.emoji}
    <span transition:slide={{ duration: 600, axis: 'x', easing: quintOut }} class="emoji"
      >{status.emoji}</span
    >
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
</style>
