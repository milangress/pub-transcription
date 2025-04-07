import { app, dialog } from 'electron';

/**
 * Checks if the app is in the Applications folder on macOS and prompts the user to move it if not.
 * Only runs on macOS and when the app is not in development mode.
 */
export function checkApplicationFolder(isDev: () => boolean): void {
  // Only run on macOS and when app is packaged (not in development)
  if (process.platform !== 'darwin' || isDev()) {
    return;
  }

  // Check if the app is already in the Applications folder
  if (!app.isInApplicationsFolder()) {
    const dialogOpts = {
      type: 'question' as const,
      buttons: ['Move to Applications', 'Do Not Move'],
      defaultId: 0,
      title: 'Move to Applications folder?',
      message: 'Would you like to move this app to your Applications folder?',
    };

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        try {
          app.moveToApplicationsFolder({
            conflictHandler: (conflictType) => {
              if (conflictType === 'exists') {
                const choice = dialog.showMessageBoxSync({
                  type: 'question' as const,
                  buttons: ['Cancel', 'Replace'],
                  defaultId: 0,
                  message:
                    'An app with the same name already exists in the Applications folder. Do you want to replace it?',
                });
                return choice === 1; // Return true to continue (replace), false to cancel
              }
              return true; // Continue for other conflict types
            },
          });
        } catch (error) {
          console.error('Failed to move to Applications folder:', error);
        }
      }
    });
  }
}
