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

// Helper Function: Chunk Text - Revised Logic v3
// Creates smaller chunks, respecting line breaks, pause markers, and attempting to preserve original spacing.
function chunkText(text: string): string[] {
    const chunks: string[] = [];
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
    const blocks = normalizedText.split(/\n\s*\n+/);

    const maxWordsPerChunk = 12; // Target max words per chunk
    const sentenceTerminators = ['.', '?', '!'];
    const pauseMarkers = ['…', '–', '-'];
    // Combine terminators and pause markers for break checking
    const breakChars = [...sentenceTerminators, ...pauseMarkers, ','];

    for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // Split line by spaces, but keep the spaces as elements in the array
            // This helps preserve original spacing when rejoining parts.
            const parts = trimmedLine.split(/(\s+)/); // e.g., ["word1", " ", "word2", "  ", "word3."]

            let currentChunkParts: string[] = [];
            let wordCountInChunk = 0;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!part) continue; // Skip empty strings that might result from split

                const isWord = /\S/.test(part); // Check if the part contains non-whitespace

                if (isWord) {
                    wordCountInChunk++;
                }
                currentChunkParts.push(part); // Add the word or the space

                // Determine if a break should occur AFTER this part
                let shouldBreak = false;
                const isLastPart = i === parts.length - 1;

                if (isWord) {
                    const lastChar = part.trim().slice(-1); // Check last char of the actual word part
                    if (breakChars.includes(lastChar)) {
                        shouldBreak = true; // Break if word ends with punctuation/pause
                    } else if (wordCountInChunk >= maxWordsPerChunk) {
                        shouldBreak = true; // Break if max word count reached
                    }
                }

                if (isLastPart) {
                    shouldBreak = true; // Always break at the end of the line
                }


                if (shouldBreak) {
                    const chunkContent = currentChunkParts.join('').trim(); // Rejoin parts, trim ends
                    if (chunkContent) {
                        chunks.push(chunkContent);
                    }
                    currentChunkParts = []; // Reset for the next chunk
                    wordCountInChunk = 0;
                }
            }
             // Safety check: If the loop finished with parts left (shouldn't happen with isLastPart)
             // if (currentChunkParts.length > 0) {
             //     const finalChunkContent = currentChunkParts.join('').trim();
             //     if (finalChunkContent) chunks.push(finalChunkContent);
             // }
        }
    }
    return chunks.filter(chunk => chunk.length > 0);
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
