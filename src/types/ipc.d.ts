import type {
  PrintJob,
  PrintRequest,
  PrintStatusMessage,
  QueueStatus,
  SettingsSnapshot,
  SettingsSnapshotListResponse,
} from './index';

// Command types for general IPC communication
export type CommandResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Main process ipc events (from renderer to main)
export type IpcEvents =
  | {
      // listener event map
      print: [request: PrintRequest];
      'print-status': [status: { printId: string; success: boolean; error?: string }];
      'editor:settings-updated': [settings: { editorCss?: string; svgFilters?: string }];
      'editor:stackmode': [mode: { content?: string; clear?: boolean }];
      'editor:save-content': [content: string];
      'editor:save-to-file': [{ content: string; filePath?: string }];
      'editor:command': [command: string, payload?: unknown];
      'window:mode': [mode: 'full' | 'mini'];
      // Command channel events
      'command:execute': [command: string, payload?: unknown];
    }
  | {
      // handler event map
      getStoreValue: (key: string) => unknown;
      setStoreValue: (key: string, value: unknown) => void;
      'open-pdf-folder': () => Promise<boolean>;
      'PrintWindow:ReadyToBePrinted': (request: PrintRequest) => Promise<boolean>;
      // Settings snapshot handlers
      'save-settings-snapshot': (snapshot: SettingsSnapshot) => Promise<SettingsSnapshot>;
      'get-settings-snapshots': () => Promise<SettingsSnapshotListResponse>;
      'load-settings-snapshot': (id: string) => Promise<SettingsSnapshot | null>;
      'delete-settings-snapshot': (id: string) => Promise<boolean>;
      'editor:openFile': (options: {
        content: string;
        language: 'css' | 'html';
      }) => Promise<number>;
      'editor:save-dialog': () => Promise<string | null>;
      'editor:set-represented-file': (filePath: string) => void;
      'editor:set-document-edited': (edited: boolean) => void;
      // Command channel handlers
      'command:execute': <T>(command: string, payload?: unknown) => Promise<CommandResponse<T>>;
      // Whisper handlers
      'whisper:get-config': () => Promise<StreamOptions>;
      'whisper:get-devices': () => Promise<WhisperDevice[]>;
      'whisper:start': (config: Partial<StreamOptions>) => Promise<boolean>;
      'whisper:stop': () => Promise<boolean>;
    };

// Renderer ipc events (from main to renderer)
export type IpcRendererEvent = {
  // Print related events
  'print-status': [status: PrintStatusMessage];
  'print-queued': [response: { success: boolean; printId: string; error?: string }];
  'queue-status': [status: QueueStatus];
  'PrintWindow:printJob': [job: PrintJob];

  // Transcription related events
  'whisper-ccp-stream:transcription': [data: string];
  'whisper-ccp-stream:status': [status: string];

  // Editor related events
  'editor:init': [options: { content: string; language: 'css' | 'html' }];
  'editor:setLanguage': [language: 'css' | 'html'];
  'settings-sync': [
    settings: { editorCss?: string; svgFilters?: string; createSnapshot?: boolean },
  ];
  'editor:save-complete': [filePath: string | null];
  'editor:save': [];
  'editor:save-as': [];
  'editor:opened-file': [filePath: string];
  'editor:command': [command: string, payload?: unknown];
  'editor:stackmode': [mode: { content?: string; clear?: boolean }];

  // Command channel events
  'command:response': [response: CommandResponse];
  'command:error': [error: string];

  // Window mode events
  'window:mode': [mode: 'full' | 'mini'];
};
