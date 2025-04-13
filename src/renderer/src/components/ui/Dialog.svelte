<script lang="ts">
  import { Dialog, type WithoutChild } from 'bits-ui';
  import { X } from 'phosphor-svelte';
  import type { Snippet } from 'svelte';

  type Props = Dialog.RootProps & {
    title?: string;
    description?: Snippet;
    showClose?: boolean;
    contentProps?: WithoutChild<Dialog.ContentProps>;
    children?: Snippet;
  };

  let {
    open = $bindable(false),
    title,
    description,
    showClose = true,
    contentProps,
    children,
    ...restProps
  }: Props = $props();
</script>

<Dialog.Root bind:open {...restProps}>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-content" {...contentProps}>
      {#if title}
        <Dialog.Title class="dialog-title">
          {title}
        </Dialog.Title>
      {/if}

      {#if description}
        <Dialog.Description class="dialog-description">
          {@render description()}
        </Dialog.Description>
      {/if}

      {@render children?.()}

      {#if showClose}
        <Dialog.Close class="dialog-close">
          <X size={18} />
          <span class="sr-only">Close</span>
        </Dialog.Close>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.dialog-overlay) {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 50;
  }

  :global(.dialog-content) {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 500px;
    max-width: 90vw;
    max-height: 85vh;
    overflow-y: auto;
    background-color: var(--bg-color);
    border: var(--border-width) solid var(--border-color);
    border-radius: 0;
    padding: var(--spacing-md);
    z-index: 500;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  :global(.dialog-title) {
    font-size: var(--font-size-lg);
    font-weight: bold;
    margin: 0;
  }

  :global(.dialog-description) {
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
    margin: var(--spacing-xs) 0 0;
  }

  :global(.dialog-close) {
    position: absolute;
    top: 0;
    right: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-color);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-md);
  }

  :global(.dialog-close:hover) {
    color: var(--accent-color);
  }

  :global(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
