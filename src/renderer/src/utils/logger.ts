import log from 'electron-log/renderer';

// Configure console transport
log.transports.console.level = 'debug';
log.transports.console.format = '{h}:{i}:{s}.{ms} › {scope} {text}';

// Create scoped loggers for different parts of the application
export const uiLogger = log.scope('ui');
export const printLogger = log.scope('print');
export const settingsLogger = log.scope('settings');
export const midiLogger = log.scope('midi');

// Export the base logger as default
export default log;
