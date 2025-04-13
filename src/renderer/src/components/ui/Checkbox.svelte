<script lang="ts">
  import { Checkbox, Label, useId, type WithoutChildrenOrChild } from 'bits-ui';

  let {
    id = useId(),
    checked = $bindable(false),
    ref = $bindable(null),
    labelRef = $bindable(null),
    labelText = 'Checkbox',
    ...restProps
  }: WithoutChildrenOrChild<Checkbox.RootProps> & {
    labelText: string;
    labelRef?: HTMLLabelElement | null;
  } = $props();
</script>

<div class="checkbox-container">
  <Checkbox.Root bind:checked bind:ref {...restProps}>
    {#snippet children({ checked, indeterminate })}
      {#if indeterminate}
        -
      {:else if checked}
        ✅
      {:else}
        ❌
      {/if}
    {/snippet}
  </Checkbox.Root>
  <Label.Root for={id} bind:ref={labelRef}>
    {labelText}
  </Label.Root>
</div>

<style>
  .checkbox-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    align-items: baseline;
  }

  :global([data-checkbox-root]) {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: var(--border-width) solid var(--border-color);
    border-radius: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: border-color 150ms ease;
  }

  :global([data-checkbox-root]:focus-visible) {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }

  :global([data-checkbox-root]:hover) {
    border-color: var(--accent-color);
  }

  :global([data-checkbox-root][data-state='checked']) {
    border-color: var(--accent-color);
  }

  :global([data-label-root]) {
    color: var(--text-color);
    font-size: var(--font-size-sm);
    user-select: none;
    cursor: pointer;
  }
</style>
