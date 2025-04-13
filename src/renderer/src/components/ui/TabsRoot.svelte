<script lang="ts">
  import { Tabs, type WithoutChildren } from 'bits-ui';
  import type { Snippet } from 'svelte';

  type Props = WithoutChildren<Tabs.RootProps> & {
    items: { value: string; label: string; disabled?: boolean }[];
    children?: Snippet;
  };

  let { value = $bindable(), items, children, ...restProps }: Props = $props();
</script>

<Tabs.Root bind:value {...restProps}>
  <Tabs.List class="tabs-list">
    {#each items as item}
      <Tabs.Trigger value={item.value} disabled={item.disabled} class="tabs-trigger">
        {item.label}
      </Tabs.Trigger>
    {/each}
  </Tabs.List>
  {@render children?.()}
</Tabs.Root>

<style>
  :global(.tabs-list) {
    display: flex;
    gap: var(--spacing-xs);
    border-bottom: var(--border-width) solid var(--border-color);
    margin-bottom: var(--spacing-md);
  }

  :global([data-tabs-trigger]) {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: var(--border-width) solid var(--border-color);
    border-bottom: none;
    padding: var(--spacing-sm) var(--spacing-md);
    cursor: pointer;
    transition: all 150ms ease;
    margin-bottom: calc(var(--border-width) * -1);
  }

  :global([data-tabs-trigger][data-state='active']) {
    background-color: var(--accent-color);
    color: var(--bg-color);
    border-color: var(--accent-color);
  }

  :global([data-tabs-trigger][data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global([data-tabs-trigger]:hover:not([data-disabled])) {
    border-color: var(--accent-color);
  }

  :global([data-tabs-trigger]:focus-visible) {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }
</style>
