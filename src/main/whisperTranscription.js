async function transcribeWavFile(filePath, options = {}) {
  const Whisper = await import('whisper-node-anas23')

  const defaultOptions = {
    modelName: 'base.en',
    whisperOptions: {
      gen_file_txt: false,
      gen_file_subtitle: false,
      gen_file_vtt: false
    }
  }

  const transcriptionOptions = {
    ...defaultOptions,
    ...options
  }

  const transcript = await Whisper.whisper(filePath, transcriptionOptions)
  return transcript
}

module.exports = {
  transcribeWavFile
}
