import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/main'
import { app, BrowserWindow, shell } from 'electron'
import Store from 'electron-store'
import { EventEmitter } from 'events'
import { existsSync, promises as fs } from 'fs'
import { join } from 'path'

import type { PrintCompletionEvent, PrintStatusMessage } from '../types'
import type { IpcEvents, IpcRendererEvent } from '../types/ipc'
import { createPrintStatusMessage, PRINT_ACTIONS, PRINT_STATUS } from './printMessages'
import { PrintQueue } from './PrintQueue'

const store = new Store()
const ipc = new IpcListener<IpcEvents>()
const emitter = new IpcEmitter<IpcRendererEvent>()
const printEvents = new EventEmitter()

let printQueue: PrintQueue | null = null

// Default print options
const DEFAULT_PRINT_OPTIONS = {
  margins: {
    marginType: 'custom' as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  },
  pageSize: 'A3' as const,
  printBackground: true,
  printSelectionOnly: false,
  landscape: false,
  silent: true,
  scaleFactor: 100
}

// Helper function to send messages to all windows
function sendToAllWindows(
  printWindow: BrowserWindow | null,
  channel: keyof IpcRendererEvent,
  status: PrintStatusMessage
): void {
  const windows = Array.from([printWindow])
  windows.forEach((window) => {
    console.log('Sending to window', channel, status)
    if (window && !window.isDestroyed()) {
      emitter.send(window.webContents, channel, status)
    } else {
      console.log('Window is not available', window)
    }
  })
}

export function setupIpcHandlers(createPrintWindow: () => BrowserWindow): void {
  let printWindow: BrowserWindow | null = null

  // Print request handler
  ipc.on('print', async (event, request) => {
    try {
      // Ensure we have a print window
      if (!printWindow || printWindow.isDestroyed()) {
        printWindow = createPrintWindow()
      }

      if (!printQueue) {
        printQueue = new PrintQueue(printWindow, createPrintWindow, printEvents)
      }

      if (!request.content || typeof request.content !== 'string') {
        throw new Error('Invalid content format')
      }
      if (!request.settings || !request.settings.printId) {
        throw new Error('Print settings or ID missing')
      }

      console.log('📝 Print request received:', {
        contentLength: request.content.length,
        PrintId: request.settings.printId
      })

      await printQueue.add(request.content, request.settings)

      // Send queue notification immediately
      emitter.send(event.sender, 'print-queued', {
        success: true,
        printId: request.settings.printId
      })
    } catch (error) {
      console.error('Print queue error:', error)
      emitter.send(event.sender, 'print-queued', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        printId: request.settings?.printId
      })
    }
  })

  // Store value handlers
  ipc.handle('getStoreValue', (_event, key) => {
    return store.get(key)
  })

  ipc.handle('setStoreValue', (_event, key, value) => {
    return store.set(key, value)
  })

  // PDF folder handler
  ipc.handle('open-pdf-folder', async () => {
    const pdfDir = join(app.getPath('userData'), 'pdfs')
    if (!existsSync(pdfDir)) {
      await fs.mkdir(pdfDir, { recursive: true })
    }
    await shell.openPath(pdfDir)
    return true
  })

  // Print execution handler
  ipc.handle('execute-print', async (_event, request) => {
    try {
      // Ensure we have a print window
      if (!printWindow || printWindow.isDestroyed()) {
        printWindow = createPrintWindow()
      }

      console.log('📝 Execute print request:', {
        contentLength: request.content.length,
        printId: request.settings.printId
      })

      if (!request.settings || !request.settings.printId) {
        throw new Error('Print ID is required')
      }

      if (!printWindow) {
        throw new Error('Print window is not available')
      }

      const printOptions = {
        ...DEFAULT_PRINT_OPTIONS,
        silent: request.settings.silent ?? DEFAULT_PRINT_OPTIONS.silent
      }

      const pdfOptions = {
        margins: printOptions.margins,
        pageSize: printOptions.pageSize,
        landscape: printOptions.landscape,
        printBackground: printOptions.printBackground
      }

      const statusMsg = createPrintStatusMessage(
        request.settings.printId,
        PRINT_ACTIONS.PRINT_START,
        PRINT_STATUS.INFO,
        { message: '(っ◔◡◔)っ ♥🎀 we are trying to print 🎀♥' }
      )
      sendToAllWindows(printWindow, 'print-status', statusMsg)

      // Handle direct printing
      if (request.settings.forcePrint === true) {
        await new Promise<void>((resolve, reject) => {
          console.log('Printing...', printOptions)
          printWindow!.webContents.print(printOptions, (success, errorType) => {
            if (!success) {
              console.error('Printing failed', errorType)
              const errorMsg = createPrintStatusMessage(
                request.settings.printId,
                PRINT_ACTIONS.PRINT_COMPLETE,
                PRINT_STATUS.ERROR,
                { message: 'Printing failed', error: errorType }
              )
              sendToAllWindows(printWindow, 'print-status', errorMsg)
              reject(new Error(errorType))
            } else {
              console.log('Printing completed')
              const successMsg = createPrintStatusMessage(
                request.settings.printId,
                PRINT_ACTIONS.PRINT_COMPLETE,
                PRINT_STATUS.SUCCESS,
                { message: '🖨️ Print completed' }
              )
              sendToAllWindows(printWindow, 'print-status', successMsg)
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
      console.log('Printing to PDF...', pdfPath, pdfOptions)
      const pdfData = await printWindow.webContents.printToPDF(pdfOptions)

      if (pdfData) {
        await fs.writeFile(pdfPath, pdfData)
        console.log(`Wrote PDF successfully to ${pdfPath}`)

        const pdfMsg = createPrintStatusMessage(
          request.settings.printId,
          PRINT_ACTIONS.PDF_SAVE,
          PRINT_STATUS.SUCCESS,
          {
            message: `💦 Wrote PDF successfully to ${pdfPath}`,
            path: pdfPath
          }
        )
        sendToAllWindows(printWindow, 'print-status', pdfMsg)

        // Emit success event for PrintQueue
        const completionEvent: PrintCompletionEvent = {
          printId: request.settings.printId,
          success: true
        }
        printEvents.emit('INTERNAL-PrintQueueEvent:complete', completionEvent)
      }

      return true
    } catch (error) {
      console.error('Print/PDF error:', error)
      const errorMsg = createPrintStatusMessage(
        request.settings.printId,
        PRINT_ACTIONS.PRINT_ERROR,
        PRINT_STATUS.ERROR,
        {
          message: `🥵 Error: ${error instanceof Error ? error.message : String(error)}`,
          error: error instanceof Error ? error.message : String(error)
        }
      )
      sendToAllWindows(printWindow, 'print-status', errorMsg)

      // Emit error event for PrintQueue
      const completionEvent: PrintCompletionEvent = {
        printId: request.settings.printId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
      printEvents.emit('INTERNAL-PrintQueueEvent:complete', completionEvent)

      throw error
    }
  })

  // Print status handler
  ipc.on('print-status', (_event, status) => {
    if (!status.printId) {
      console.error('❌ Print status received without printId:', status)
      return
    }

    // Ensure we have a print window
    if (!printWindow || printWindow.isDestroyed()) {
      printWindow = createPrintWindow()
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
    sendToAllWindows(printWindow, 'print-status', statusMsg)
  })
}
