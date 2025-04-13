import { IpcListener } from '@electron-toolkit/typed-ipc/main';
import type { IpcEvents } from '../../types/ipc';
import { WhisperStreamManager, type StreamOptions } from '../services/WhisperStream';
import { mainWindowManager } from '../window/MainWindow';
const ipc = new IpcListener<IpcEvents>();
const whisperStreamManager = new WhisperStreamManager();
//const emitter = new IpcEmitter<IpcRendererEvent>();

export function setupWhisperStreamIPC(): void {
  // Get available audio devices
  ipc.handle('whisper:get-devices', async () => {
    try {
      return await whisperStreamManager.getAudioDevices();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to get audio devices: ${error.message}`);
      }
      throw new Error('Failed to get audio devices');
    }
  });

  // Get current whisper configuration
  ipc.handle('whisper:get-config', async () => {
    return whisperStreamManager.getOptions();
  });

  // Start whisper stream with configuration
  ipc.handle('whisper:start', async (_event, config: Partial<StreamOptions>) => {
    const mainWindow = mainWindowManager.getMainWindow();
    if (!mainWindow) {
      throw new Error('Main window not available');
    }

    try {
      whisperStreamManager.start(mainWindow, config);
      return true;
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
      whisperStreamManager.stop();
      return true;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to stop whisper stream: ${error.message}`);
      }
      throw new Error('Failed to stop whisper stream');
    }
  });
}
