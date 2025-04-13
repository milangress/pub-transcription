<script lang="ts">
  import { Tabs, type WithoutChildren } from 'bits-ui';
  import type { Snippet } from 'svelte';

  type Props = WithoutChildren<Tabs.ContentProps> & {
    value: string;
    children?: Snippet;
  };

  let { value, children, ...restProps }: Props = $props();
</script>

<Tabs.Content {value} class="tabs-content" {...restProps}>
  {@render children?.()}
</Tabs.Content>

<style>
  :global([data-tabs-content]) {
    background-color: var(--bg-color);
    border: var(--border-width) solid var(--border-color);
    padding: var(--spacing-md);
    margin-top: calc(var(--border-width) * -1);
  }

  :global([data-tabs-content][data-state='inactive']) {
    display: none;
  }
</style>
