import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { ChildProcess, spawn } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import ggmlStreamBin from '../../../resources/lib/whisper-stream?asset&asarUnpack';
import ggmlModelSmallEnQ51Bin from '../../../resources/models/ggml-small.en-q5_1.bin?asset&asarUnpack';
import type { IpcRendererEvent, WhisperDevice } from '../../types/ipc';
import { jsonSafeParse, jsonSafeParseWrapStringify } from '../utils/json';
import { serviceLogger } from '../utils/logger';
import { simulateWhisperFromFile } from '../utils/simulateTranscriptFromText';
import { startPowerSaveBlocker } from '../utils/startPowerSaveBlocker';
import { getSessionPath } from './SessionManager';

const emitter = new IpcEmitter<IpcRendererEvent>();

// Keep track of the stream process or simulation controller
let activeStreamProcess: ChildProcess | null = null;
let activeSimulationController: ReturnType<typeof simulateWhisperFromFile> | null = null;

interface StreamOptions {
  name: string;
  model: string;
  threads: number;
  step: number;
  length: number;
  keep: number;
  maxTokens: number;
  saveAudio: boolean;
  captureId?: number;
  language?: string;
  translate?: boolean;
}

// Keep track of the last used options
let lastUsedOptions: StreamOptions = {
  name: 'whisper-stream',
  model: ggmlModelSmallEnQ51Bin,
  threads: 8,
  step: 800,
  length: 5000,
  keep: 300,
  maxTokens: 64,
  saveAudio: true,
  language: 'en',
  translate: false,
};

interface WhisperInitResponse {
  devices: WhisperDevice[];
  model: {
    audio_ctx: number;
    multilingual: number;
    name: string;
    text_ctx: number;
    type: string;
    vocab_size: number;
  };
  params: {
    [key: string]: unknown;
  };
  type: string;
}

/**
 * Get audio devices from whisper-stream
 * @returns List of audio devices and their IDs
 */
