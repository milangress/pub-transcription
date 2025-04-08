import { app, shell } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path/posix';

export const isDev = (): boolean => !app.isPackaged;

export const isMac = (): boolean => process.platform === 'darwin';

export function openPdfFolder(): boolean {
  const pdfDir = join(app.getPath('userData'), 'pdfs');
  const folderExists = existsSync(pdfDir);
  if (!folderExists) {
    mkdirSync(pdfDir, { recursive: true });
  }
  shell.openPath(pdfDir);
  return folderExists;
}
