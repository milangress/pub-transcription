<script lang="ts">
  import { Select, type WithoutChildren } from 'bits-ui';
  import { CaretDoubleDown, CaretDoubleUp, CaretUpDown } from 'phosphor-svelte';

  type Props = WithoutChildren<Select.RootProps> & {
    placeholder?: string;
    items: { value: string; label: string; disabled?: boolean }[];
    contentProps?: WithoutChildren<Select.ContentProps>;
    // any other specific component props if needed
  };

  let {
    value = $bindable(),
    items,
    contentProps,
    placeholder = 'Please select…',
    ...restProps
  }: Props = $props();

  const selectedLabel = $derived(
    value?.length
      ? items
          .filter((item) => value?.includes(item.value))
          .map((item) => item.label)
          .join(', ')
      : placeholder,
  );
</script>

<!--
TypeScript Discriminated Unions + destructing (required for "bindable") do not
get along, so we shut typescript up by casting `value` to `never`, however,
from the perspective of the consumer of this component, it will be typed appropriately.
-->
<Select.Root bind:value={value as never} {...restProps}>
  <Select.Trigger class="select-trigger">
    {selectedLabel ? selectedLabel : placeholder}
    <CaretUpDown class="select-icon" />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content class="select-content" {...contentProps}>
      <Select.ScrollUpButton class="select-scroll-button">
        <CaretDoubleUp size={14} />
      </Select.ScrollUpButton>
      <Select.Viewport class="select-viewport">
        {#each items as { value, label, disabled } (value)}
          <Select.Item {value} {label} {disabled} class="select-item">
            {#snippet children({ selected })}
              {selected ? '✅' : ''}
              {label}
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>
      <Select.ScrollDownButton class="select-scroll-button">
        <CaretDoubleDown size={14} />
      </Select.ScrollDownButton>
    </Select.Content>
  </Select.Portal>
</Select.Root>

<style>
  :global([data-select-trigger]) {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: var(--border-width) solid var(--border-color);
    border-radius: 0;
    padding: var(--spacing-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    min-width: 200px;
    cursor: pointer;
  }

  :global([data-select-content]) {
    background-color: var(--bg-color);
    border: var(--border-width) solid var(--border-color);
    border-radius: 0;
    padding: var(--spacing-xs);
    z-index: 600;
    max-height: 300px;
    min-width: var(--bits-select-anchor-width);
    animation: contentShow 150ms ease-out;
  }

  :global([data-select-viewport]) {
    padding: var(--spacing-xs);
  }

  :global([data-select-item]) {
    padding: var(--spacing-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
  }

  :global([data-select-item][data-highlighted]) {
    background-color: var(--accent-color);
    color: var(--bg-color);
  }

  :global([data-select-item][data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.select-scroll-button) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xs);
    color: var(--text-color);
    cursor: pointer;
  }

  :global(.select-icon) {
    color: var(--text-color-muted);
  }

  :global(.select-check) {
    margin-left: var(--spacing-sm);
  }

  @keyframes contentShow {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
