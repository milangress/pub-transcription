<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';
  import Checkbox from './Checkbox.svelte';
  import Dialog from './Dialog.svelte';
  import Select from './Select.svelte';
  import Separator from './Seperator.svelte';
  import Tabs from './Tabs.svelte';

  type Props = {
    buttonText: string;
    title: string;
    description: Snippet;
  };

  let { buttonText, title, description }: Props = $props();

  let open = $state(false);
  const items = [
    { value: '1', label: 'Item 1' },
    { value: '2', label: 'Item 2' },
    { value: '3', label: 'Item 3' },
  ];
  let selectedItem = $state('1');
</script>

<Button {buttonText} onclick={() => (open = true)} />

<Dialog bind:open {title} {description}>
  {#snippet children()}
    <div class="dialog-body">
      <Tabs tab1Label="Tab 1 label" tab2Label="Tab 2 label">
        {#snippet tabContent1()}
          <p>Tab 1 content</p>
        {/snippet}
        {#snippet tabContent2()}
          <p>Tab 2 content</p>
        {/snippet}
      </Tabs>

      <Checkbox labelText="Checkbox" />

      <Separator />

      <Select {items} bind:value={selectedItem} type="single" />

      <div class="dialog-actions">
        <Button buttonText="Save" />
        <Button buttonText="Cancel" onclick={() => (open = false)} />
      </div>
    </div>
  {/snippet}
</Dialog>

<style>
  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
  }
</style>
