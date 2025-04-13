import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import defaultTextPath from '../../../resources/thesis.txt?asset';
import type { IpcRendererEvent } from '../../types/ipc';

const emitter = new IpcEmitter<IpcRendererEvent>();

interface FileSimulationController {
  start: () => void;
  stop: () => void;
}

/**
 * Chunks text into smaller segments, respecting line breaks and punctuation.
 * @param text - The input text to chunk
 * @returns Array of text chunks
 */
function chunkText(text: string): string[] {
  const maxWordsPerChunk = 12;
  const breakChars = ['.', '?', '!', '…', '–', '-', ','];
  const chunks: string[] = [];

  // Normalize text and split into paragraphs
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const paragraphs = normalizedText.split(/\n\s*\n+/);

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    // Process each line in the paragraph
    for (const line of paragraph.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Split keeping whitespace for rejoining later
      const parts = trimmedLine.split(/(\s+)/);

      let currentChunk: string[] = [];
      let wordCount = 0;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        const isWord = /\S/.test(part);
        if (isWord) wordCount++;

        currentChunk.push(part);

        // Check if we should create a chunk break
        const isLastPart = i === parts.length - 1;
        const shouldBreak =
          isLastPart ||
          (isWord && (breakChars.includes(part.trim().slice(-1)) || wordCount >= maxWordsPerChunk));

        if (shouldBreak) {
          const chunkContent = currentChunk.join('').trim();
          if (chunkContent) chunks.push(chunkContent);
          currentChunk = [];
          wordCount = 0;
        }
      }
    }
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Simulates a Whisper transcript stream by reading from a text file,
 * chunking it, and emitting words incrementally.
 *
 * @param mainWindow - The Electron main window to send messages to.
 * @param filePath - Path to the text file to read.
 * @returns Controller object with start() and stop() methods.
 */
export function simulateWhisperFromFile(
  mainWindow: BrowserWindow,
  filePath: string = defaultTextPath,
): FileSimulationController {
  let chunks: string[] = [];
  let currentChunkIndex = 0;
  let currentWordIndex = 0;
  let currentWordsInChunk: string[] = [];
  let simulationTimer: NodeJS.Timeout | null = null;
  let isRunning = false;

  // Constants for timing
  const TARGET_CHUNK_DURATION = 3500; // Target ms for chunk cycle
  const MIN_WORD_INTERVAL = 50; // Minimum ms between words
  const NEXT_CHUNK_DELAY = 10; // Delay before next chunk

  function loadAndChunkFile(): void {
    try {
      const absolutePath = path.resolve(filePath);
      console.log(`Reading file: ${absolutePath}`);
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      chunks = chunkText(fileContent);
      console.log(`Loaded and chunked file into ${chunks.length} segments.`);
    } catch (error: unknown) {
      console.error(`Error loading file ${filePath}:`, error);
      const errorMessage = `ERROR: Could not load file: ${path.basename(filePath)}. ${error instanceof Error ? error.message : String(error)}`;
      chunks = [errorMessage, 'Please check file path and permissions.NEW'];
    }

    // Reset state
    currentChunkIndex = 0;
    currentWordIndex = 0;
    currentWordsInChunk = [];
  }

  function stopSimulation(): void {
    if (simulationTimer) {
      clearTimeout(simulationTimer);
      simulationTimer = null;
    }
    isRunning = false;
    console.log('Simulation stopped.');
  }

  function processStep(): void {
    if (!isRunning || !mainWindow || mainWindow.isDestroyed()) {
      stopSimulation();
      return;
    }

    // Check if we've finished all chunks
    if (currentChunkIndex >= chunks.length) {
      emitter.send(mainWindow.webContents, 'whisper-ccp-stream:transcription', '-- END --NEW');
      stopSimulation();
      return;
    }

    // Starting a new chunk
    if (currentWordIndex === 0) {
      const currentChunkText = chunks[currentChunkIndex];
      currentWordsInChunk = currentChunkText.split(/\s+/).filter(Boolean);

      // Skip empty chunks
      if (currentWordsInChunk.length === 0) {
        currentChunkIndex++;
        scheduleNextStep(NEXT_CHUNK_DELAY);
        return;
      }

      // Calculate word interval based on target duration
      const wordInterval = Math.max(
        MIN_WORD_INTERVAL,
        TARGET_CHUNK_DURATION / (currentWordsInChunk.length + 1),
      );

      // Process intermediate word
      const wordsToShow = currentWordsInChunk.slice(0, currentWordIndex + 1);
      emitter.send(
        mainWindow.webContents,
        'whisper-ccp-stream:transcription',
        wordsToShow.join(' '),
      );
      currentWordIndex++;
      scheduleNextStep(wordInterval);
    }
    // Continue processing words in current chunk
    else if (currentWordIndex < currentWordsInChunk.length) {
      const wordsToShow = currentWordsInChunk.slice(0, currentWordIndex + 1);
      emitter.send(
        mainWindow.webContents,
        'whisper-ccp-stream:transcription',
        wordsToShow.join(' '),
      );
      currentWordIndex++;

      // Calculate word interval dynamically based on remaining words
      const remainingWords = currentWordsInChunk.length - currentWordIndex + 1; // +1 for final 'NEW'
      const wordInterval = Math.max(MIN_WORD_INTERVAL, TARGET_CHUNK_DURATION / remainingWords);

      scheduleNextStep(wordInterval);
    }
    // Finished all words in chunk, emit final with NEW
    else {
      emitter.send(
        mainWindow.webContents,
        'whisper-ccp-stream:transcription',
        chunks[currentChunkIndex] + 'NEW',
      );

      // Move to next chunk
      currentChunkIndex++;
      currentWordIndex = 0;
      currentWordsInChunk = [];
      scheduleNextStep(NEXT_CHUNK_DELAY);
    }
  }

  function scheduleNextStep(delay: number): void {
    if (!isRunning) return;
    if (simulationTimer) clearTimeout(simulationTimer);
    simulationTimer = setTimeout(processStep, delay);
  }

  function startSimulation(): void {
    if (isRunning) {
      console.warn('Simulation already running.');
      return;
    }

    stopSimulation(); // Clear any previous state
    isRunning = true;
    console.log('Starting simulation...');
    loadAndChunkFile();

    if (chunks.length > 0) {
      scheduleNextStep(100);
    } else {
      console.log('No content to process.');
      emitter.send(
        mainWindow.webContents,
        'whisper-ccp-stream:transcription',
        '-- NO CONTENT LOADED --NEW',
      );
      stopSimulation();
    }
  }

  return {
    start: startSimulation,
    stop: stopSimulation,
  };
}
