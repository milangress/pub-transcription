<script lang="ts">
  import { Button } from 'bits-ui';
  import type { Snippet } from 'svelte';

  type Props = Button.RootProps & {
    buttonText?: string;
    ref?: HTMLElement;
    children?: Snippet;
    variant?: 'default' | 'destructive' | 'outline';
  };

  let {
    ref = $bindable(null!),
    buttonText,
    children,
    variant = 'default',
    ...restProps
  }: Props = $props();
</script>

<Button.Root bind:ref class={variant} {...restProps}>
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
  :global([data-button-root].destructive) {
    background-color: var(--destructive-color);
    color: var(--destructive-text-color);
    border-color: var(--destructive-border-color);
  }
  :global([data-button-root].outline) {
    background-color: transparent;
    color: var(--text-color);
    border-color: var(--border-color);
  }
</style>
