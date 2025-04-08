import { Notification, shell } from 'electron';
import { printLogger } from '../utils/logger';

/**
 * NotificationManager handles desktop notifications for print jobs
 * Features:
 * - Create, update, and dismiss notifications
 * - Add actions to notifications (like opening PDFs)
 * - Ensures visibility of updated notifications
 * - Tracks active notifications
 */
export class NotificationManager {
  private activeNotifications = new Map<string, Notification>();

  constructor() {
    // Check if notifications are supported on startup
    if (!Notification.isSupported()) {
      printLogger.warn('Notifications are not supported on this system');
    }
  }

  /**
   * Shows a notification for a print job
   * @param printId - The ID of the print job
   * @param title - The title of the notification
   * @param options - Additional notification options
   */
  showNotification(
    printId: string,
    title: string,
    options?: {
      body?: string;
      silent?: boolean;
      path?: string;
    },
  ): void {
    // If notifications aren't supported, do nothing
    if (!Notification.isSupported()) {
      return;
    }

    // Dismiss existing notification if present
    if (this.activeNotifications.has(printId)) {
      const existingNotification = this.activeNotifications.get(printId);
      if (existingNotification) {
        existingNotification.close();
        this.activeNotifications.delete(printId);

        // Wait a bit before showing the updated notification to ensure it appears as new
        setTimeout(() => {
          this.createAndShowNotification(printId, title, options);
        }, 300);
        return;
      }
    }

    // Create and show notification
    this.createAndShowNotification(printId, title, options);
  }

  /**
   * Dismisses a notification for a print job
   * @param printId - The ID of the print job
   */
  dismissNotification(printId: string): void {
    if (this.activeNotifications.has(printId)) {
      const notification = this.activeNotifications.get(printId);
      if (notification) {
        notification.close();
        this.activeNotifications.delete(printId);
      }
    }
  }

  /**
   * Creates and shows a notification with the specified options
   * @param printId - The ID of the print job
   * @param title - The title of the notification
   * @param options - Notification options
   */
  private createAndShowNotification(
    printId: string,
    title: string,
    options?: {
      body?: string;
      silent?: boolean;
      path?: string;
    },
  ): void {
    // Prepare notification options
    const notificationOptions: Electron.NotificationConstructorOptions = {
      title: title,
      body: options?.body || `Print job ${printId} is in progress`,
      silent: options?.silent !== undefined ? options.silent : false,
    };

    // Add actions for PDF notifications
    if (options?.path) {
      notificationOptions.actions = [
        {
          type: 'button',
          text: 'Open PDF',
        },
      ];
    }

    const notification = new Notification(notificationOptions);

    // Add click handler for PDF actions
    if (options?.path) {
      notification.on('action', (_event, index) => {
        if (index === 0) {
          // First action (Open PDF)
          this.openFile(options.path!);
        }
      });

      // Also open PDF on regular click
      notification.on('click', () => {
        this.openFile(options.path!);
      });
    }

    // Store the notification reference
    this.activeNotifications.set(printId, notification);

    // Show the notification
    notification.show();
  }

  /**
   * Checks if there's an active notification for the specified print job
   * @param printId - The ID of the print job
   * @returns Whether there's an active notification
   */
  hasNotification(printId: string): boolean {
    return this.activeNotifications.has(printId);
  }

  /**
   * Dismisses all active notifications
   */
  dismissAll(): void {
    this.activeNotifications.forEach((notification, printId) => {
      notification.close();
      this.activeNotifications.delete(printId);
    });
  }

  /**
   * Opens a file using the default application
   * @param filePath - The path to the file to open
   */
  openFile(filePath: string): void {
    if (filePath) {
      shell
        .openPath(filePath)
        .then((result) => {
          if (result !== '') {
            printLogger.error(`Error opening file: ${result}`);
          }
        })
        .catch((err) => {
          printLogger.error('Error opening file:', err);
        });
    }
  }
}

// Export a singleton instance
export const notificationManager = new NotificationManager();
