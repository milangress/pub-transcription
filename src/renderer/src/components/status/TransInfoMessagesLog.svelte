<script lang="ts">
  let messages = $state<string[]>([])

  // Listen for transcription status updates
  window.electron.ipcRenderer.on('transcription-status', (_, value: string) => {
    messages = [value, ...messages]
  })
</script>

{#each messages as item}
  <p>{item}</p>
{/each}

<style>
  p {
    margin: 0.25em 0;
    font-family: inherit;
  }
</style>
