import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/main'
import { app, BrowserWindow, Notification, shell } from 'electron'
import Store from 'electron-store'
import { EventEmitter } from 'events'
import { existsSync, promises as fs } from 'fs'
import { join } from 'path'

import type { PrintCompletionEvent, PrintStatusMessage, SettingsSnapshot } from '../types'
import type { IpcEvents, IpcRendererEvent } from '../types/ipc'
import { createPrintStatusMessage, PRINT_ACTIONS, PRINT_STATUS } from './printMessages'
import { PrintQueue } from './PrintQueue'
import { deleteSnapshot, getSnapshots, loadSnapshot, saveSnapshot } from './utils/snapshotManager'

const store = new Store()
const ipc = new IpcListener<IpcEvents>()
const emitter = new IpcEmitter<IpcRendererEvent>()
const printEvents = new EventEmitter()

let printQueue: PrintQueue | null = null
const activeNotifications = new Map<string, Notification>()

/**
 * Manages notifications for print jobs
 * @param printId - The ID of the print job
 * @param action - The action being performed (create, update, or dismiss)
 * @param options - Additional notification options
 */
function managePrintNotification(
  printId: string,
  action: 'create' | 'update' | 'dismiss',
  options?: {
    title?: string
    body?: string
    silent?: boolean
    pdfPath?: string
  }
): void {
  // Check if Notification is supported
  if (!Notification.isSupported()) {
    console.log('Notifications are not supported on this system')
    return
  }

  // Dismiss existing notification if present
  if (activeNotifications.has(printId)) {
    const existingNotification = activeNotifications.get(printId)
    if (existingNotification) {
      existingNotification.close()
      activeNotifications.delete(printId)
      
      // Wait a bit before showing the updated notification to ensure it appears as new
      if (action === 'update') {
        setTimeout(() => {
          createAndShowNotification()
        }, 300)
        return
      } else if (action === 'dismiss') {
        return
      }
    }
  }

  // Create new notification
  if (action === 'create' || action === 'update') {
    createAndShowNotification()
  }
  
  function createAndShowNotification(): void {
    // Prepare notification options
    const notificationOptions: Electron.NotificationConstructorOptions = {
      title: options?.title || 'Print Job',
      body: options?.body || `Print job ${printId} is in progress`,
      silent: options?.silent !== undefined ? options.silent : false
    }
    
    // Add actions for PDF notifications
    if (options?.pdfPath) {
      notificationOptions.actions = [
        {
          type: 'button',
          text: 'Open PDF'
        }
      ]
    }
    
    const notification = new Notification(notificationOptions)
    
    // Add click handler for PDF actions
    if (options?.pdfPath) {
      notification.on('action', (_event, index) => {
        if (index === 0) { // First action (Open PDF)
          shell.openPath(options.pdfPath!)
        }
      })
      
      // Also open PDF on regular click
      notification.on('click', () => {
        shell.openPath(options.pdfPath!)
      })
    }
    
    // Store the notification reference
    activeNotifications.set(printId, notification)
    
    // Show the notification
    notification.show()
  }
}

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

      // Create notification for queued print job
      managePrintNotification(request.settings.printId, 'create', {
        title: 'Print Job Queued',
        body: `Your print job has been added to the queue.`,
        silent: true
      })

      await printQueue.add(request.content, request.settings)

      // Send queue notification immediately
      emitter.send(event.sender, 'print-queued', {
        success: true,
        printId: request.settings.printId
      })
    } catch (error) {
      console.error('Print queue error:', error)
      
      // Show error notification
      if (request.settings?.printId) {
        managePrintNotification(request.settings.printId, 'update', {
          title: 'Print Error',
          body: `Error: ${error instanceof Error ? error.message : String(error)}`,
          silent: false
        })
      }
      
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

  // Settings snapshot handlers
  ipc.handle('save-settings-snapshot', async (_event, snapshot: SettingsSnapshot) => {
    try {
      return await saveSnapshot(snapshot)
    } catch (error) {
      console.error('Error in save-settings-snapshot handler:', error)
      throw error
    }
  })

  ipc.handle('get-settings-snapshots', async () => {
    try {
      return await getSnapshots()
    } catch (error) {
      console.error('Error in get-settings-snapshots handler:', error)
      return {
        snapshots: [],
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  ipc.handle('load-settings-snapshot', async (_event, id: string) => {
    try {
      return await loadSnapshot(id)
    } catch (error) {
      console.error(`Error in load-settings-snapshot handler for ID ${id}:`, error)
      throw error
    }
  })

  ipc.handle('delete-settings-snapshot', async (_event, id: string) => {
    try {
      return await deleteSnapshot(id)
    } catch (error) {
      console.error(`Error in delete-settings-snapshot handler for ID ${id}:`, error)
      return false
    }
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
              
              // Update notification for print failure
              managePrintNotification(request.settings.printId, 'update', {
                title: 'Print Failed',
                body: `Printing failed: ${errorType}`,
                silent: false
              })
              
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
              
              // Update notification for print completion
              // We'll update it again if PDF is also saved
              managePrintNotification(request.settings.printId, 'update', {
                title: 'Print Completed',
                body: '🖨️ Print job completed successfully',
                silent: true
              })
              
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
        
        // Create or update notification about completed job
        // This notification combines both print and PDF status if forcePrint was enabled
        const notificationTitle = request.settings.forcePrint ? 
          'Print Job & PDF Completed' : 
          'PDF Generated Successfully'
          
        const notificationBody = request.settings.forcePrint ?
          `Print completed and PDF saved. Click to open.` :
          `PDF saved successfully. Click to open.`
          
        managePrintNotification(request.settings.printId, 'update', {
          title: notificationTitle,
          body: notificationBody,
          silent: true,
          pdfPath: pdfPath
        })

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
      
      // Update notification for error
      managePrintNotification(request.settings.printId, 'update', {
        title: 'Print Job Failed',
        body: `Error: ${error instanceof Error ? error.message : String(error)}`,
        silent: false
      })

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
  
  // Set up print events listener for when print queue jobs are completed
  printEvents.on('INTERNAL-PrintQueueEvent:complete', (event: PrintCompletionEvent) => {
    // If we have a notification for this print job, update it based on success/failure
    if (activeNotifications.has(event.printId)) {
      if (!event.success && event.error) {
        // Don't dismiss on error - notification already updated in execute-print handler
      } else {
        // For successful jobs, the notification will be dismissed after a delay
        // to give the user time to see the success message
        setTimeout(() => {
          managePrintNotification(event.printId, 'dismiss')
        }, 5000) // Dismiss after 5 seconds
      }
    }
  })
}