export async function getAudioDevices(): Promise<WhisperDevice[]> {
  const audioDir = getSessionPath('whisper') || join(app.getPath('userData'), 'whisper');

  return new Promise((resolve, reject) => {
    try {
      // Use last options but enforce --get-audio-devices and --json
      const args = [
        '--model',
        lastUsedOptions.model,
        '-t',
        lastUsedOptions.threads.toString(),
        '--get-audio-devices',
        '--json',
      ];

      const ls = spawn(ggmlStreamBin, args, {
        cwd: audioDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      ls.stdout?.on('data', (data: Buffer) => {
        const line = new TextDecoder().decode(data);
        const [json, error] = jsonSafeParse<WhisperInitResponse>(line);

        if (error.Fail()) {
          // Not JSON or invalid JSON, ignore
          return;
        }

        if (json?.type === 'init' && Array.isArray(json.devices)) {
          resolve(json.devices);
        }
      });

      ls.stderr?.on('data', (data: Buffer) => {
        const line = new TextDecoder().decode(data);
        serviceLogger.debug(`[getAudioDevices] stderr: ${line}`);
      });

      ls.on('error', (error: Error) => {
        reject(new Error(`Failed to spawn whisper-stream: ${error.message}`));
      });

      ls.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Unknown error occurred'));
    }
  });
}

/**
 * Creates and manages either a real whisper stream process or a simulated one for development
 *
 * @param mainWindow - The Electron main window instance to send transcription events
 * @param options - Optional configuration for the stream process
 * @returns The spawned child process instance if not in simulation mode
 */
export function spawnWhisperStream(
  mainWindow: BrowserWindow,
  options: Partial<StreamOptions> = {},
  printTranscription: boolean = false,
): ChildProcess | null {
  // Update last used options
  lastUsedOptions = { ...lastUsedOptions, ...options };

  // Check if we're in simulation mode
  if (process.argv.includes('--simulate')) {
    serviceLogger.info('Running in simulation mode');
    activeSimulationController = simulateWhisperFromFile(mainWindow);
    setTimeout(() => {
      activeSimulationController?.start();
    }, 5000);
    return null;
  }

  const log = {
    msg: (message: string | object): void => {
      const text = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
      serviceLogger.debug(`[${lastUsedOptions.name}] ${text}`);
    },
    toWindow: (message: string): void => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        serviceLogger.debug(`[${lastUsedOptions.name}] [send] ${message}`);
        sendToWindowIfAvailable('whisper-ccp-stream:status', message);
      }
    },
    error: (message: string | object): void => {
      const text = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
      serviceLogger.error(`[${lastUsedOptions.name}] [error] ${text}`);
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
  let audioDir = getSessionPath('whisper');

  if (!audioDir) {
    // Fallback to default audio directory if no session is active
    audioDir = join(app.getPath('userData'), 'whisper');
    if (!existsSync(audioDir)) {
      mkdirSync(audioDir, { recursive: true });
    }
    log.msg(`No active session, using default audio directory: ${audioDir}`);
  } else {
    log.msg(`Using session audio directory: ${audioDir}`);
  }

  const timestamp = new Date().getTime();
  const outputFile = join(audioDir, `transcript${timestamp}.jsonl`);

  const spawnOptions = { cwd: audioDir };
  const args = [
    '--model',
    lastUsedOptions.model,
    '-t',
    lastUsedOptions.threads.toString(),
    '--step',
    lastUsedOptions.step.toString(),
    '--length',
    lastUsedOptions.length.toString(),
    '--keep',
    lastUsedOptions.keep.toString(),
    '--max-tokens',
    lastUsedOptions.maxTokens.toString(),
    '--json',
    '--file',
    outputFile,
  ];

  if (lastUsedOptions.saveAudio) {
    args.push('--save-audio');
  }

  if (lastUsedOptions.captureId !== undefined) {
    args.push('--capture', lastUsedOptions.captureId.toString());
  }

  if (lastUsedOptions.language) {
    args.push('--language', lastUsedOptions.language);
  }

  if (lastUsedOptions.translate) {
    args.push('--translate');
  }

  log.msg(`Starting in ${audioDir}`);
  log.msg(`Command: ${ggmlStreamBin} ${args.join(' ')}`);

  const stopPowerSaveBlocker = startPowerSaveBlocker(log.toWindow);

  const ls = spawn(ggmlStreamBin, args, spawnOptions);
  activeStreamProcess = ls;

  ls.stdout.on('data', (data: Buffer) => {
    const line = new TextDecoder().decode(data);
    if (printTranscription) {
      log.msg(`stdout: ${line}`);
    }

    // Try to parse as JSON
    const [json, parseError] = jsonSafeParse<unknown>(line);
    if (parseError.Fail()) {
      // If not JSON, wrap in a text object
      const [wrapped, wrapError] = jsonSafeParseWrapStringify({ text: line });
      if (wrapError.Fail()) {
        log.error(`Failed to wrap text: ${wrapError}`);
        return;
      }
      sendToWindowIfAvailable('whisper-ccp-stream:transcription', wrapped!);
    } else {
      // If JSON, send as is
      const [stringified, stringifyError] = jsonSafeParseWrapStringify(json);
      if (stringifyError.Fail()) {
        log.error(`Failed to stringify JSON: ${stringifyError}`);
        return;
      }
      sendToWindowIfAvailable('whisper-ccp-stream:transcription', stringified!);
    }
  });

  ls.stderr.on('data', (info: Buffer) => {
    const line = new TextDecoder().decode(info);
    // Send stderr as status messages
    const [wrapped, error] = jsonSafeParseWrapStringify({ text: line });
    if (error.Fail()) {
      log.error(`Failed to wrap stderr: ${error}`);
      return;
    }
    sendToWindowIfAvailable('whisper-ccp-stream:status', wrapped!);
  });

  ls.on('error', (error: Error) => {
    log.error(`Process error: ${error.message}`);
    const [wrapped, wrapError] = jsonSafeParseWrapStringify({ error: error.message });
    if (wrapError.Fail()) {
      log.error(`Failed to wrap error: ${wrapError}`);
      return;
    }
    sendToWindowIfAvailable('whisper-ccp-stream:status', wrapped!);
  });

  ls.on('close', (code: number | null) => {
    log.error(`Process exited with code ${code}`);
    activeStreamProcess = null;
    stopPowerSaveBlocker();
  });

  return ls;
}

/**
 * Stop the currently active stream process or simulation, if any
 * @param force Whether to force kill the process if it doesn't exit gracefully
 */
export function stopStreamProcess(force: boolean = true): void {
  // Stop simulation if active
  if (activeSimulationController) {
    activeSimulationController.stop();
    activeSimulationController = null;
    return;
  }

  // Stop real process if active
  if (activeStreamProcess) {
    try {
      // First try graceful shutdown
      activeStreamProcess.kill();

      if (force) {
        // Force kill after a short delay if process is still running
        setTimeout(() => {
          if (activeStreamProcess) {
            try {
              activeStreamProcess.kill('SIGKILL');
            } catch {
              // Process might already be gone
            }
            activeStreamProcess = null;
          }
        }, 1000);
      }
    } catch {
      // Process might already be gone
      activeStreamProcess = null;
    }
  }
}

/**
 * Get the currently active stream process, if any
 */
export function getActiveStreamProcess(): ChildProcess | null {
  return activeStreamProcess;
}

/**
 * Get the last used options
 */
export function getLastUsedOptions(): StreamOptions {
  return { ...lastUsedOptions };
}
