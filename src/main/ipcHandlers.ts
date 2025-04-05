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
const printWindow: BrowserWindow | null = null

// Helper function to send messages to all windows
function sendToAllWindows(channel: keyof IpcRendererEvent, status: PrintStatusMessage): void {
  ;[printWindow].forEach((window) => {
    if (window && !window.isDestroyed()) {
      emitter.send(window.webContents, channel, status)
    }
  })
}

export function setupIpcHandlers(createPrintWindow: () => BrowserWindow): void {
  // Print request handler
  ipc.on('print', async (event, request) => {
    try {
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
        settings: request.settings.printId
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
      console.log('📝 Execute print request:', {
        contentLength: request.content?.length,
        settings: request.settings.printId
      })

      if (!request.settings || !request.settings.printId) {
        throw new Error('Print ID is required')
      }

      const printOptions = {
        margins: {
          marginType: 'custom' as const,
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
      sendToAllWindows('print-status', statusMsg)

      // Handle direct printing
      if (request.settings?.forcePrint === true && printWindow) {
        await new Promise<void>((resolve, reject) => {
          printWindow?.webContents.print(printOptions, (success, errorType) => {
            if (!success) {
              const errorMsg = createPrintStatusMessage(
                request.settings.printId,
                PRINT_ACTIONS.PRINT_COMPLETE,
                PRINT_STATUS.ERROR,
                { message: 'Printing failed', error: errorType }
              )
              sendToAllWindows('print-status', errorMsg)
              reject(new Error(errorType))
            } else {
              const successMsg = createPrintStatusMessage(
                request.settings.printId,
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
          request.settings.printId,
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
          printId: request.settings.printId,
          success: true
        }
        printEvents.emit('print-complete', completionEvent)
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
      sendToAllWindows('print-status', errorMsg)

      // Emit error event for PrintQueue
      const completionEvent: PrintCompletionEvent = {
        printId: request.settings.printId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
      printEvents.emit('print-complete', completionEvent)

      throw error
    }
  })

  // Print status handler
  ipc.on('print-status', (_event, status) => {
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
  })
}
