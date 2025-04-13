<script lang="ts">
  import type { Snippet } from 'svelte';
  import TabsContent from './TabsContent.svelte';
  import TabsRoot from './TabsRoot.svelte';

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
  console.log(tabContent1?.());
</script>

<TabsRoot bind:value {items}>
  <TabsContent value="tab1">
    {@render tabContent1?.()}
  </TabsContent>
  <TabsContent value="tab2">
    {@render tabContent2?.()}
  </TabsContent>
  {#if tabContent3}
    <TabsContent value="tab3">
      {@render tabContent3()}
    </TabsContent>
  {/if}
</TabsRoot>
