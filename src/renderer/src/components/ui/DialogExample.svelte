<script lang="ts">
  import { onMount } from 'svelte';
  import Button from './Button.svelte';
  import Checkbox from './Checkbox.svelte';
  import Dialog from './Dialog.svelte';
  import RenderLogOutput from './RenderLogOutput.svelte';
  import Select from './Select.svelte';
  import Separator from './Seperator.svelte';
  import Tabs from './Tabs.svelte';

  type Props = {
    buttonText: string;
    dialogTitle: string;
  };

  let { buttonText, dialogTitle }: Props = $props();

  let open = $state(false);
  const items = [
    { value: '1', label: 'Item 1' },
    { value: '2', label: 'Item 2' },
    { value: '3', label: 'Item 3' },
  ];
  let selectedItem = $state('1');

  let logLines = $state(['line 1', 'line 2', 'line 3']);
  onMount(() => {
    setInterval(() => {
      logLines.push(`line ${logLines.length + 1}`);
    }, 1000);
  });
</script>

<Button {buttonText} onclick={() => (open = true)} />

<Dialog bind:open title={dialogTitle}>
  <div class="dialog-body">
    <Tabs tab1Label="Tab 1 label" tab2Label="Tab 2 label">
      {#snippet tabContent1()}
        <p>Tab 1 content</p>
      {/snippet}
      {#snippet tabContent2()}
        <p>Tab 2 content</p>
        <RenderLogOutput lines={logLines} />
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
