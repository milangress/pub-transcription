import { ChildProcess, spawn } from 'child_process'
import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// Keep track of the stream process
let activeStreamProcess: ChildProcess | null = null

interface StreamOptions {
  model: string
  threads: number
  step: number
  length: number
  keep: number
  maxTokens: number
  saveAudio: boolean
}

const DEFAULT_OPTIONS: StreamOptions = {
  model: 'models/ggml-small.en-q5_1.bin',
  threads: 8,
  step: 800,
  length: 5000,
  keep: 300,
  maxTokens: 64,
  saveAudio: true
}

/**
 * Creates and manages a child process for real-time audio stream transcription.
 *
 * @param mainWindow - The Electron main window instance to send transcription events
 * @param baseDir - Base directory path for locating the stream executable and model files
 * @param options - Optional configuration for the stream process
 * @returns The spawned child process instance
 *
 * The process handles:
 * - Spawning the stream executable with model and configuration parameters
 * - Streaming transcription data back to the main window
 * - Error handling and status updates
 * - Process lifecycle management
 */
export function createStreamProcess(
  mainWindow: BrowserWindow,
  baseDir: string,
  options: Partial<StreamOptions> = {}
): ChildProcess {
  // Create audio directory in userData if it doesn't exist
  const audioDir = join(app.getPath('userData'), 'audio')
  if (!existsSync(audioDir)) {
    mkdirSync(audioDir, { recursive: true })
  }

  // Change working directory to audioDir before spawning process
  const spawnOptions = {
    cwd: audioDir
  }

  console.log(`Audio directory: '${audioDir}'`)

  const streamPath = join(baseDir, 'lib/stream')
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  console.log(`Stream path: '${streamPath}'`)

  const args = [
    '--model',
    join(baseDir, mergedOptions.model),
    '-t',
    mergedOptions.threads.toString(),
    '--step',
    mergedOptions.step.toString(),
    '--length',
    mergedOptions.length.toString(),
    '--keep',
    mergedOptions.keep.toString(),
    '--max-tokens',
    mergedOptions.maxTokens.toString()
  ]

  if (mergedOptions.saveAudio) {
    args.push('--save-audio')
  }

  const ls = spawn(streamPath, args, spawnOptions)

  // Store the process for cleanup
  activeStreamProcess = ls

  ls.stdout.on('data', (data: Buffer) => {
    const string = new TextDecoder().decode(data)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-data', string)
    }
  })

  ls.stderr.on('data', (info: Buffer) => {
    console.log(`stderr: ${info}`)
    const string = new TextDecoder().decode(info)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-status', string)
    }
  })

  ls.on('error', (error: Error) => {
    console.log(`error: ${error.message}`)
    if (mainWindow) {
      mainWindow.webContents.send('transcription-status', error.message)
    }
  })

  ls.on('close', (code: number | null) => {
    console.log(`child process exited with code ${code}`)
    activeStreamProcess = null
  })

  return ls
}

/**
 * Get the currently active stream process, if any
 */
export function getActiveStreamProcess(): ChildProcess | null {
  return activeStreamProcess
}

/**
 * Stop the currently active stream process, if any
 */
export function stopStreamProcess(): void {
  if (activeStreamProcess) {
    activeStreamProcess.kill()
    activeStreamProcess = null
  }
} 