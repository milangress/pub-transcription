<script lang="ts">
  let { knobNR = 0 } = $props<{
    knobNR?: number;
  }>();

  const maxKnobs: number = 16;
  const midiKnobs: number[] = [...Array(maxKnobs).keys()];
</script>

<div class="midiController">
  {#each midiKnobs as knob}
    {#if knob === knobNR}
      <div class="knob active"></div>
    {:else}
      <div class="knob"></div>
    {/if}
  {/each}
</div>

<style>
  .midiController {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    width: 3em;
    height: 3em;
    padding: 2px;
  }
  .knob {
    width: 0.5em;
    height: 0.5em;
    border-radius: 50%;
    background-color: lightgray;
    margin: 0 1px;
  }
  .knob.active {
    background-color: #00ff00;
  }
</style>
