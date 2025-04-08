import { app } from 'electron';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { SettingsSnapshot, SettingsSnapshotListResponse } from '../../types';

// Snapshots directory
const SNAPSHOTS_DIR = join(app.getPath('userData'), 'setting-snapshots');

// Ensure snapshots directory exists
async function ensureSnapshotsDir(): Promise<void> {
  if (!existsSync(SNAPSHOTS_DIR)) {
    await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
  }
}

// Save a settings snapshot
export async function saveSnapshot(snapshot: SettingsSnapshot): Promise<SettingsSnapshot> {
  try {
    await ensureSnapshotsDir();

    // Generate ID if not provided
    if (!snapshot.id) {
      snapshot.id = uuidv4();
    }

    // Add timestamp if not provided
    if (!snapshot.timestamp) {
      snapshot.timestamp = Date.now();
    }

    // Create filename with ID for uniqueness
    const filename = `snapshot-${snapshot.id}.json`;
    const filePath = join(SNAPSHOTS_DIR, filename);

    // Write snapshot to file
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');

    return snapshot;
  } catch (error) {
    console.error('Error saving settings snapshot:', error);
    throw error;
  }
}

// Get all settings snapshots
export async function getSnapshots(): Promise<SettingsSnapshotListResponse> {
  try {
    await ensureSnapshotsDir();

    // Get all snapshot files
    const files = await fs.readdir(SNAPSHOTS_DIR);
    const snapshotFiles = files.filter(
      (file) => file.startsWith('snapshot-') && file.endsWith('.json'),
    );

    // Load each snapshot file
    const snapshots: SettingsSnapshot[] = [];

    for (const file of snapshotFiles) {
      try {
        const content = await fs.readFile(join(SNAPSHOTS_DIR, file), 'utf-8');
        const snapshot = JSON.parse(content) as SettingsSnapshot;
        snapshots.push(snapshot);
      } catch (e) {
        console.error(`Error reading snapshot file ${file}:`, e);
        // Continue with other files
      }
    }

    // Sort by timestamp (newest first)
    snapshots.sort((a, b) => b.timestamp - a.timestamp);

    return {
      snapshots,
      success: true,
    };
  } catch (error) {
    console.error('Error getting settings snapshots:', error);
    return {
      snapshots: [],
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Load a specific settings snapshot
export async function loadSnapshot(id: string): Promise<SettingsSnapshot | null> {
  try {
    await ensureSnapshotsDir();

    const filename = `snapshot-${id}.json`;
    const filePath = join(SNAPSHOTS_DIR, filename);

    if (!existsSync(filePath)) {
      console.warn(`Snapshot with ID ${id} not found`);
      return null;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as SettingsSnapshot;
  } catch (error) {
    console.error(`Error loading snapshot with ID ${id}:`, error);
    throw error;
  }
}

// Delete a settings snapshot
export async function deleteSnapshot(id: string): Promise<boolean> {
  try {
    await ensureSnapshotsDir();

    const filename = `snapshot-${id}.json`;
    const filePath = join(SNAPSHOTS_DIR, filename);

    if (!existsSync(filePath)) {
      console.warn(`Snapshot with ID ${id} not found for deletion`);
      return false;
    }

    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error(`Error deleting snapshot with ID ${id}:`, error);
    return false;
  }
}
