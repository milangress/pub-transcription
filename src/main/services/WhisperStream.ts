import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { ChildProcess, spawn } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import ggmlStreamBin from '../../../resources/lib/whisper-stream?asset&asarUnpack';
import ggmlModelSmallEnQ51Bin from '../../../resources/models/ggml-small.en-q5_1.bin?asset&asarUnpack';
import type { IpcRendererEvent, WhisperDevice } from '../../types/ipc';
import { jsonSafeParseWrapStringify } from '../utils/json';
import { whisperLogger } from '../utils/logger';
import { startPowerSaveBlocker } from '../utils/startPowerSaveBlocker';
import { getSessionPath } from './SessionManager';
const emitter = new IpcEmitter<IpcRendererEvent>();

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
  language: string;
  translate: boolean;
  deviceId: string;
}

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
  success: boolean;
  error?: string;
}

export class WhisperStreamManager {
  private activeProcess: ChildProcess | null = null;
  private mainWindow: BrowserWindow | null = null;
  private options: StreamOptions;
  private stopPowerSaveBlocker: (() => void) | null = null;

  constructor() {
    this.options = {
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
      deviceId: '',
    };
  }

  private getAudioDir(): string {
    const sessionDir = getSessionPath('whisper');
    if (sessionDir) {
      return sessionDir;
    }

    // Fallback to default audio directory if no session is active
    const defaultDir = join(app.getPath('userData'), 'whisper');
    if (!existsSync(defaultDir)) {
      mkdirSync(defaultDir, { recursive: true });
    }
    whisperLogger.debug(`No active session, using default audio directory: ${defaultDir}`);
    return defaultDir;
  }

  private constructSpawnArgs(extraArgs: string[] = []): string[] {
    const args = [
      '--model',
      this.options.model,
      '-t',
      this.options.threads.toString(),
      '--json',
      ...extraArgs,
    ];

    if (this.options.saveAudio) {
      args.push('--save-audio');
    }

    if (this.options.captureId !== undefined) {
      args.push('--capture', this.options.captureId.toString());
    }

    if (this.options.language) {
      args.push('--language', this.options.language);
    }

    if (this.options.translate) {
      args.push('--translate');
    }

    return args;
  }

  private sendToWindow(channel: keyof IpcRendererEvent, message: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      emitter.send(this.mainWindow.webContents, channel, message);
    } else {
      whisperLogger.error(`mainWindow Unavailable! Message: ${message}`);
    }
  }

  /**
   * Get audio devices from whisper-stream
   */
  async getAudioDevices(): Promise<WhisperDevice[]> {
    return getAudioDevices();
  }

  /**
   * Start the whisper stream process
   */
  start(window: BrowserWindow, options: Partial<StreamOptions> = {}): void {
    this.stop();
    this.mainWindow = window;
    this.options = { ...this.options, ...options };

    const audioDir = this.getAudioDir();
    const timestamp = new Date().getTime();
    const outputFile = join(audioDir, `transcript${timestamp}.jsonl`);

    const args = this.constructSpawnArgs([
      '--step',
      this.options.step.toString(),
      '--length',
      this.options.length.toString(),
      '--keep',
      this.options.keep.toString(),
      '--max-tokens',
      this.options.maxTokens.toString(),
      '--file',
      outputFile,
    ]);

    whisperLogger.debug(`Starting in ${audioDir}`);
    whisperLogger.debug(`Command: ${ggmlStreamBin} ${args.join(' ')}`);

    this.stopPowerSaveBlocker = startPowerSaveBlocker((msg) =>
      this.sendToWindow('whisper-ccp-stream:status', JSON.stringify({ text: msg })),
    );

    const ls = spawn(ggmlStreamBin, args, { cwd: audioDir });
    this.activeProcess = ls;

    ls.stdout.on('data', (data) => {
      const line = new TextDecoder().decode(data);
      const [result, error] = jsonSafeParseWrapStringify(line, (val) => ({ text: val }));
      if (!error.Fail()) {
        this.sendToWindow('whisper-ccp-stream:transcription', result!);
      } else {
        this.sendToWindow(
          'whisper-ccp-stream:status',
          JSON.stringify({ text: line, error: error }),
        );
        whisperLogger.error(`Failed to process stdout: ${error}`);
      }
    });
    ls.stderr.on('data', (data) => {
      const line = new TextDecoder().decode(data);
      const [result, error] = jsonSafeParseWrapStringify(line, (val) => ({ text: val }));
      if (!error.Fail()) {
        this.sendToWindow('whisper-ccp-stream:status', result);
      } else {
        whisperLogger.error(`Failed to process stderr: ${error}`);
      }
    });

    ls.on('error', (error: Error) => {
      whisperLogger.error(`Process error: ${error.message}`);
      const [result, wrapError] = jsonSafeParseWrapStringify({ error: error.message });
      if (!wrapError.Fail()) {
        this.sendToWindow('whisper-ccp-stream:status', result!);
      }
    });

    ls.on('close', (code: number | null) => {
      whisperLogger.error(`Process exited with code ${code}`);
      this.activeProcess = null;
      if (this.stopPowerSaveBlocker) {
        this.stopPowerSaveBlocker();
        this.stopPowerSaveBlocker = null;
      }
    });
  }

  /**
   * Stop the currently active stream process
   */
  stop(force: boolean = true): void {
    if (this.activeProcess) {
      try {
        this.activeProcess.kill();

        if (force) {
          setTimeout(() => {
            if (this.activeProcess) {
              try {
                this.activeProcess.kill('SIGKILL');
              } catch {
                // Process might already be gone
              }
              this.activeProcess = null;
            }
          }, 1000);
        }
      } catch {
        // Process might already be gone
        this.activeProcess = null;
      }
    }

    if (this.stopPowerSaveBlocker) {
      this.stopPowerSaveBlocker();
      this.stopPowerSaveBlocker = null;
    }

    this.mainWindow = null;
    this.options = { ...this.options, deviceId: '' };

    whisperLogger.info('Stopped whisper stream');
  }

  /**
   * Get the current options
   */
  getOptions(): StreamOptions {
    return { ...this.options };
  }

  /**
   * Check if a process is currently running
   */
  isRunning(): boolean {
    return this.activeProcess !== null;
  }
}

// Export a singleton instance
export const whisperStreamManager = new WhisperStreamManager();
