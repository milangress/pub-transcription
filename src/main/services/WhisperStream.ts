import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { ChildProcess, spawn } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import ggmlStreamBin from '../../../resources/lib/whisper-stream?asset&asarUnpack';
import ggmlModelSmallEnQ51Bin from '../../../resources/models/ggml-small.en-q5_1.bin?asset&asarUnpack';
import type { IpcRendererEvent } from '../../types/ipc';
import {
  InitType,
  isOutputType,
  ParamsType,
  parseStderr,
  parseStdout,
  WhisperStreamOutput,
} from '../../types/whisperParser';
import { whisperLogger } from '../utils/logger';
import { startPowerSaveBlocker } from '../utils/startPowerSaveBlocker';
import { getSessionPath } from './SessionManager';

const emitter = new IpcEmitter<IpcRendererEvent>();

// Default whisper stream parameters based on CLI defaults
const DEFAULT_WHISPER_PARAMS: ParamsType = {
  model: ggmlModelSmallEnQ51Bin,
  n_threads: 4,
  step_ms: 3000,
  length_ms: 10000,
  keep_ms: 200,
  max_tokens: 32,
  save_audio: false,
  language: 'en',
  translate: false,
  capture_id: -1,
  audio_ctx: 0,
  beam_size: -1,
  vad_thold: 0.6,
  freq_thold: 100.0,
  get_audio_devices: false,
  no_fallback: false,
  no_context: true,
  no_timestamps: false,
  print_special: false,
  replay: false,
  replay_file: '',
  use_gpu: true,
  flash_attn: false,
  json_output: false,
  tinydiarize: false,
  print_tokens: false,
  fname_out: '',
};

export class WhisperStreamManager {
  private activeProcess: ChildProcess | null = null;
  private mainWindow: BrowserWindow | null = null;
  private options: Partial<ParamsType>;
  private stopPowerSaveBlocker: (() => void) | null = null;

  constructor() {
    // Only store options that differ from defaults
    this.options = {
      model: ggmlModelSmallEnQ51Bin,
      n_threads: 8,
      step_ms: 800,
      length_ms: 5000,
      keep_ms: 300,
      max_tokens: 64,
      save_audio: true,
      json_output: true,
    };
  }

