import { IpcEmitter } from '@electron-toolkit/typed-ipc/main';
import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path'; // Import path module
import defaultTextPath from '../../../resources/thesis.txt?asset';
import type { IpcRendererEvent } from '../../types/ipc';
const emitter = new IpcEmitter<IpcRendererEvent>();

interface FileSimulationController {
  start: () => void;
  stop: () => void;
}

// Helper Function: Chunk Text - Revised Logic v2
// Creates smaller chunks based on word count, line breaks, and pause markers.
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  // Normalize line endings and remove potential BOM
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');

  // 1. Split into paragraphs/major blocks
  const blocks = normalizedText.split(/\n\s*\n+/);

  const maxWordsPerChunk = 12; // Target max words per chunk (adjust as needed)
  const sentenceTerminators = ['.', '?', '!'];
  const pauseMarkers = ['…', '–', '-']; // Consider '-' carefully if it's part of words
  const breakChars = [...sentenceTerminators, ...pauseMarkers, ',']; // Include comma

  for (const block of blocks) {
    if (!block.trim()) continue; // Skip empty blocks

    // 2. Split block into lines
    const lines = block.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        // Treat empty lines between text lines as hard breaks if necessary,
        // but the current logic finalizes chunks at line ends anyway.
        continue;
      }

      // 3. Process words in the line
      const words = trimmedLine.split(/\s+/).filter(Boolean);
      let currentChunkBuffer: string[] = [];

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        currentChunkBuffer.push(word);

        const isLastWordOfLine = i === words.length - 1;
        // Check if the *last character* of the word is a break character
        const lastChar = word.slice(-1);
        // Simple check: does the word end with any break character?
        const isPunctuationBreak = breakChars.includes(lastChar);
        // TODO: Add more sophisticated check for standalone '-' if needed

        // Conditions to finalize the current chunk:
        const wordCountReached = currentChunkBuffer.length >= maxWordsPerChunk;

        if (wordCountReached || isPunctuationBreak || isLastWordOfLine) {
          // Ensure we don't add empty chunks
          if (currentChunkBuffer.length > 0) {
            chunks.push(currentChunkBuffer.join(' '));
          }
          currentChunkBuffer = []; // Reset for the next chunk
        }
      }
      // This check should be redundant because isLastWordOfLine handles the final part.
      // if (currentChunkBuffer.length > 0) {
      //    chunks.push(currentChunkBuffer.join(' '));
      // }
    }
  }

  // Final filter for any genuinely empty chunks (should be minimal)
  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Simulates a Whisper transcript stream by reading from a text file,
 * chunking it, and emitting words incrementally.
 *
 * @param mainWindow - The Electron main window to send messages to.
 * @param filePath - Absolute path to the text file to read.
 * @param options - Configuration options for timing.
 * @param options.wordEmitInterval - Milliseconds between emitting words within a chunk.
 * @param options.chunkDelay - Milliseconds delay before starting the next chunk.
 * @returns Controller object with start() and stop() methods.
 */
