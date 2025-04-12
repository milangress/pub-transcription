import { BrowserWindow, WebContents, app } from 'electron';
import { promises as fs } from 'fs';
import os from 'os';
import { join } from 'path';
import icon from '../../../resources/favicon.png?asset';
import { mainWindowManager } from './MainWindow';

export class EditorWindow {
  private editorWindows: BrowserWindow[] = [];

  public async openFile(filePath: string): Promise<BrowserWindow> {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Determine language based on file extension
      const ext = filePath.split('.').pop()?.toLowerCase();
      const language = ext === 'html' ? 'html' : 'css';

      const window = this.createEditorWindow({
        initialContent: content,
        language,
      });

      // Set the represented filename
      window.setRepresentedFilename(filePath);
      window.setTitle(filePath.split('/').pop() || filePath);

      // Send the file path to the renderer
      window.once('ready-to-show', () => {
        window.webContents.send('editor:opened-file', filePath);
      });

      return window;
    } catch (error) {
      console.error('Error opening file:', error);
      throw error;
    }
  }

  public createEditorWindow(
    options: { initialContent?: string; language?: 'css' | 'html' } = {},
  ): BrowserWindow {
    const mainWindow = mainWindowManager.getOrCreateMainWindow();
    const window = new BrowserWindow({
      width: 800,
      height: 600,
      // titleBarStyle: 'hidden',
      // transparent: true,
      // frame: false,
      parent: mainWindow,
      webPreferences: {
        nodeIntegration: true,
        preload: join(__dirname, '../preload/index.js'),
      },
      icon,
      show: false,
    });

    // Set default represented filename to home directory
    window.setRepresentedFilename(os.homedir());

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

  public getEditorWindowFromWebContents(webContents: WebContents): BrowserWindow | null {
    return (
      this.editorWindows.find(
        (win) => !win.isDestroyed() && win.webContents.id === webContents.id,
      ) || null
    );
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
