<script lang="ts">
  import { whisperStore } from '../../stores/whisperStore.svelte';
  import Button from '../ui/Button.svelte';
  import Checkbox from '../ui/Checkbox.svelte';
  import Dialog from '../ui/Dialog.svelte';
  import RenderLogOutput from '../ui/RenderLogOutput.svelte';
  import Select from '../ui/Select.svelte';
  import Separator from '../ui/Seperator.svelte';
  import Tabs from '../ui/Tabs.svelte';

  // State
  let open = $state(false);

  $effect(() => {
    if (open) {
      whisperStore.reloadInfo();
    }
  });
  $effect(() => {
    openDialog();
  });
  function openDialog() {
    open = true;
  }

  function stopStream() {
    whisperStore.stopStream();
  }

  function startStream() {
    whisperStore.startStream();
  }
</script>

<Button buttonText="Transcription Settings" onclick={() => (open = true)} />

<Dialog bind:open title="Whisper Stream Manager">
  <div class="dialog-body">
    <Tabs tab1Label="Basic" tab2Label="Advanced Settings">
      {#snippet tabContent1()}
        <div class="input-row">
          <label for="device-select">Microphone:</label>
          <Select
            items={whisperStore.deviceOptionsObject}
            bind:value={whisperStore.captureIdString}
            type="single"
          />
        </div>

        <div class="input-row checkbox-row">
          <Checkbox bind:checked={whisperStore.params.save_audio} labelText="Save Audio" />
        </div>

        <Separator />

        <div class="transcript-container">
          <div class="transcript-header">
            <h3>Transcription Output</h3>
            <Button buttonText="Clear" onclick={() => whisperStore.clearMiniLogs()} />
          </div>
          <div class="transcript-output">
            <RenderLogOutput lines={whisperStore.miniLogs} />
          </div>
        </div>
      {/snippet}

      {#snippet tabContent2()}
        <div class="advanced-settings">
          <div class="settings-section">
            <h3>Performance Settings</h3>
            <div class="settings-grid">
              <div class="input-row">
                <label for="threads">Threads:</label>
                <input
                  id="threads"
                  type="number"
                  bind:value={whisperStore.params.n_threads}
                  min="1"
                  max="32"
                />
              </div>

              <div class="input-row">
                <label for="maxTokens">Max Tokens:</label>
                <input
                  id="maxTokens"
                  type="number"
                  bind:value={whisperStore.params.max_tokens}
                  min="1"
                />
              </div>

              <div class="input-row">
                <label for="beamSize">Beam Size:</label>
                <input
                  id="beamSize"
                  type="number"
                  bind:value={whisperStore.params.beam_size}
                  min="-1"
                />
              </div>
            </div>

            <div class="checkbox-grid">
              <Checkbox bind:checked={whisperStore.params.use_gpu} labelText="Use GPU" />
              <Checkbox bind:checked={whisperStore.params.flash_attn} labelText="Flash Attention" />
            </div>
          </div>

          <Separator />

          <div class="settings-section">
            <h3>Audio Processing</h3>
            <div class="settings-grid">
              <div class="input-row">
                <label for="step">Step (ms):</label>
                <input id="step" type="number" bind:value={whisperStore.params.step_ms} min="0" />
              </div>

              <div class="input-row">
                <label for="length">Length (ms):</label>
                <input
                  id="length"
                  type="number"
                  bind:value={whisperStore.params.length_ms}
                  min="1000"
                />
              </div>

              <div class="input-row">
                <label for="keep">Keep (ms):</label>
                <input id="keep" type="number" bind:value={whisperStore.params.keep_ms} min="0" />
              </div>

              <div class="input-row">
                <label for="audioCtx">Audio Context:</label>
                <input
                  id="audioCtx"
                  type="number"
                  bind:value={whisperStore.params.audio_ctx}
                  min="0"
                />
              </div>

              <div class="input-row">
                <label for="vadThreshold">VAD Threshold:</label>
                <input
                  id="vadThreshold"
                  type="number"
                  bind:value={whisperStore.params.vad_thold}
                  min="0"
                  max="1"
                  step="0.01"
                />
              </div>

              <div class="input-row">
                <label for="freqThreshold">Freq Threshold:</label>
                <input
                  id="freqThreshold"
                  type="number"
                  bind:value={whisperStore.params.freq_thold}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div class="settings-section">
            <h3>Language Settings</h3>
            <div class="settings-grid">
              <div class="input-row">
                <label for="language">Language:</label>
                <input id="language" type="text" bind:value={whisperStore.params.language} />
              </div>
            </div>

            <div class="checkbox-grid">
              <Checkbox bind:checked={whisperStore.params.translate} labelText="Translate" />
              <Checkbox bind:checked={whisperStore.params.no_fallback} labelText="No Fallback" />
              <Checkbox
                bind:checked={whisperStore.params.print_special}
                labelText="Print Special"
              />
              <Checkbox bind:checked={whisperStore.params.no_context} labelText="No Context" />
            </div>
          </div>
        </div>
      {/snippet}
    </Tabs>

    <div class="dialog-actions">
      <Button
        buttonText="Reload Devices"
        variant="outline"
        onclick={() => whisperStore.reloadInfo()}
      />
      <div class="spacer"></div>
      <Button buttonText="Stop" variant="destructive" onclick={stopStream} />
      <Button buttonText="Start" variant="default" onclick={startStream} />
      <Button buttonText="Close" variant="outline" onclick={() => (open = false)} />
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
    justify-content: space-between;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
  }

  .spacer {
    flex: 1;
  }

  .input-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm);
  }

  .checkbox-row {
    margin-top: var(--spacing-xs);
  }

  .transcript-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .transcript-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .transcript-header h3 {
    margin: 0;
  }

  .advanced-settings {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    max-height: 400px;
    overflow-y: auto;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .settings-section h3 {
    margin: 0;
    margin-bottom: var(--spacing-xs);
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  .checkbox-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-xs);
  }

  input[type='number'],
  input[type='text'] {
    width: 100px;
    padding: var(--spacing-xs);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
  }
</style>
