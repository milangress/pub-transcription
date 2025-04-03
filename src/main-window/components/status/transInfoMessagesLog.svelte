<script>    
    let messages = []

    // Listen for transcription status updates
    window.electronAPI.onTranscriptionStatus((event, value) => {
        messages = [value, ...messages];
    });
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
