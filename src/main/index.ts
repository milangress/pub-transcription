import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import Store from 'electron-store'
import { EventEmitter } from 'events'
import { existsSync, promises as fs } from 'fs'
import { join } from 'path'
import icon from '../../resources/favicon.png?asset'

import { AudioRecorder } from './audioRecorder'
import { createPrintStatusMessage, PRINT_ACTIONS, PRINT_STATUS } from './printMessages'
import { PrintQueue } from './PrintQueue'
import { simulatedTranscriptController } from './simulateTranscriptForDevTesting'
import { createStreamProcess } from './streamProcess'

import type { PrintCompletionEvent, PrintRequest, PrintStatusMessage } from '../types'

// Local types
interface PrintWindowOptions extends Electron.BrowserWindowConstructorOptions {
  width: number
  height: number
  show: boolean
  webPreferences: {
    scrollBounce: boolean
    nodeIntegration: boolean
    contextIsolation: boolean
    preload: string
  }
}

interface MainWindowOptions extends Electron.BrowserWindowConstructorOptions {
  width: number
  height: number
  webPreferences: {
    titleBarStyle: {
      hiddenInset: boolean
    }
    nodeIntegration: boolean
    preload: string
  }
  icon: string
  show: boolean
}

// Create event emitter for print events
const printEvents = new EventEmitter()
const store = new Store()

// Global references
let mainWindow: BrowserWindow | null = null
let printWindow: BrowserWindow | null = null
let debuggerAttached = false
let simulationController: ReturnType<typeof simulatedTranscriptController> | null = null
let printQueue: PrintQueue | null = null
let audioRecorder: AudioRecorder | null = null

const isDev = (): boolean => !app.isPackaged

