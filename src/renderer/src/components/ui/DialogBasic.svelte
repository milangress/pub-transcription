<script lang="ts">
  import { Dialog, type WithoutChild } from 'bits-ui';
  import { X } from 'phosphor-svelte';
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';
  import Checkbox from './Checkbox.svelte';
  import Select from './Select.svelte';
  import Separator from './Seperator.svelte';
  import Tabs from './Tabs.svelte';

  type Props = Dialog.RootProps & {
    buttonText: string;
    title: string;
    description: Snippet;
    contentProps?: WithoutChild<Dialog.ContentProps>;
    // ...other component props if you wish to pass them
  };

  let {
    open = $bindable(false),
    children,
    buttonText,
    contentProps,
    title,
    description,
    ...restProps
  }: Props = $props();

  const items = [
    { value: '1', label: 'Item 1' },
    { value: '2', label: 'Item 2' },
    { value: '3', label: 'Item 3' },
  ];
  let selectedItem = $state('1');
</script>

<Dialog.Root bind:open {...restProps}>
  <Dialog.Trigger>
    {buttonText}
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />

    <Dialog.Content class="dialog-content" {...contentProps}>
      <Dialog.Title>
        {title}
      </Dialog.Title>

      <Tabs tab1Label="Tab 1" tab2Label="Tab 2">
        {#snippet tabContent1()}
          <p>Tab 1 content</p>
        {/snippet}
        {#snippet tabContent2()}
          <p>Tab 2 content</p>
        {/snippet}
      </Tabs>
      <Dialog.Description>
        {@render description()}
      </Dialog.Description>

      {@render children?.()}

      <Checkbox labelText="Checkbox" />

      <Separator />

      <Select {items} bind:value={selectedItem} type="single" />

      <div class="dialog-actions">
        <Button buttonText="Save" />
        <Button buttonText="Cancel" />
      </div>

      <Dialog.Close class="dialog-close">
        <X size={18} />
        <span class="sr-only">Close</span>
      </Dialog.Close>
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
    padding: var(--spacing-xs);
  }

  :global(.dialog-close:hover) {
    color: var(--accent-color);
  }

  :global(.dialog-body) {
    padding: var(--spacing-sm) 0;
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
