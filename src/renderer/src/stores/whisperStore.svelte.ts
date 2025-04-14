import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/renderer';
import type { IpcEvents, IpcRendererEvent } from 'src/types/ipc';

// Types
interface AudioDevice {
  id: number;
  name: string;
}

interface WhisperParams {
  audio_ctx: number;
  beam_size: number;
  capture_id: number;
  flash_attn: boolean;
  freq_thold: number;
  keep_ms: number;
  language: string;
  length_ms: number;
  max_tokens: number;
  n_threads: number;
  no_context: boolean;
  no_fallback: boolean;
  print_special: boolean;
  save_audio: boolean;
  step_ms: number;
  translate: boolean;
  use_gpu: boolean;
  vad_thold: number;
}

class WhisperStore {
  #emitter = new IpcEmitter<IpcEvents>();
  #ipc = new IpcListener<IpcRendererEvent>();

  // Store state
  #devices = $state<AudioDevice[]>([]);
  #params = $state<WhisperParams>({
    audio_ctx: 0,
    beam_size: -1,
    capture_id: -1,
    flash_attn: false,
    freq_thold: 100.0,
    keep_ms: 200,
    language: 'en',
    length_ms: 10000,
    max_tokens: 0,
    n_threads: 4,
    no_context: true,
    no_fallback: false,
    print_special: false,
    save_audio: false,
    step_ms: 3000,
    translate: false,
    use_gpu: true,
    vad_thold: 0.6,
  });
  #transcriptionLines = $state<string[]>([]);
  #statusMessages = $state<string[]>([]);

  constructor() {
    this.setupIpcListeners();
    this.reloadAudioDevicesAndParams();
  }

  // Public getters
  get devices(): AudioDevice[] {
    return this.#devices;
  }
  get params(): WhisperParams {
    return this.#params;
  }
  get transcriptionLines(): string[] {
    return this.#transcriptionLines;
  }
  get statusMessages(): string[] {
    return this.#statusMessages;
  }

  get captureIdString(): string {
    return String('#' + this.#params.capture_id);
  }
  set captureIdString(value: string) {
    this.#params.capture_id = parseInt(value.replace('#', ''));
  }
  get deviceOptionsObject(): { value: string; label: string }[] {
    return this.#devices.map((device) => ({
      value: '#' + device.id.toString(),
      label: `(${device.id}) ${device.name}`,
    }));
  }

  // Actions
  addTranscriptionLine(line: string): void {
    this.#transcriptionLines = [...this.#transcriptionLines, line];
  }

  addStatusMessage(message: string): void {
    this.#statusMessages = [...this.#statusMessages, message];
  }

  clearTranscriptionLines(): void {
    this.#transcriptionLines = [];
  }

  clearStatusMessages(): void {
    this.#statusMessages = [];
  }

  clearAllLogs(): void {
    this.clearTranscriptionLines();
    this.clearStatusMessages();
  }

  // IPC Methods
  async startStream(): Promise<void> {
    await this.#emitter.invoke('whisper:start', this.#params);
  }

  async stopStream(): Promise<void> {
    await this.#emitter.invoke('whisper:stop');
  }

  async reloadAudioDevicesAndParams(): Promise<void> {
    try {
      const response = await this.#emitter.invoke('whisper:get-init-object');
      if (response) {
        if (response.devices) {
          this.#devices = response.devices;
          this.addStatusMessage('Successfully fetched audio devices');
        }
        if (response.params) {
          // Update params while preserving reactivity
          Object.assign(this.#params, response.params);
          this.addStatusMessage('Successfully loaded whisper parameters');
        }
      } else {
        this.addStatusMessage('No devices or params found in response');
      }
    } catch (error) {
      this.addStatusMessage(`Error fetching devices and params: ${error}`);
    }
  }

  private setupIpcListeners() {
    const removeTranscriptionListener = this.#ipc.on('whisper-ccp-stream:transcription', (data) => {
      if (typeof data === 'string') {
        try {
          const parsedData = JSON.parse(data);
          if (parsedData.text) {
            this.addTranscriptionLine(parsedData.text);
          }
        } catch {
          this.addTranscriptionLine(data);
        }
      } else {
        this.addTranscriptionLine(JSON.stringify(data));
      }
    });

    const removeStatusListener = this.#ipc.on('whisper-ccp-stream:status', (data) => {
      if (typeof data === 'string') {
        try {
          const parsedData = JSON.parse(data);
          if (parsedData.text) {
            this.addStatusMessage(parsedData.text);
          }
        } catch {
          this.addStatusMessage(data);
        }
      } else {
        this.addStatusMessage(JSON.stringify(data));
      }
    });

    return (): void => {
      removeTranscriptionListener();
      removeStatusListener();
    };
  }
}

export const whisperStore = new WhisperStore();
