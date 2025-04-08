import { IpcEmitter } from '@electron-toolkit/typed-ipc/renderer';
import type { SettingsSnapshot, SettingsSnapshotListResponse } from 'src/types';
import type { IpcEvents } from 'src/types/ipc';
import { v4 as uuidv4 } from 'uuid';
import { mergeInlineStyles } from '../utils/styleMerger';
import { settings } from './settings.svelte';

const emitter = new IpcEmitter<IpcEvents>();

class SnapshotsStore {
  #snapshots = $state<SettingsSnapshot[]>([]);
  #snapshotsLoaded = $state(false);

  constructor() {
    // Load snapshots initially
    this.loadSnapshots().catch(console.error);
  }

  // Create and save a new settings snapshot
  async saveSnapshot(name: string = ''): Promise<SettingsSnapshot | null> {
    try {
      // Create a snapshot of the current settings
      const snapshot: SettingsSnapshot = {
        id: uuidv4(),
        name: name || `Snapshot ${new Date().toLocaleString()}`,
        timestamp: Date.now(),
        inlineStyle: settings.inlineStyle,
        svgFilters: settings.svgFilters,
        controllerValues: settings.controllerValues,
      };

      // Save the snapshot via IPC
      const savedSnapshot = await emitter.invoke('save-settings-snapshot', snapshot);
      console.log('Saved settings snapshot:', savedSnapshot);

      // Update local snapshots list
      await this.loadSnapshots();

      return savedSnapshot;
    } catch (error) {
      console.error('Error saving settings snapshot:', error);
      return null;
    }
  }

  // Load all available snapshots
  async loadSnapshots(): Promise<SettingsSnapshot[]> {
    try {
      const response = (await emitter.invoke(
        'get-settings-snapshots',
      )) as SettingsSnapshotListResponse;

      if (response.success) {
        this.#snapshots = response.snapshots;
        this.#snapshotsLoaded = true;
      } else {
        console.error('Error loading snapshots:', response.error);
      }

      return this.#snapshots;
    } catch (error) {
      console.error('Error loading snapshots:', error);
      return [];
    }
  }

  // Apply a settings snapshot
  async applySnapshot(id: string): Promise<boolean> {
    try {
      const snapshot = await emitter.invoke('load-settings-snapshot', id);

      if (!snapshot) {
        console.error(`Snapshot with ID ${id} not found`);
        return false;
      }

      // Apply the snapshot values to the settings store
      settings.inlineStyle = snapshot.inlineStyle;
      settings.svgFilters = snapshot.svgFilters;

      // Update controller values
      if (snapshot.controllerValues) {
        Object.entries(snapshot.controllerValues).forEach(([varName, value]) => {
          settings.updateControllerValue(varName, value);
        });
      }

      // Trigger save in the settings store
      settings.markUnsaved();

      console.log(`Applied snapshot: ${snapshot.name}`);
      return true;
    } catch (error) {
      console.error(`Error applying snapshot with ID ${id}:`, error);
      return false;
    }
  }

  // Merge a settings snapshot with current settings
  async mergeSnapshot(id: string): Promise<boolean> {
    try {
      const snapshot = await emitter.invoke('load-settings-snapshot', id);

      if (!snapshot) {
        console.error(`Snapshot with ID ${id} not found`);
        return false;
      }

      // Merge the inline style
      if (snapshot.inlineStyle && settings.inlineStyle) {
        settings.inlineStyle = mergeInlineStyles(settings.inlineStyle, snapshot.inlineStyle);
      }

      // Update controller values
      if (snapshot.controllerValues) {
        Object.entries(snapshot.controllerValues).forEach(([varName, value]) => {
          settings.updateControllerValue(varName, value);
        });
      }

      // Keep current SVG filters
      // settings.svgFilters remains unchanged

      // Trigger save in the settings store
      settings.markUnsaved();

      console.log(`Merged snapshot: ${snapshot.name}`);
      return true;
    } catch (error) {
      console.error(`Error merging snapshot with ID ${id}:`, error);
      return false;
    }
  }

  // Delete a settings snapshot
  async deleteSnapshot(id: string): Promise<boolean> {
    try {
      const success = await emitter.invoke('delete-settings-snapshot', id);

      if (success) {
        // Refresh snapshots list
        await this.loadSnapshots();
        console.log(`Deleted snapshot with ID ${id}`);
      } else {
        console.error(`Failed to delete snapshot with ID ${id}`);
      }

      return success;
    } catch (error) {
      console.error(`Error deleting snapshot with ID ${id}:`, error);
      return false;
    }
  }

  // Get all snapshots
  get snapshots(): SettingsSnapshot[] {
    if (!this.#snapshotsLoaded) {
      this.loadSnapshots().catch(console.error);
    }
    return this.#snapshots;
  }
}

// Create and export a single instance of the snapshots store
export const snapshots = new SnapshotsStore();
