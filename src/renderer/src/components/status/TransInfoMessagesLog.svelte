<script lang="ts">
  let messages = $state<string[]>([]);
  import { IpcListener } from '@electron-toolkit/typed-ipc/renderer';
  import type { IpcRendererEvent } from 'src/types/ipc';

  const ipc = new IpcListener<IpcRendererEvent>();

  // Listen for transcription status updates
  ipc.on('whisper-ccp-stream:status', (_, value: string) => {
    messages = [value, ...messages];
  });
</script>

<h3>TransInfoMessagesLog</h3>
<div class="transInfoMessagesLog">
  {#each messages as item}
    <p>{item}</p>
  {/each}
</div>

<style>
  .transInfoMessagesLog {
    contain: strict;
    height: 60vh;
    overflow: auto;
  }

  p {
    margin: 0.25em 0;
    font-family: inherit;
  }
</style>
