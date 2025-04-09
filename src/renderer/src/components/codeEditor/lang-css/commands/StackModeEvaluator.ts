import { Prec, type Extension, type StateCommand } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { IpcEmitter } from '@electron-toolkit/typed-ipc/renderer';
import type { IpcEvents } from 'src/types/ipc';
import { flashEffect, flashLinesEffect } from '../FlashLineEffect';

/**
 * Find the block boundaries from the current cursor position, excluding selector lines
 */
function findBlockBoundaries(state: EditorView['state']): { startLine: number; endLine: number } {
  const selection = state.selection.main;
  const cursor = selection.head;
  const cursorLine = state.doc.lineAt(cursor);

  // Find the block start (look for non-empty lines going up)
  let startLine = cursorLine.number;
  while (startLine > 1) {
    const line = state.doc.line(startLine - 1);
    const trimmed = line.text.trim();

    // Stop if we find an empty line, brace, or selector
    if (trimmed === '' || trimmed.includes('{') || trimmed.includes('}')) {
      break;
    }

    startLine--;
  }

  // Find the block end (look for non-empty lines going down)
  let endLine = cursorLine.number;
  while (endLine < state.doc.lines) {
    const line = state.doc.line(endLine + 1);
    const trimmed = line.text.trim();

    // Stop if we find an empty line, brace, or selector
    if (trimmed === '' || trimmed.includes('{') || trimmed.includes('}')) {
      break;
    }

    endLine++;
  }

  return { startLine, endLine };
}

/**
 * Remove comment markers and clean up a line
 */
function cleanLine(line: string): string {
  // Remove // and trim
  const commentIndex = line.indexOf('//');
  if (commentIndex !== -1) {
    // Get the content after // and trim
    return line.substring(commentIndex + 2).trim();
  }
  return line.trim();
}

/**
 * Extract text content from a range of lines
 */
function extractBlockContent(
  state: EditorView['state'],
  startLine: number,
  endLine: number,
): string {
  const lines: string[] = [];
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum);
    const cleanedLine = cleanLine(line.text);
    if (cleanedLine) {
      // Only add non-empty lines
      lines.push(cleanedLine);
    }
  }
  return lines.join('\n');
}

/**
 * Command to evaluate the current block and emit its content
 */
const evaluateStackModeBlock: StateCommand = ({ state, dispatch }) => {
  // Find the block boundaries
  const block = findBlockBoundaries(state);
  if (!block) return false;

  // Extract the block content
  const content = extractBlockContent(state, block.startLine, block.endLine);
  if (!content) return false;

  // Create emitter and send the content
  const emitter = new IpcEmitter<IpcEvents>();
  emitter.send('editor:stackmode', { content });

  // Apply flash effect to show the block boundaries
  dispatch(
    state.update({
      effects: flashLinesEffect.of(block),
    }),
  );

  return true;
};

/**
 * Command to evaluate just the current line and emit its content
 */
const evaluateStackModeLine: StateCommand = ({ state, dispatch }) => {
  const selection = state.selection.main;
  const cursorLine = state.doc.lineAt(selection.head);

  // Clean the line and check if it's not empty
  const content = cleanLine(cursorLine.text);
  if (!content) return false;

  // Create emitter and send the content
  const emitter = new IpcEmitter<IpcEvents>();
  emitter.send('editor:stackmode', { content });

  // Apply flash effect to show the line
  dispatch(
    state.update({
      effects: flashLinesEffect.of({
        startLine: cursorLine.number,
        endLine: cursorLine.number,
      }),
    }),
  );

  return true;
};

/**
 * Command to clear the stack
 */
const clearStackMode: StateCommand = ({ state, dispatch }) => {
  // Create emitter and send clear command
  const emitter = new IpcEmitter<IpcEvents>();
  emitter.send('editor:stackmode', { clear: true });

  // Flash the current line to indicate the clear action
  const cursorLine = state.doc.lineAt(state.selection.main.head);
  dispatch(
    state.update({
      effects: flashLinesEffect.of({
        startLine: cursorLine.number,
        endLine: cursorLine.number,
      }),
    }),
  );

  return true;
};

/**
 * Creates the stack mode evaluator extension with keyboard shortcuts
 */
export function stackModeEvaluator(): Extension {
  return [
    Prec.highest(
      keymap.of([
        {
          key: 'Mod-Enter', // This will be Cmd on Mac and Ctrl on Windows/Linux
          run: evaluateStackModeBlock,
        },
        {
          key: 'Shift-Mod-Enter', // This will be Shift-Cmd on Mac and Shift-Ctrl on Windows/Linux
          run: evaluateStackModeLine,
        },
        {
          key: 'Alt-Mod-Enter', // This will be Opt-Cmd on Mac and Alt-Ctrl on Windows/Linux
          run: clearStackMode,
        },
      ]),
    ),
    flashEffect(),
  ];
}
