const { PvRecorder } = require('@picovoice/pvrecorder-node')
const { WaveFile } = require('wavefile')
const fs = require('fs')
const { transcribeWavFile } = require('./whisperTranscription')

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
 *
 * @exports AudioRecorder
 */
class AudioRecorder {
  constructor() {
    this.frames = []
    this.recorder = null
  }

  getAvailableDevices() {
    return PvRecorder.getAvailableDevices()
  }

  async start() {
    this.recorder = new PvRecorder(512, 1)
    console.log(`Using PvRecorder version: ${this.recorder.version}`)
    this.recorder.start()

    while (this.recorder.isRecording) {
      const frame = await this.recorder.read()
      this.frames.push(frame)

      if (this.frames.length > 200) {
        await this.saveAndTranscribe()
        this.frames.length = 0
      }
    }
  }

  async saveAndTranscribe() {
    const wav = new WaveFile()
    const audioData = new Int16Array(this.recorder.frameLength * this.frames.length)

    for (let i = 0; i < this.frames.length; i++) {
      audioData.set(this.frames[i], i * this.recorder.frameLength)
    }

    wav.fromScratch(1, this.recorder.sampleRate, '16', audioData)
    fs.writeFileSync('test.wav', wav.toBuffer())
    console.log('Wrote test.wav')

    const transcript = await transcribeWavFile('test.wav')
    console.log(transcript)
    return transcript
  }

  stop() {
    if (this.recorder) {
      this.recorder.stop()
      this.recorder.release()
      this.recorder = null
    }
  }
}

module.exports = {
  AudioRecorder
}