function createPrintWindow(): BrowserWindow {
  if (printWindow && !printWindow.isDestroyed()) {
    return printWindow
  }

  const options: PrintWindowOptions = {
    width: 450,
    height: 950,
    show: isDev(),
    webPreferences: {
      scrollBounce: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js')
    }
  }

  printWindow = new BrowserWindow(options)

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    printWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/print.html`)
  } else {
    printWindow.loadFile(join(__dirname, '../renderer/print.html'))
  }

  // Initialize debugger state for new window
  debuggerAttached = false

  // Clean up debugger on window close
  printWindow.on('closed', () => {
    if (debuggerAttached && printWindow?.webContents) {
      try {
        printWindow.webContents.debugger.detach()
      } catch (error) {
        console.error('Failed to detach debugger:', error)
      }
      debuggerAttached = false
    }
    printWindow = null

    // Update print queue with new window reference
    if (printQueue) {
      printQueue.setPrintWindow(null)
    }
  })

  // Initialize print queue if it doesn't exist
  if (!printQueue) {
    printQueue = new PrintQueue(printWindow, createPrintWindow, printEvents)
  } else {
    // Update existing print queue with new window reference
    printQueue.setPrintWindow(printWindow)
  }

  return printWindow
}

function createWindow(): void {
  // Create the browser window.
  const options: MainWindowOptions = {
    width: 1200,
    height: 950,
    webPreferences: {
      titleBarStyle: {
        hiddenInset: true
      },
      nodeIntegration: true,
      preload: join(__dirname, '../preload/index.js')
    },
    icon,
    show: false
  }

  mainWindow = new BrowserWindow(options)

  if (isDev()) {
    createPrintWindow()
  }

  // Load the app
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Register IPC handlers
  setupIPCHandlers()

  // Window event handlers
  let isWindowShown = false
  let isContentLoaded = false

  function checkAndStartProcesses(): void {
    if (isWindowShown && isContentLoaded) {
      startProcesses()
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    isWindowShown = true
    checkAndStartProcesses()
  })

  mainWindow.webContents.once('did-finish-load', () => {
    isContentLoaded = true
    checkAndStartProcesses()
  })

  // Handle window closing
  mainWindow.on('closed', () => {
    // If there are active print jobs, show the print window
    if (printQueue && (printQueue.queue.length > 0 || printQueue.isProcessing)) {
      printWindow?.show()
    }

    // Clean up stream process
    if (global.streamProcess) {
      global.streamProcess.kill()
      global.streamProcess = null
    }

    mainWindow = null
  })
}

function setupIPCHandlers(): void {
  // Helper function to send messages to all windows
  function sendToAllWindows(channel: string, ...args: unknown[]): void {
    ;[mainWindow, printWindow].forEach((window) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(channel, ...args)
      }
    })
  }

  // Print request handler
  ipcMain.on('print', async (event, { content, settings }: PrintRequest) => {
    try {
      if (!printQueue) {
        printQueue = new PrintQueue(printWindow, createPrintWindow, printEvents)
      }

      if (!content || typeof content !== 'string') {
        throw new Error('Invalid content format')
      }
      if (!settings || !settings.printId) {
        throw new Error('Print settings or ID missing')
      }

      console.log('📝 Print request received:', {
        contentLength: content.length,
        settings: settings.printId
      })

      await printQueue.add(content, settings)

      // Send queue notification immediately
      event.reply('print-queued', { success: true, printId: settings.printId })
    } catch (error) {
      console.error('Print queue error:', error)
      event.reply('print-queued', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        printId: settings?.printId
      })
    }
  })

  // Store value handlers
  ipcMain.handle('getStoreValue', (_event, key: string) => {
    return store.get(key)
  })

  ipcMain.handle('setStoreValue', (_event, key: string, value: unknown) => {
    return store.set(key, value)
  })

  // PDF folder handler
  ipcMain.handle('open-pdf-folder', async () => {
    const pdfDir = join(app.getPath('userData'), 'pdfs')
    if (!existsSync(pdfDir)) {
      await fs.mkdir(pdfDir, { recursive: true })
    }
    await shell.openPath(pdfDir)
    return true
  })

  // Print execution handler
  ipcMain.handle(
    'execute-print',
    async (_event, { content, settings = { printId: '' } }: PrintRequest) => {
      try {
        console.log('📝 Execute print request:', {
          contentLength: content?.length,
          settings: settings.printId
        })

        if (!settings || !settings.printId) {
          throw new Error('Print ID is required')
        }

        const printOptions: Electron.WebContentsPrintOptions = {
          margins: {
            marginType: 'custom',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
          },
          pageSize: 'A3' as const,
          scaleFactor: 100,
          printBackground: false,
          landscape: false,
          silent: true
        }

        const pdfOptions: Electron.PrintToPDFOptions = {
          margins: printOptions.margins,
          pageSize: printOptions.pageSize,
          landscape: printOptions.landscape,
          printBackground: printOptions.printBackground
        }

        const statusMsg: PrintStatusMessage = createPrintStatusMessage(
          settings.printId,
          PRINT_ACTIONS.PRINT_START,
          PRINT_STATUS.INFO,
          { message: '(っ◔◡◔)っ ♥🎀 we are trying to print 🎀♥' }
        )
        sendToAllWindows('print-status', statusMsg)

        // Handle direct printing
        if (settings?.forcePrint === true && printWindow) {
          await new Promise<void>((resolve, reject) => {
            printWindow?.webContents.print(printOptions, (success, errorType) => {
              if (!success) {
                const errorMsg = createPrintStatusMessage(
                  settings.printId,
                  PRINT_ACTIONS.PRINT_COMPLETE,
                  PRINT_STATUS.ERROR,
                  { message: 'Printing failed', error: errorType }
                )
                sendToAllWindows('print-status', errorMsg)
                reject(new Error(errorType))
              } else {
                const successMsg = createPrintStatusMessage(
                  settings.printId,
                  PRINT_ACTIONS.PRINT_COMPLETE,
                  PRINT_STATUS.SUCCESS,
                  { message: '🖨️ Print completed' }
                )
                sendToAllWindows('print-status', successMsg)
                resolve()
              }
            })
          })
        }

        // Handle PDF saving
        const dateString = new Date().toISOString().replace(/:/g, '-')
        const pdfDir = join(app.getPath('userData'), 'pdfs')

        if (!existsSync(pdfDir)) {
          await fs.mkdir(pdfDir, { recursive: true })
        }

        const pdfPath = join(pdfDir, `transcript-${dateString}.pdf`)
        const pdfData = await printWindow?.webContents.printToPDF(pdfOptions)

        if (pdfData) {
          await fs.writeFile(pdfPath, pdfData)
          console.log(`Wrote PDF successfully to ${pdfPath}`)

          const pdfMsg = createPrintStatusMessage(
            settings.printId,
            PRINT_ACTIONS.PDF_SAVE,
            PRINT_STATUS.SUCCESS,
            {
              message: `💦 Wrote PDF successfully to ${pdfPath}`,
              path: pdfPath
            }
          )
          sendToAllWindows('print-status', pdfMsg)

          // Emit success event for PrintQueue
          const completionEvent: PrintCompletionEvent = {
            printId: settings.printId,
            success: true
          }
          printEvents.emit('print-complete', completionEvent)
        }

        return true
      } catch (error) {
        console.error('Print/PDF error:', error)
        const errorMsg = createPrintStatusMessage(
          settings.printId,
          PRINT_ACTIONS.PRINT_ERROR,
          PRINT_STATUS.ERROR,
          {
            message: `🥵 Error: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error.message : String(error)
          }
        )
        sendToAllWindows('print-status', errorMsg)

        // Emit error event for PrintQueue
        const completionEvent: PrintCompletionEvent = {
          printId: settings.printId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
        printEvents.emit('print-complete', completionEvent)

        throw error
      }
    }
  )

  // Print status handler
  ipcMain.on(
    'print-status',
    (_event, status: { printId: string; success: boolean; error?: string }) => {
      if (!status.printId) {
        console.error('❌ Print status received without printId:', status)
        return
      }

      const statusMsg = createPrintStatusMessage(
        status.printId,
        status.success ? PRINT_ACTIONS.PRINT_COMPLETE : PRINT_ACTIONS.PRINT_ERROR,
        status.success ? PRINT_STATUS.SUCCESS : PRINT_STATUS.ERROR,
        {
          message: status.error || (status.success ? '🖨️ Print completed' : '❌ Print failed'),
          error: status.error
        }
      )
      sendToAllWindows('print-status', statusMsg)
    }
  )
}

// Initialize audio devices
const initAudioDevices = (): void => {
  audioRecorder = new AudioRecorder()
  const devices = audioRecorder.getAvailableDevices()
  for (let i = 0; i < devices.length; i++) {
    console.log(`index: ${i}, device name: ${devices[i]}`)
  }
}

// Function to start processes after window is ready
function startProcesses(): void {
  if (process.argv.includes('--simulate')) {
    console.log('Running in simulation mode')
    simulationController = simulatedTranscriptController(mainWindow)
    simulationController.start()
  } else {
    createStreamProcess(mainWindow, __dirname)
  }
}

// App initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  initAudioDevices()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
  app.quit()
})

// Cleanup on app quit
app.on('before-quit', () => {
  if (simulationController) {
    simulationController.stop()
    simulationController = null
  }
  if (audioRecorder) {
    audioRecorder.stop()
    audioRecorder = null
  }
  if (printQueue) {
    printQueue.cleanup()
  }
})