  private constructSpawnArgs(overwriteOptions: Partial<ParamsType>): string[] {
    const args: string[] = [];
    // Merge defaults with stored options and overwrite options
    const options = {
      ...this.options,
      ...overwriteOptions,
    };
    console.log('options', options);

    // Helper function to safely add string arguments
    const addStringArg = (flag: string, value?: string | number): void => {
      if (value !== undefined && value !== null) {
        args.push(flag, String(value));
      }
    };

    // Helper function to safely add boolean flags
    const addBoolFlag = (flag: string, value?: boolean): void => {
      if (value === true) {
        args.push(flag);
      }
    };

    // Required arguments
    addStringArg('--model', options.model);

    // Thread control
    addStringArg('--threads', options.n_threads);

    // Audio parameters
    addStringArg('--step', options.step_ms);
    addStringArg('--length', options.length_ms);
    addStringArg('--keep', options.keep_ms);

    // Capture options
    if (options.capture_id !== undefined) {
      addStringArg('--capture', options.capture_id);
    }

    // Transcription options
    addStringArg('--max-tokens', options.max_tokens);
    addStringArg('--audio-ctx', options.audio_ctx);
    addStringArg('--beam-size', options.beam_size);

    // Threshold values - ensure these are properly formatted as floats
    if (options.vad_thold !== undefined) {
      addStringArg('--vad-thold', options.vad_thold.toFixed(2));
    }

    if (options.freq_thold !== undefined) {
      addStringArg('--freq-thold', options.freq_thold.toFixed(2));
    }

    // Language options - ensure language codes are sanitized
    if (options.language) {
      // Sanitize language code to prevent injection
      const sanitizedLang = options.language.replace(/[^a-zA-Z-]/g, '').slice(0, 5);
      addStringArg('--language', sanitizedLang);
    }

    // Flags
    addBoolFlag('--translate', options.translate);
    addBoolFlag('--no-fallback', options.no_fallback);
    addBoolFlag('--print-special', options.print_special);
    addBoolFlag('--keep-context', options.no_context === false);
    addBoolFlag('--tinydiarize', options.tinydiarize);
    addBoolFlag('--save-audio', options.save_audio);
    addBoolFlag('--flash-attn', options.flash_attn);
    addBoolFlag('--json', options.json_output);
    addBoolFlag('--print-tokens', options.print_tokens);

    // File handling
    if (options.replay && options.replay_file) {
      // Sanitize file path to prevent any potential issues
      const safeReplayFile = options.replay_file.replace(/[\\'"]/g, '');
      addStringArg('--replay', safeReplayFile);
    }

    addBoolFlag('--get-audio-devices', options.get_audio_devices);

    // Output file
    if (options.fname_out === 'default') {
      const audioDir = this.getAudioDir();
      const timestamp = new Date().getTime();
      const outputFile = join(audioDir, `transcript${timestamp}.jsonl`);
      addStringArg('--file', outputFile);
    } else if (options.fname_out) {
      // Sanitize file path
      const safeOutputFile = options.fname_out.replace(/[\\'"]/g, '');
      addStringArg('--file', safeOutputFile);
    }

    return args;
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
  private spawnWhisperStream(overwriteOptions: Partial<ParamsType>): ChildProcess {
    // Update options with only the differences from defaults
    const newOptions = {
      ...overwriteOptions,
    };

    // Only store non-default values
    Object.keys(newOptions).forEach((key) => {
      if (newOptions[key] === DEFAULT_WHISPER_PARAMS[key]) {
        delete newOptions[key];
      }
    });

    this.options = {
      ...this.options,
      ...newOptions,
    };

    whisperLogger.debug(`Spawning whisper-stream with args: ${JSON.stringify(this.options)}`);
    const audioDir = this.getAudioDir();
    const args = this.constructSpawnArgs(overwriteOptions);
    whisperLogger.debug(`Spawning whisper-stream with args: ${args.join(' ')}`);
    whisperLogger.debug(`Spawning whisper-stream cwd: ${audioDir}`);
    return spawn(ggmlStreamBin, args, { cwd: audioDir });
  }

  private sendToWindow(channel: keyof IpcRendererEvent, message: WhisperStreamOutput): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      emitter.send(this.mainWindow.webContents, channel, message);
    } else {
      const messageString = JSON.stringify(message).slice(0, 50);
      whisperLogger.error(`send to mainWindow Unavailable!: ${messageString}`);
    }
  }

  /**
   * Get audio devices from whisper-stream
   */
  async getInitObject(): Promise<InitType> {
    return new Promise((resolve, reject) => {
      const ls = this.spawnWhisperStream({ get_audio_devices: true });
      let initResponse: InitType | null = null;

      ls.stdout?.on('data', (data) => {
        console.log('DATA-START\n' + data.toString() + '\nDATA-END');
        const parsed = parseStdout(data.toString());
        console.log('parsed', parsed);
        if (isOutputType(parsed, 'init')) {
          initResponse = parsed;
          return resolve(parsed);
        }
      });

      ls.stderr?.on('data', (data) => {
        const parsed = parseStderr(data.toString());
        this.sendToWindow('whisper-ccp-stream:status', parsed);
      });

      ls.on('error', (error: Error) => {
        whisperLogger.error(`getAudioDevices error: ${error.message}`);
        reject(error);
      });

      ls.on('close', (code: number | null) => {
        setTimeout(() => {
          if (!initResponse) {
            reject(new Error(`Process exited with code ${code} without returning devices`));
          }
        }, 2000);
      });
    });
  }

  /**
   * Start the whisper stream process
   */
  start(window: BrowserWindow, options: Partial<ParamsType> = {}): void {
    this.stop();
    this.mainWindow = window;

    const localOptions = {
      ...options,
      ...{
        get_audio_devices: false,
        fname_out: 'default',
        json: true,
      },
    };

    const ls = this.spawnWhisperStream(localOptions);

    this.stopPowerSaveBlocker = startPowerSaveBlocker((msg) =>
      this.sendToWindow('whisper-ccp-stream:status', { text: msg, type: 'stdout' }),
    );

    this.activeProcess = ls;

    ls.stdout?.on('data', (data) => {
      try {
        const parsed = parseStdout(data.toString());
        if (parsed.type === 'transcription') {
          console.log('Final: ', parsed.text);
        } else if (parsed.type === 'prediction') {
          console.log('Pred: ', parsed.text);
        } else {
          console.log('Unkn?: ', JSON.stringify(parsed).slice(0, 100));
        }

        this.sendToWindow('whisper-ccp-stream:transcription', parsed);
      } catch (error) {
        whisperLogger.error(`Failed to process stdout: ${error}`, data);
      }
    });

    ls.stderr?.on('data', (data) => {
      try {
        const parsed = parseStderr(data.toString());
        this.sendToWindow('whisper-ccp-stream:status', parsed);
      } catch (error) {
        whisperLogger.error(`Failed to process stderr: ${error}`, data);
      }
    });

    ls.on('error', (error: Error) => {
      whisperLogger.error(`Process error: ${error.message}`);
    });

    ls.on('close', (code: number | null) => {
      whisperLogger.warn(`Process exited with code ${code}`);
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

    whisperLogger.info('Stopped whisper stream');
  }

  /**
   * Check if a process is currently running
   */
  isRunning(): boolean {
    return this.activeProcess !== null;
  }

  /**
   * Get the current whisper stream options
   */
  getParams(): Partial<ParamsType> {
    return this.options;
  }
}

// Export a singleton instance
export const whisperStreamManager = new WhisperStreamManager();
