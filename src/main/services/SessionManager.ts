import { app } from 'electron';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { serviceLogger } from '../utils/logger';

// Session directory structure
export interface Session {
  id: string;
  timestamp: number;
  name: string;
  path: string;
  whisperSessionPath: string;
  pdfPath: string;
  imagesPath: string;
}

// Current active session
let currentSession: Session | null = null;

/**
 * Create a new recording session
 * @param customName Optional custom name for the session
 * @returns The created session object
 */
export async function createSession(customName?: string): Promise<Session> {
  try {
    const sessionId = uuidv4();
    const timestamp = Date.now();
    const dateString = new Date(timestamp).toISOString().replace(/:/g, '-').replace(/\.\+/, '');

    // Create a name for the session using date and optional custom name
    const name = customName ? `${dateString}-${customName}` : `session-${dateString}`;

    // Create session directory structure
    const sessionsDir = join(app.getPath('userData'), 'sessions');
    const sessionPath = join(sessionsDir, name);
    const whisperSessionPath = join(sessionPath);
    const pdfPath = join(sessionPath, 'pdf');
    const imagesPath = join(sessionPath, 'images');

    // Ensure directories exist
    if (!existsSync(sessionsDir)) {
      await fs.mkdir(sessionsDir, { recursive: true });
    }

    await fs.mkdir(sessionPath, { recursive: true });
    await fs.mkdir(whisperSessionPath, { recursive: true });
    await fs.mkdir(pdfPath, { recursive: true });
    await fs.mkdir(imagesPath, { recursive: true });

    // Create session object
    const session: Session = {
      id: sessionId,
      timestamp,
      name,
      path: sessionPath,
      whisperSessionPath,
      pdfPath,
      imagesPath,
    };

    // Save session metadata
    await fs.writeFile(
      join(sessionPath, 'session.json'),
      JSON.stringify(session, null, 2),
      'utf-8',
    );

    // Set as current session
    currentSession = session;

    serviceLogger.info(`Created new session: ${name} at ${sessionPath}`);

    return session;
  } catch (error) {
    serviceLogger.error('Error creating session:', error);
    throw error;
  }
}

/**
 * Get the current active session
 * @returns The current session or null if no session is active
 */
export function getCurrentSession(): Session | null {
  return currentSession;
}

/**
 * Save a file to the current session
 * @param fileBuffer The file buffer to save
 * @param filename The name of the file
 * @param type The type of file (audio, pdf, snapshot, image)
 * @returns The path to the saved file
 */
export async function saveToSession(
  fileBuffer: Buffer,
  filename: string,
  type: 'audio' | 'pdf' | 'whisper' | 'image',
): Promise<string | null> {
  if (!currentSession) {
    serviceLogger.error('No active session to save file to');
    return null;
  }

  try {
    let targetDir: string;

    switch (type) {
      case 'audio':
        targetDir = currentSession.whisperSessionPath;
        break;
      case 'pdf':
        targetDir = currentSession.pdfPath;
        break;
      case 'image':
        targetDir = currentSession.imagesPath;
        break;
      case 'whisper':
        targetDir = currentSession.path;
        break;
      default:
        targetDir = currentSession.path;
    }

    const filePath = join(targetDir, filename);
    await fs.writeFile(filePath, fileBuffer);

    serviceLogger.info(`Saved ${type} file to session: ${filePath}`);

    return filePath;
  } catch (error) {
    serviceLogger.error(`Error saving ${type} file to session:`, error);
    return null;
  }
}

/**
 * Save a JSON object to the current session
 * @param data The data to save
 * @param filename The name of the file
 * @param type The type of file (snapshot or other)
 * @returns The path to the saved file
 */
export async function saveJsonToSession(
  data: Record<string, unknown>,
  filename: string,
  type: 'other',
): Promise<string | null> {
  if (!currentSession) {
    serviceLogger.error('No active session to save JSON to');
    return null;
  }

  try {
    const targetDir = currentSession.path;

    const filePath = join(targetDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    serviceLogger.info(`Saved ${type} JSON to session: ${filePath}`);

    return filePath;
  } catch (error) {
    serviceLogger.error(`Error saving ${type} JSON to session:`, error);
    return null;
  }
}

/**
 * Get the path for a specific file type in the current session
 * @param type The type of path to get
 * @returns The path or null if no session is active
 */
export function getSessionPath(type: 'root' | 'whisper' | 'pdf' | 'image'): string | null {
  if (!currentSession) {
    return null;
  }

  switch (type) {
    case 'root':
      return currentSession.path;
    case 'whisper':
      return currentSession.whisperSessionPath;
    case 'pdf':
      return currentSession.pdfPath;
    case 'image':
      return currentSession.imagesPath;
    default:
      return currentSession.path;
  }
}
