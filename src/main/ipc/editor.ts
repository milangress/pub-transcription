import { dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { editorWindowManager } from '../window/EditorWindow';

export function setupEditorIPC(): void {
  ipcMain.handle(
    'editor:openFile',
    async (_, { content, language }: { content: string; language: 'css' | 'html' }) => {
      const window = editorWindowManager.createEditorWindow({
        initialContent: content,
        language,
      });
      return window.id;
    },
  );

  // Handle save dialog
  ipcMain.handle('editor:save-dialog', async (event) => {
    const window = editorWindowManager.getEditorWindowFromWebContents(event.sender);
    if (!window) return null;

    const defaultPath = os.homedir();
    const result = await dialog.showSaveDialog(window, {
      defaultPath,
      filters: [
        { name: 'CSS Files', extensions: ['css'] },
        { name: 'HTML Files', extensions: ['html'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  // Handle setting represented file
  ipcMain.handle('editor:set-represented-file', (event, filePath) => {
    const window = editorWindowManager.getEditorWindowFromWebContents(event.sender);
    if (window) {
      window.setRepresentedFilename(filePath);
      window.setTitle(path.basename(filePath));
    }
  });

  // Handle setting document edited status
  ipcMain.handle('editor:set-document-edited', (event, edited) => {
    const window = editorWindowManager.getEditorWindowFromWebContents(event.sender);
    if (window) {
      window.setDocumentEdited(edited);
    }
  });

  // Handle save to file
  ipcMain.on('editor:save-to-file', async (event, { content, filePath }) => {
    try {
      if (!filePath) {
        return;
      }

      await fs.writeFile(filePath, content, 'utf8');

      // Set document as not edited
      const window = editorWindowManager.getEditorWindowFromWebContents(event.sender);
      if (window) {
        window.setDocumentEdited(false);
      }

      // Notify renderer that save is complete
      event.sender.send('editor:save-complete', filePath);
    } catch (error) {
      console.error('Error saving file:', error);
      event.sender.send('editor:save-complete', null);
    }
  });
}
