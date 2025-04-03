<script>
    
    let { state } = $state;
    
    // Initialize the messages array
    state = {
        messages: []
    };

    // Listen for transcription status updates
    window.electronAPI.onTranscriptionStatus((event, value) => {
        state.messages = [value, ...state.messages];
    });
</script>

{#each state.messages as item}
    <p>{item}</p>
{/each}

<style>
    p {
        margin: 0.25em 0;
        font-family: inherit;
    }
</style>
