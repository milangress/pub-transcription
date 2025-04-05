import { PvRecorder } from '@picovoice/pvrecorder-node'
import { writeFileSync } from 'fs'
import { WaveFile } from 'wavefile'

interface AudioFrame extends Int16Array {
  readonly length: number
}

/**
 * AudioRecorder handles real-time audio recording and transcription using PvRecorder.
 * Captures audio in frames, converts them to WAV format, and processes them through
 * Whisper for transcription.
 *
 * Features:
 * - Real-time audio frame collection
 * - Automatic WAV file generation
 * - Integration with Whisper transcription
 * - Device management
 */
export class AudioRecorder {
  private frames: AudioFrame[]
  private recorder: PvRecorder | null
  private readonly frameSize: number
  private readonly deviceIndex: number

  constructor(frameSize = 512, deviceIndex = 1) {
    this.frames = []
    this.recorder = null
    this.frameSize = frameSize
    this.deviceIndex = deviceIndex
  }

  getAvailableDevices(): string[] {
    return PvRecorder.getAvailableDevices()
  }

  async start(): Promise<void> {
    this.recorder = new PvRecorder(this.frameSize, this.deviceIndex)
    console.log(`Using PvRecorder version: ${this.recorder.version}`)
    this.recorder.start()

    while (this.recorder.isRecording) {
      const frame = await this.recorder.read()
      this.frames.push(frame as AudioFrame)

      if (this.frames.length > 200) {
        await this.saveAndTranscribe()
        this.frames.length = 0
      }
    }
  }

  async saveAndTranscribe(): Promise<string> {
    if (!this.recorder) {
      throw new Error('Recorder not initialized')
    }

    const wav = new WaveFile()
    const audioData = new Int16Array(this.recorder.frameLength * this.frames.length)

    for (let i = 0; i < this.frames.length; i++) {
      audioData.set(this.frames[i], i * this.recorder.frameLength)
    }

    wav.fromScratch(1, this.recorder.sampleRate, '16', audioData)
    writeFileSync('test.wav', wav.toBuffer())
    console.log('Wrote test.wav')
    return 'test.wav'
  }

  stop(): void {
    if (this.recorder) {
      this.recorder.stop()
      this.recorder.release()
      this.recorder = null
    }
  }
}
