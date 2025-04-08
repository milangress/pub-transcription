import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { BrowserWindow, Menu, MenuItemConstructorOptions, app, dialog, shell } from 'electron';
import { promises as fs } from 'fs';
import type { IpcRendererEvent } from '../../types/ipc';
import { editorWindowManager } from '../window/EditorWindow';
import { mainWindowManager } from '../window/MainWindow';

const emitter = new IpcEmitter<IpcRendererEvent>();

export function createMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Editor Window',
          accelerator: 'CmdOrCtrl+N',
          click: (): void => {
            editorWindowManager.createEditorWindow();
          },
        },
        {
          label: 'Open CSS File...',
          accelerator: 'CmdOrCtrl+O',
          click: async (): Promise<void> => {
            const result = await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: [
                { name: 'CSS Files', extensions: ['css'] },
                { name: 'HTML Files', extensions: ['html'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              const content = await fs.readFile(filePath, 'utf8');
              const window = editorWindowManager.createEditorWindow({
                initialContent: content,
                language: 'css',
              });

              // Set the represented filename
              window.setRepresentedFilename(filePath);
              window.setTitle(filePath.split('/').pop() || filePath);

              // Send the file path to the renderer
              window.once('ready-to-show', () => {
                window.webContents.send('editor:opened-file', filePath);
              });
            }
          },
        },
        { type: 'separator' as const },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: (): void => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('editor:save');
            }
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async (): Promise<void> => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('editor:save-as');
            }
          },
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
              { type: 'separator' as const },
              {
                label: 'Speech',
                submenu: [{ role: 'startSpeaking' as const }, { role: 'stopSpeaking' as const }],
              },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
            ]),
      ],
    },

    // Editor menu
    {
      label: 'Editor',
      submenu: [
        {
          label: 'Toggle Language',
          submenu: [
            {
              label: 'CSS',
              click: (): void => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                  editorWindowManager.setEditorLanguage(focusedWindow, 'css');
                }
              },
            },
            {
              label: 'HTML',
              click: (): void => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                  editorWindowManager.setEditorLanguage(focusedWindow, 'html');
                }
              },
            },
          ],
        },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
        { type: 'separator' as const },
        {
          label: 'Toggle Mini Mode',
          accelerator: 'CmdOrCtrl+M',
          click: (): void => {
            const mainWindow = mainWindowManager.getOrCreateMainWindow();
            // Get current mode based on window width
            const isCurrentlyMini = mainWindow.getBounds().width < 900;
            // Toggle to opposite mode
            const newMode = isCurrentlyMini ? 'full' : 'mini';

            const height = mainWindow.getBounds().height;
            if (newMode === 'mini') {
              const width = Math.round(height / 1.4142);
              mainWindow.setSize(width, height);
            } else {
              mainWindow.setSize(1200, height);
            }
            emitter.send(mainWindow.webContents, 'window:mode', newMode);
          },
        },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },

    // Help menu
    {
      role: 'help' as const,
      submenu: [
        {
          label: 'Learn More',
          click: async (): Promise<void> => {
            await shell.openExternal('https://github.com/yourusername/your-repo');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
