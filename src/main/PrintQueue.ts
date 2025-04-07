import { app } from 'electron'
import { EventEmitter } from 'events'
import type { PrintSettings, QueueStatus } from '../types/index.ts'
import { printWindowManager } from './managers/PrintWindowManager'

interface PrintJob {
  content: string
  settings: PrintSettings
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  retries: number
  addedAt: number
}

interface PrintJobResult {
  success: boolean
  error?: string
  retrying?: boolean
}

interface ExtendedQueueStatus extends QueueStatus {
  currentJob: {
    addedAt: number
    retries: number
    settings: PrintSettings
  } | null
}

interface PrintQueueResult {
  queued: boolean
  completion: Promise<unknown>
}

/**
 * PrintQueue manages a queue of print jobs for electron windows.
 * Handles print job processing, retries, timeouts and window management.
 *
 * Features:
 * - Configurable retry attempts for failed jobs
 * - Timeout handling for stalled jobs
 * - Auto-recreation of print windows if destroyed
 * - Queue status updates via IPC
 * - Graceful cleanup of pending jobs
 */
export class PrintQueue {
  private queue: PrintJob[] = []
  private isProcessing = false
  private readonly maxRetries = 3
  private readonly timeout = 5 * 60 * 1000 // 5 minutes timeout
  private readonly printEvents: EventEmitter

  constructor(printEvents: EventEmitter) {
    this.printEvents = printEvents
    this.updateQueueStatus()
  }

  async add(content: string, settings: PrintSettings): Promise<PrintQueueResult> {
    const jobPromise = new Promise((resolve, reject) => {
      const job: PrintJob = {
        content,
        settings,
        resolve,
        reject,
        retries: 0,
        addedAt: Date.now()
      }

      this.queue.push(job)
      console.log(`Added job to queue. Queue length: ${this.queue.length}`)
      this.updateQueueStatus()
      this.processNext()
    })

    // Return both the immediate success and the job completion promise
    return {
      queued: true,
      completion: jobPromise
    }
  }

  private updateQueueStatus(): void {
    const status = this.getQueueStatus()
    // Update the app badge count to reflect queue length
    app.badgeCount = status.queueLength
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true
    this.updateQueueStatus()
    const job = this.queue[0]

    try {
      // Process the job using the PrintWindowManager
      const result = await new Promise<PrintJobResult>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          cleanup()

          // If we haven't exceeded max retries, move job to end of queue
          if (job.retries < this.maxRetries) {
            job.retries++
            this.queue.push({
              ...job,
              addedAt: Date.now() // Reset the timestamp
            })
            console.log(`Job timed out, retrying later. Attempt ${job.retries}/${this.maxRetries}`)
            resolve({ success: false, retrying: true })
          } else {
            console.log(`Job failed after ${this.maxRetries} attempts`)
            reject(new Error(`Print job failed after ${this.maxRetries} attempts`))
          }
        }, this.timeout)

        const cleanup = (): void => {
          this.printEvents.removeListener('INTERNAL-PrintQueueEvent:complete', handleComplete)
          clearTimeout(timeoutId)
        }

        const handleComplete = ({
          printId,
          success,
          error
        }: {
          printId: string
          success: boolean
          error?: string
        }): void => {
          if (printId !== job.settings.printId) return
          cleanup()
          if (success) {
            resolve({ success: true })
          } else {
            resolve({ success: false, error })
          }
        }

        this.printEvents.on('INTERNAL-PrintQueueEvent:complete', handleComplete)

        // Send the job to the print window via the PrintWindowManager
        try {
          // Ensure content is a string and settings has printId
          if (typeof job.content !== 'string') {
            throw new Error('Print content must be a string')
          }
          if (!job.settings?.printId) {
            throw new Error('Print ID is required in settings')
          }
          
          console.log(`Sending job ${job.settings.printId} to print window`)
          printWindowManager.sendContentToPrintWindow(
            job.content,
            job.settings,
            job.retries,
            this.maxRetries
          ).catch(err => {
            cleanup()
            reject(err)
          })
        } catch (error) {
          cleanup()
          reject(
            new Error(
              `Failed to send job to print window: ${error instanceof Error ? error.message : String(error)}`
            )
          )
        }
      })

      if (result.success) {
        console.log(`Job ${job.settings.printId} completed successfully`)
        job.resolve(result)
      } else if (!result.retrying) {
        console.log(`Job ${job.settings.printId} failed: ${result.error}`)
        job.reject(new Error(result.error || 'Print failed'))
      }
    } catch (error) {
      console.error('Print job error:', error)
      job.reject(error instanceof Error ? error : new Error(String(error)))
    } finally {
      // Always clean up the current job
      this.queue.shift()
      this.isProcessing = false
      this.updateQueueStatus()

      // Process next job after a delay to allow for SVG filters and window stabilization
      if (this.queue.length > 0) {
        console.log(`Will process next job in 1s. Queue length: ${this.queue.length}`)
        setTimeout(() => {
          console.log('Processing next job after delay')
          this.processNext()
        }, 1000)
      } else {
        console.log('Queue is empty')
      }
    }
  }

  getQueueStatus(): ExtendedQueueStatus {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      currentJob: this.queue[0]
        ? {
            addedAt: this.queue[0].addedAt,
            retries: this.queue[0].retries,
            settings: this.queue[0].settings
          }
        : null
    }
  }

  cleanup(): void {
    if (this.queue.length > 0) {
      console.log(`Cleaning up ${this.queue.length} remaining print jobs`)
      
      // Emit completion events for all remaining jobs to clean up notifications
      this.queue.forEach(job => {
        this.printEvents.emit('INTERNAL-PrintQueueEvent:complete', {
          printId: job.settings.printId,
          success: false,
          error: 'Print queue was cleared'
        })
      })
    }
    this.queue = []
    this.isProcessing = false
    // Reset badge count when cleaning up the queue
    app.badgeCount = 0
  }

  /**
   * Check if there are any active jobs in the queue
   * @returns true if there are jobs in the queue or a job is being processed
   */
  hasActiveJobs(): boolean {
    return this.queue.length > 0 || this.isProcessing
  }
}
