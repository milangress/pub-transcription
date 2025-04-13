import { IpcListener } from '@electron-toolkit/typed-ipc/main';
import type { IpcEvents } from '../../types/ipc';
import { getAudioDevices, spawnWhisperStream, stopStreamProcess } from '../services/WhisperStream';
import { mainWindowManager } from '../window/MainWindow';

const ipc = new IpcListener<IpcEvents>();
//const emitter = new IpcEmitter<IpcRendererEvent>();

interface WhisperConfig {
  model: string;
  language: string;
  captureId?: number;
  threads?: number;
  step?: number;
  length?: number;
  keep?: number;
  maxTokens?: number;
  saveAudio?: boolean;
  translate?: boolean;
}

export function setupWhisperStreamIPC(): void {
  // Get available audio devices
  ipc.handle('whisper:get-devices', async () => {
    try {
      return await getAudioDevices();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to get audio devices: ${error.message}`);
      }
      throw new Error('Failed to get audio devices');
    }
  });

  // Get current whisper configuration
  ipc.handle('whisper:get-config', async () => {
    return {
      model: 'small.en',
      language: 'en',
      threads: 8,
      step: 800,
      length: 5000,
      keep: 300,
      maxTokens: 64,
      saveAudio: true,
      translate: false,
    };
  });

  // Start whisper stream with configuration
  ipc.handle('whisper:start', async (_event, config: Partial<WhisperConfig>) => {
    const mainWindow = mainWindowManager.getMainWindow();
    if (!mainWindow) {
      throw new Error('Main window not available');
    }

    try {
      const process = spawnWhisperStream(mainWindow, config);
      return process !== null;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to start whisper stream: ${error.message}`);
      }
      throw new Error('Failed to start whisper stream');
    }
  });

  // Stop whisper stream
  ipc.handle('whisper:stop', async () => {
    try {
      stopStreamProcess();
      return true;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to stop whisper stream: ${error.message}`);
      }
      throw new Error('Failed to stop whisper stream');
    }
  });
}
