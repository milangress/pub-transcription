import { app } from 'electron';

export const isDev = (): boolean => !app.isPackaged;

export const isMac = (): boolean => process.platform === 'darwin';
