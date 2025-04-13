<script lang="ts">
  import { Tabs } from 'bits-ui';
  import type { Snippet } from 'svelte';

  type Props = {
    value?: string;
    tab1Label?: string;
    tab2Label?: string;
    tab3Label?: string;
    tabContent1?: Snippet;
    tabContent2?: Snippet;
    tabContent3?: Snippet;
  };

  let {
    value = $bindable('tab1'),
    tab1Label = 'Tab 1',
    tab2Label = 'Tab 2',
    tab3Label = 'Tab 3',
    tabContent1,
    tabContent2,
    tabContent3,
  }: Props = $props();

  const items = $derived([
    { value: 'tab1', label: tab1Label },
    { value: 'tab2', label: tab2Label },
    ...(tabContent3 ? [{ value: 'tab3', label: tab3Label }] : []),
  ]);
</script>

<Tabs.Root bind:value>
  <Tabs.List class="tabs-list">
    {#each items as item}
      <Tabs.Trigger value={item.value} class="tabs-trigger">
        {item.label}
      </Tabs.Trigger>
    {/each}
  </Tabs.List>
  <Tabs.Content value="tab1" class="tabs-content">
    {@render tabContent1?.()}
  </Tabs.Content>
  <Tabs.Content value="tab2" class="tabs-content">
    {@render tabContent2?.()}
  </Tabs.Content>
  {#if tabContent3}
    <Tabs.Content value="tab3" class="tabs-content">
      {@render tabContent3()}
    </Tabs.Content>
  {/if}
</Tabs.Root>

<style>
  :global(.tabs-list) {
    display: flex;
    align-content: stretch;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-xs);
  }

  :global([data-tabs-trigger]) {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: var(--border-width) solid var(--border-color);
    padding: var(--spacing-xs) var(--spacing-md);
    cursor: pointer;
    transition: all 150ms ease;
    margin-bottom: calc(var(--border-width) * -1);
    flex-grow: 1;
  }

  :global([data-tabs-trigger][data-state='active']) {
    background-color: var(--accent-color);
    border-color: var(--border-color);
    color: var(--text-color);
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

  /* :global([data-tabs-content]) {
    background-color: var(--bg-color);
  } */

  :global([data-tabs-content][data-state='inactive']) {
    display: none;
  }
</style>
