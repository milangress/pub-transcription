<script lang="ts">
  import { Button } from 'bits-ui';
  import type { Snippet } from 'svelte';

  type Props = Button.RootProps & {
    buttonText?: string;
    ref?: HTMLElement;
    children?: Snippet;
  };

  let { ref = $bindable(null!), buttonText, children, ...restProps }: Props = $props();
</script>

<Button.Root bind:ref {...restProps}>
  {#if buttonText}
    {buttonText}
  {:else}
    {@render children?.()}
  {/if}
</Button.Root>

<style>
  :global([data-button-root]) {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: var(--border-width) solid var(--border-color);
    border-radius: 0;
  }
</style>