export function simulateWhisperFromFile(
  mainWindow: BrowserWindow,
  filePath: string = defaultTextPath, // Use imported asset path as default
  // options: { wordEmitInterval?: number; chunkDelay?: number } = {}, // Options removed
): FileSimulationController {
  // const { wordEmitInterval = 150, chunkDelay = 400 } = options; // Timing constants removed/replaced

  let chunks: string[] = [];
  let currentChunkIndex = 0;
  let currentWordIndex = 0;
  let currentWordsInChunk: string[] = [];
  let simulationTimer: NodeJS.Timeout | null = null;
  let isRunning = false; // Flag to prevent multiple start calls overlapping
  let calculatedIntermediateInterval = 150; // Stores the calculated delay between words for the current chunk

  function loadAndChunkFile(): void {
    try {
      // Resolve the path relative to the script file or use an absolute path
      // If filePath is relative, this makes it relative to CWD which might not be what you want.
      // Ensure filePath is absolute or correctly resolved.
      const absolutePath = path.resolve(filePath); // Make sure path is absolute
      console.log(`Attempting to read file: ${absolutePath}`);
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      chunks = chunkText(fileContent);
      console.log(`Loaded and chunked file into ${chunks.length} segments.`);
      // Optional: Log first few chunks for debugging
      // console.log('First 5 chunks:', chunks.slice(0, 5));
    } catch (error: unknown) {
      console.error(`Error reading or chunking file ${filePath}:`, error);
      // Send an error message to the renderer if needed
      const errorMessage = `ERROR: Could not load or process file: ${path.basename(filePath)}. Details: ${error instanceof Error ? error.message : String(error)}`;
      chunks = [errorMessage, 'Please check file path and permissions.NEW'];
      // Ensure the error is visible in the simulation stream
    }
    // Reset indices
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
    console.log('File simulation stopped.');
  }

  function scheduleNextStep(delay: number): void {
    if (!isRunning) return; // Stop scheduling if stop was called
    if (simulationTimer) clearTimeout(simulationTimer); // Clear previous timer
    simulationTimer = setTimeout(processStep, delay);
  }

  function processStep(): void {
    if (!isRunning || !mainWindow || mainWindow.isDestroyed()) {
      stopSimulation();
      return;
    }

    // Check if we've processed all chunks
    if (currentChunkIndex >= chunks.length) {
      console.log('Finished processing all chunks.');
      emitter.send(
        mainWindow.webContents,
        'whisper-ccp-stream:transcription',
        '-- END OF SIMULATION --NEW',
      );
      stopSimulation();
      return;
    }

    // --- Processing a Chunk ---

    // If starting a new chunk, calculate timing and split words
    if (currentWordIndex === 0) {
      const currentChunkText = chunks[currentChunkIndex];
      currentWordsInChunk = currentChunkText.split(/\s+/).filter(Boolean);

      // If chunk was empty or just whitespace after split, skip it
      if (currentWordsInChunk.length === 0) {
        console.log(`Skipping empty chunk index: ${currentChunkIndex}`);
        currentChunkIndex++;
        scheduleNextStep(10); // Quickly move to the next chunk processing
        return;
      }

      // Calculate interval for intermediate steps to fit within the target duration
      const numWords = currentWordsInChunk.length;
      const targetChunkDuration = 3000; // Target 3 seconds for the whole chunk cycle (including final 'NEW')
      const minInterval = 50; // Minimum delay between words (ms) to avoid flooding

      // Add 1 to numWords because the final 'NEW' emission is the last step in the cycle
      calculatedIntermediateInterval = Math.max(minInterval, targetChunkDuration / (numWords + 1));

      // Optional: Log the calculated interval for debugging
      // console.log(`Chunk ${currentChunkIndex}: ${numWords} words, interval: ${calculatedIntermediateInterval.toFixed(0)}ms`);
    }

    // Emit the next word for intermediate updates
    if (currentWordIndex < currentWordsInChunk.length) {
      const wordsToShow = currentWordsInChunk.slice(0, currentWordIndex + 1);
      const partialTranscript = wordsToShow.join(' ');

      // Send the intermediate transcript update
      emitter.send(mainWindow.webContents, 'whisper-ccp-stream:transcription', partialTranscript);

      currentWordIndex++;
      // Schedule the next intermediate word emission using the calculated interval
      scheduleNextStep(calculatedIntermediateInterval);
    }
    // If all intermediate words of the chunk have been emitted
    else {
      // Send the FINAL transcript for this chunk with "NEW"
      const fullChunkText = chunks[currentChunkIndex]; // Use original text
      emitter.send(
        mainWindow.webContents,
        'whisper-ccp-stream:transcription',
        fullChunkText + 'NEW',
      );
      console.log(`Sent NEW for chunk ${currentChunkIndex}`);

      // Move to the next chunk
      currentChunkIndex++;
      currentWordIndex = 0; // Reset word index for the new chunk
      currentWordsInChunk = []; // Clear word array

      // Schedule the processing of the *next* chunk almost immediately.
      // The 3-second delay is handled *within* the processing cycle of that next chunk.
      scheduleNextStep(10);
    }
  }

  function startSimulation(): void {
    if (isRunning) {
      console.warn('Simulation is already running.');
      return;
    }
    stopSimulation(); // Ensure any previous timer is cleared
    isRunning = true;
    console.log('Starting file simulation...');
    loadAndChunkFile();

    if (chunks.length > 0) {
      scheduleNextStep(100); // Start processing the first chunk quickly
    } else {
      console.log('No chunks to process. Stopping.');
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
