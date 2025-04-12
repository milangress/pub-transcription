import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { ChildProcess, spawn } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import ggmlMetal from '../../../resources/lib/ggml-metal.metal?asset&asarUnpack';
import ggmlStreamBin from '../../../resources/lib/stream?asset&asarUnpack';
import ggmlModelSmallEnQ51Bin from '../../../resources/models/ggml-small.en-q5_1.bin?asset&asarUnpack';
import type { IpcRendererEvent } from '../../types/ipc';
import { serviceLogger } from '../utils/logger';
import { startPowerSaveBlocker } from '../utils/startPowerSaveBlocker';
import { getSessionPath } from './SessionManager';

const emitter = new IpcEmitter<IpcRendererEvent>();

// Keep track of the stream process
let activeStreamProcess: ChildProcess | null = null;

interface StreamOptions {
  name: string;
  model: string;
  metal: string;
  threads: number;
  step: number;
  length: number;
  keep: number;
  maxTokens: number;
  saveAudio: boolean;
}

const DEFAULT_OPTIONS: StreamOptions = {
  name: 'whisper-ccp-stream',
  model: ggmlModelSmallEnQ51Bin,
  metal: ggmlMetal,
  threads: 8,
  step: 800,
  length: 5000,
  keep: 300,
  maxTokens: 64,
  saveAudio: true,
};

/**
 * Creates and manages a child process for real-time audio stream transcription.
 *
 * @param mainWindow - The Electron main window instance to send transcription events
 * @param options - Optional configuration for the stream process
 * @returns The spawned child process instance
 *
 * The process handles:
 * - Spawning the stream executable with model and configuration parameters
 * - Streaming transcription data back to the main window
 * - Error handling and status updates
 * - Process lifecycle management
 */
export function spawnWhisperStream(
  mainWindow: BrowserWindow,
  options: Partial<StreamOptions> = {},
  printTranscription: boolean = false,
): ChildProcess {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const log = {
    msg: (message: string | object): void => {
      const text = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
      serviceLogger.debug(`[${mergedOptions.name}] ${text}`);
    },
    toWindow: (message: string): void => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        serviceLogger.debug(`[${mergedOptions.name}] [send] ${message}`);
        sendToWindowIfAvailable('whisper-ccp-stream:status', message);
      }
    },
    error: (message: string | object): void => {
      const text = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
      serviceLogger.error(`[${mergedOptions.name}] [error] ${text}`);
    },
  };

  const sendToWindowIfAvailable = (channel: keyof IpcRendererEvent, message: string): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      emitter.send(mainWindow.webContents, channel, message);
    } else {
      log.error(`mainWindow Unavailable! Message: ${message}`);
    }
  };

  // Use session audio directory if available, otherwise fallback to default
  let audioDir = getSessionPath('audio');

  if (!audioDir) {
    // Fallback to default audio directory if no session is active
    audioDir = join(app.getPath('userData'), 'audio');
    if (!existsSync(audioDir)) {
      mkdirSync(audioDir, { recursive: true });
    }
    log.msg(`No active session, using default audio directory: ${audioDir}`);
  } else {
    log.msg(`Using session audio directory: ${audioDir}`);
  }

  const spawnOptions = { cwd: audioDir };
  const args = [
    '--model',
    mergedOptions.model,
    '-t',
    mergedOptions.threads.toString(),
    '--step',
    mergedOptions.step.toString(),
    '--length',
    mergedOptions.length.toString(),
    '--keep',
    mergedOptions.keep.toString(),
    '--max-tokens',
    mergedOptions.maxTokens.toString(),
  ];

  if (mergedOptions.saveAudio) {
    args.push('--save-audio');
  }

  log.msg(`Starting in ${audioDir}`);
  log.msg(`Command: ${ggmlStreamBin} ${args.join(' ')}`);

  const stopPowerSaveBlocker = startPowerSaveBlocker(log.toWindow);

  const ls = spawn(ggmlStreamBin, args, spawnOptions);
  activeStreamProcess = ls;

  ls.stdout.on('data', (data: Buffer) => {
    const string = new TextDecoder().decode(data);
    if (printTranscription) {
      log.msg(`stdout: ${string}`);
    }
    sendToWindowIfAvailable('whisper-ccp-stream:transcription', string);
  });

  ls.stderr.on('data', (info: Buffer) => {
    const string = new TextDecoder().decode(info);
    log.toWindow(string);
  });

  ls.on('error', (error: Error) => {
    log.error(`Process error: ${error.message}`);
    log.toWindow(error.message);
  });

  ls.on('close', (code: number | null) => {
    log.error(`Process exited with code ${code}`);
    activeStreamProcess = null;
    stopPowerSaveBlocker();
  });

  return ls;
}

/**
 * Get the currently active stream process, if any
 */
export function getActiveStreamProcess(): ChildProcess | null {
  return activeStreamProcess;
}

/**
 * Stop the currently active stream process, if any
 */
export function stopStreamProcess(): void {
  if (activeStreamProcess) {
    activeStreamProcess.kill();
    activeStreamProcess = null;
  }
}
