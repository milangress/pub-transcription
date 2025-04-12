import { app } from 'electron';
import log from 'electron-log/main';
import { join } from 'path';

// Configure log file path
const LOG_PATH = app.isPackaged
  ? join(app.getPath('userData'), 'logs/main.log')
  : join(process.cwd(), 'logs/main.log');

// Initialize the logger for any renderer process
log.initialize();

// Configure file transport
log.transports.file.resolvePathFn = (): string => LOG_PATH;
log.transports.file.level = 'info';
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}';

// Configure console transport
log.transports.console.level = 'debug';
log.transports.console.format = '{h}:{i}:{s}.{ms} › {scope} {text}';

// Enable IPC transport for development
if (!app.isPackaged) {
  log.transports.ipc.level = 'debug';
}

// Create scoped loggers for different parts of the application
export const mainLogger = log.scope('main');
export const printLogger = log.scope('print');
export const windowLogger = log.scope('window');
export const ipcLogger = log.scope('ipc');
export const serviceLogger = log.scope('service');

export const whisperLogger = log.scope('whisper');
export const simulateWhisperLogger = log.scope('whisper:simulated');
export const textWhisperLogger = log.scope('whisper:text');

// Export the base logger as default
export default log;
