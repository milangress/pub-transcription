import { Prec, type Extension, type StateCommand } from '@codemirror/state';
import { EditorView, keymap, type KeyBinding } from '@codemirror/view';

/**
 * Find the block boundaries from the current cursor position
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

    // Stop if we find an empty line or a line that looks like a block delimiter
    if (trimmed === '' || trimmed === '}' || trimmed === '{') {
      break;
    }

    startLine--;
  }

  // Find the block end (look for non-empty lines going down)
  let endLine = cursorLine.number;
  while (endLine < state.doc.lines) {
    const line = state.doc.line(endLine + 1);
    const trimmed = line.text.trim();

    // Stop if we find an empty line or closing brace
    if (trimmed === '' || trimmed === '}') {
      break;
    }

    endLine++;
  }

  return { startLine, endLine };
}

/**
 * Command to jump to the previous block
 */
const jumpToPreviousBlock: StateCommand = ({ state, dispatch }) => {
  // Find the current block boundaries
  const { startLine } = findBlockBoundaries(state);

  // If we're already at the first line, can't go further up
  if (startLine <= 1) return false;

  // Get the current cursor position to maintain horizontal position
  const selection = state.selection.main;
  const cursorPos = selection.head;
  const cursorLine = state.doc.lineAt(cursorPos);
  const cursorCol = cursorPos - cursorLine.from;

  // Look for the previous block boundary by going up from the current block's start
  let targetLine = startLine - 1;

  // Skip any empty lines or braces
  while (targetLine > 1) {
    const line = state.doc.line(targetLine);
    const trimmed = line.text.trim();
    if (trimmed !== '' && trimmed !== '}' && trimmed !== '{') {
      break;
    }
    targetLine--;
  }

  // If we found a valid target line, move the cursor there
  if (targetLine >= 1) {
    const line = state.doc.line(targetLine);

    // Calculate the new cursor position, maintaining the same column position
    // but clamping it to the line length to avoid going past the end
    const maxCol = line.length;
    const newCol = Math.min(cursorCol, maxCol);
    const newPos = line.from + newCol;

    const transaction = state.update({
      selection: { anchor: newPos, head: newPos },
    });
    dispatch(transaction);
    return true;
  }

  return false;
};

/**
 * Command to jump to the next block
 */
const jumpToNextBlock: StateCommand = ({ state, dispatch }) => {
  // Find the current block boundaries
  const { endLine } = findBlockBoundaries(state);

  // If we're already at the last line, can't go further down
  if (endLine >= state.doc.lines) return false;

  // Get the current cursor position to maintain horizontal position
  const selection = state.selection.main;
  const cursorPos = selection.head;
  const cursorLine = state.doc.lineAt(cursorPos);
  const cursorCol = cursorPos - cursorLine.from;

  // Look for the next block boundary by going down from the current block's end
  let targetLine = endLine + 1;

  // Skip any empty lines or braces
  while (targetLine <= state.doc.lines) {
    const line = state.doc.line(targetLine);
    const trimmed = line.text.trim();
    if (trimmed !== '' && trimmed !== '}' && trimmed !== '{') {
      break;
    }
    targetLine++;
  }

  // If we found a valid target line, move the cursor there
  if (targetLine <= state.doc.lines) {
    const line = state.doc.line(targetLine);

    // Calculate the new cursor position, maintaining the same column position
    // but clamping it to the line length to avoid going past the end
    const maxCol = line.length;
    const newCol = Math.min(cursorCol, maxCol);
    const newPos = line.from + newCol;

    const transaction = state.update({
      selection: { anchor: newPos, head: newPos },
    });
    dispatch(transaction);
    return true;
  }

  return false;
};

/**
 * Raw keymap array that can be merged with other keymaps
 */
export const livecodingKeymap: KeyBinding[] = [
  { key: 'Shift-ArrowUp', run: jumpToPreviousBlock },
  { key: 'Shift-ArrowDown', run: jumpToNextBlock },
];

/**
 * Creates an extension with the livecoding keymaps with highest precedence
 */
export function livecodingKeymapExtra(): Extension {
  return Prec.highest(keymap.of(livecodingKeymap));
}
