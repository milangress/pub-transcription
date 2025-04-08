import { ipcMain } from 'electron';
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
}
