import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/renderer';
import type { IpcEvents, IpcRendererEvent } from 'src/types/ipc';
import type {
  DeviceType,
  ParamsType,
  TranscriptionType,
  WhisperStreamOutput,
} from '../../../types/whisperParser';

class WhisperStore {
  #isStreaming = $state(false);
  #emitter = new IpcEmitter<IpcEvents>();
  #ipc = new IpcListener<IpcRendererEvent>();

  // Store state
  #devices = $state<DeviceType[]>([]);
  #params = $state<Partial<ParamsType>>({
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
    replay: false,
    replay_file: '',
    model: '',
  });
  #miniLogs = $state<string[]>([]);

  #transcriptions = $state<TranscriptionType[]>([]);

  constructor() {
    this.setupIpcListeners();
  }

  get transcriptions(): TranscriptionType[] {
    return this.#transcriptions;
  }
  get devices(): DeviceType[] {
    return this.#devices;
  }
  get params(): Partial<ParamsType> {
    return this.#params;
  }
  get isStreaming(): boolean {
    return this.#isStreaming;
  }
  get miniLogs(): string[] {
    return this.#miniLogs;
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

  addMiniLog(message: string): void {
    message.split('\n').forEach((line) => {
      this.#miniLogs = [...this.#miniLogs, line];
    });
  }

  clearMiniLogs(): void {
    this.#miniLogs = [];
  }

  // IPC Methods
  async startStream(): Promise<void> {
    this.#isStreaming = true;
    await this.#emitter.invoke('whisper:start', $state.snapshot(this.#params));
  }

  async stopStream(): Promise<void> {
    this.#isStreaming = false;
    await this.#emitter.invoke('whisper:stop');
  }

  async reloadAudioDevices(): Promise<void> {
    try {
      const response = await this.#emitter.invoke('whisper:get-init-object');
      if (response) {
        if (response.devices) {
          this.#devices = response.devices;
          this.addMiniLog('Successfully fetched audio devices');
        }
      } else {
        this.addMiniLog('No devices or params found in response');
      }
    } catch (error) {
      this.addMiniLog(`Error getInitObject: ${error}`);
    }
  }

  private setupIpcListeners() {
    const removeTranscriptionListener = this.#ipc.on(
      'whisper-ccp-stream:transcription',
      (_, data: WhisperStreamOutput) => {
        this.#isStreaming = true;
        if (data.type === 'transcription') {
          this.addMiniLog(data.text);
        }
      },
    );

    const removeStatusListener = this.#ipc.on(
      'whisper-ccp-stream:status',
      (_, status: WhisperStreamOutput) => {
        if (status.type === 'stderr' || status.type === 'stdout') {
          this.addMiniLog(status.text);
        } else {
          this.addMiniLog(JSON.stringify(status));
        }
      },
    );

    return (): void => {
      removeTranscriptionListener();
      removeStatusListener();
    };
  }
}

export const whisperStore = new WhisperStore();
