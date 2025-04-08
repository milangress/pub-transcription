import { BrowserWindow, app } from 'electron';
import { join } from 'path';
import icon from '../../../resources/favicon.png?asset';
import { isDev } from '../utils/helper';

export class EditorWindow {
  private editorWindows: BrowserWindow[] = [];

  public createEditorWindow(
    options: { initialContent?: string; language?: 'css' | 'html' } = {},
  ): BrowserWindow {
    const window = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        preload: join(__dirname, '../preload/index.js'),
      },
      icon,
      show: false,
    });

    if (isDev()) {
      window.webContents.openDevTools();
    }

    // Load the editor window
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      window.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/editor');
    } else {
      window.loadFile(join(__dirname, '../renderer/editor.html'));
    }

    // Handle window ready
    window.once('ready-to-show', () => {
      window.show();

      // Send initial content and language if provided
      if (options.initialContent || options.language) {
        window.webContents.send('editor:init', {
          content: options.initialContent || '',
          language: options.language || 'css',
        });
      }
    });

    // Handle window closing
    window.on('closed', () => {
      const index = this.editorWindows.indexOf(window);
      if (index > -1) {
        this.editorWindows.splice(index, 1);
      }
    });

    this.editorWindows.push(window);
    return window;
  }

  public getEditorWindows(): BrowserWindow[] {
    // Clean up any destroyed windows
    this.editorWindows = this.editorWindows.filter((window) => !window.isDestroyed());
    return this.editorWindows;
  }

  public setEditorLanguage(window: BrowserWindow, language: 'css' | 'html'): void {
    if (!window.isDestroyed()) {
      window.webContents.send('editor:setLanguage', language);
    }
  }

  public cleanup(): void {
    for (const window of this.editorWindows) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
    this.editorWindows = [];
  }
}

// Create a singleton instance
export const editorWindowManager = new EditorWindow();
