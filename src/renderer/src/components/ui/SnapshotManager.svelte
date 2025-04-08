<script lang="ts">
  import { settings } from '@/stores/settings.svelte.js';
  import { snapshots } from '@/stores/snapshots.svelte.js';
  import BlockTxt from '@components/pageElement/BlockTxt.svelte';

  // Original settings for revert functionality
  let originalSettings = $state<{
    inlineStyle: string;
    svgFilters: string;
    controllerValues: Record<string, number>;
  } | null>(null);

  // Snapshot management functions
  async function saveSnapshot(): Promise<void> {
    // Use a default name instead of prompt
    const name = `Snapshot ${new Date().toLocaleString()}`;

    try {
      const result = await snapshots.saveSnapshot(name);
      if (result) {
        console.log('Snapshot saved successfully:', result);
      } else {
        console.error('Failed to save snapshot');
      }
    } catch (error) {
      console.error('Error saving snapshot:', error);
    }
  }

  async function applySnapshot(id: string): Promise<void> {
    // Store original settings before applying snapshot if not already stored
    if (!originalSettings) {
      originalSettings = {
        inlineStyle: settings.inlineStyle,
        svgFilters: settings.svgFilters,
        controllerValues: { ...settings.controllerValues },
      };
    }

    try {
      const success = await snapshots.applySnapshot(id);
      if (success) {
        console.log('Snapshot applied successfully');
      } else {
        console.error('Failed to apply snapshot');
      }
    } catch (error) {
      console.error('Error applying snapshot:', error);
    }
  }

  async function mergeSnapshot(id: string): Promise<void> {
    // Store original settings before merging snapshot if not already stored
    if (!originalSettings) {
      originalSettings = {
        inlineStyle: settings.inlineStyle,
        svgFilters: settings.svgFilters,
        controllerValues: { ...settings.controllerValues },
      };
    }

    try {
      const success = await snapshots.mergeSnapshot(id);
      if (success) {
        console.log('Snapshot merged successfully');
      } else {
        console.error('Failed to merge snapshot');
      }
    } catch (error) {
      console.error('Error merging snapshot:', error);
    }
  }

  async function deleteSnapshot(id: string): Promise<void> {
    // Remove confirm dialog
    try {
      const success = await snapshots.deleteSnapshot(id);
      if (success) {
        console.log('Snapshot deleted successfully');
      } else {
        console.error('Failed to delete snapshot');
      }
    } catch (error) {
      console.error('Error deleting snapshot:', error);
    }
  }

  function revertToOriginal(): void {
    if (!originalSettings) return;

    settings.inlineStyle = originalSettings.inlineStyle;
    settings.svgFilters = originalSettings.svgFilters;

    // Restore controller values
    Object.entries(originalSettings.controllerValues).forEach(([varName, value]) => {
      settings.updateControllerValue(varName, value);
    });

    // Clear original settings after applying
    originalSettings = null;

    console.log('Reverted to original settings');
  }
</script>

<div class="snapshotControls">
  <button onclick={() => saveSnapshot()}>Save Snapshot</button>
  {#if originalSettings}
    <button onclick={() => revertToOriginal()}>Revert Changes</button>
  {/if}
</div>

<div class="snapshotsContainer">
  {#each snapshots.snapshots as snapshot (snapshot.id)}
    {@const staticControllerSettings = settings.controllerSettings.map((ctrl) => ({
      ...ctrl,
      value:
        snapshot.controllerValues[ctrl.var] !== undefined
          ? snapshot.controllerValues[ctrl.var]
          : ctrl.value,
    }))}

    <div class="snapshotItem">
      <button class="snapshotPreview" onclick={() => mergeSnapshot(snapshot.id)}>
        <BlockTxt
          content={snapshot.name}
          settings={{
            inlineStyle: snapshot.inlineStyle,
            svgFilters: snapshot.svgFilters,
            controllerSettings: $state.snapshot(staticControllerSettings as unknown),
          }}
        />
      </button>
      <div class="snapshotActions">
        <button onclick={() => applySnapshot(snapshot.id)}>↑</button>
        <button onclick={() => deleteSnapshot(snapshot.id)}>×</button>
      </div>
    </div>
  {/each}
</div>

<style>
  .snapshotControls {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .snapshotsContainer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .snapshotItem {
    display: flex;
    align-items: flex-start;
    border: 1px solid #ddd;
    padding: 0.5rem;
    position: relative;
  }

  .snapshotItem:hover {
    border-color: #888;
  }

  .snapshotPreview {
    flex: 1;
    cursor: pointer;
    padding: 0.25rem;
    background: none;
    border: none;
    text-align: left;
    width: 100%;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    contain: strict;
    height: 2em;
  }

  .snapshotPreview:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .snapshotActions {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
  }

  .snapshotActions button {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #888;
    margin-left: 0.25rem;
  }

  .snapshotActions button:first-child {
    color: #4a90e2;
  }

  .snapshotActions button:first-child:hover {
    color: #2a70c2;
  }

  .snapshotActions button:last-child:hover {
    color: #f00;
  }
</style>
