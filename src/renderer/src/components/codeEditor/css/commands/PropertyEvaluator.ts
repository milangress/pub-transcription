/**
 * CSS Property Evaluator Algorithm
 * -------------------------------
 * Purpose: Evaluate and manage CSS properties within a selector block, ensuring only the most recent
 * property declarations are active while commenting out older ones.
 *
 * Key Concepts:
 * 1. SELECTOR RANGE: The entire CSS selector block from { to }
 * 2. BLOCK RANGE: The current logical block of properties we're evaluating within the selector
 *
 * Algorithm Steps:
 * 1. When evaluating properties (Alt-Enter or Ctrl-Enter):
 *    a. Find the SELECTOR RANGE (from { to })
 *    b. Find the BLOCK RANGE (current group of properties)
 *    c. First uncomment everything in the BLOCK RANGE
 *    d. For each property in the BLOCK RANGE:
 *       - Find ALL occurrences of this property within the SELECTOR RANGE
 *       - If multiple occurrences found:
 *         * Keep the last occurrence in the BLOCK RANGE active
 *         * Comment out all other occurrences (both inside and outside the block but within selector)
 *
 * Example:
 * .el {
 *   transform: scale(1);     // <- Outside block, will be commented if transform exists in block
 *   color: red;             // <- Outside block, will be commented if color exists in block
 *
 *   // Current block start
 *   transform: rotate(30deg);  // <- Will be commented as it's not the last transform
 *   color: blue;              // <- Will be commented as it's not the last color
 *   transform: skew(20deg);   // <- Will stay active as it's the last transform
 *   color: green;            // <- Will stay active as it's the last color
 *   // Current block end
 *
 *   background: black;      // <- Outside block, unaffected as no background in block
 * }
 */

import { lineUncomment, toggleLineComment } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import {
  type Extension,
  type StateCommand,
  EditorSelection,
  SelectionRange,
  Transaction,
} from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { flashEffect, flashLinesEffect } from '../FlashEffect';

// Cache for storing parsing results to avoid redundant operations
const parseCache = {
  lastDoc: null as string | null,
  blockLines: new Map<number, { startLine: number; endLine: number }>(),
  propertyMap: new Map<string, { line: number; commented: boolean }[]>(),
};

/**
 * Find the CSS selector block boundaries from the current cursor position
 */
function findSelectorBlockBoundaries(
  state: EditorView['state'],
): { startLine: number; endLine: number } | null {
  const selection = state.selection.main;
  const cursor = selection.head;
  const cursorLine = state.doc.lineAt(cursor);

  let startLine = cursorLine.number;
  let endLine = cursorLine.number;
  let foundOpenBrace = false;
  let foundCloseBrace = false;

  // Search upwards for opening brace
  while (startLine >= 1 && !foundOpenBrace) {
    const line = state.doc.line(startLine);
    if (line.text.includes('{')) {
      foundOpenBrace = true;
      break;
    }
    startLine--;
  }

  // Search downwards for closing brace
  while (endLine <= state.doc.lines && !foundCloseBrace) {
    const line = state.doc.line(endLine);
    if (line.text.includes('}')) {
      foundCloseBrace = true;
      break;
    }
    endLine++;
  }

  // Only return if we found both braces
  if (foundOpenBrace && foundCloseBrace) {
    return { startLine, endLine };
  }

  return null;
}

/**
 * Find all lines containing the CSS block (start from the cursor position)
 */
function findBlockLines(state: EditorView['state']): { startLine: number; endLine: number } | null {
  const selection = state.selection.main;
  const cursor = selection.head;
  const docString = state.doc.toString();
  const cursorLine = state.doc.lineAt(cursor);

  // Check cache for this cursor position
  if (parseCache.lastDoc === docString && parseCache.blockLines.has(cursorLine.number)) {
    return parseCache.blockLines.get(cursorLine.number)!;
  }

  // Find the selector block boundaries first
  const selectorBlock = findSelectorBlockBoundaries(state);
  if (!selectorBlock) return null;

  // Find the block start within the selector block (look for non-empty lines going up)
  let startLine = cursorLine.number;
  while (startLine > selectorBlock.startLine) {
    const line = state.doc.line(startLine - 1);
    const trimmed = line.text.trim();

    // Stop if we find an empty line or a line that looks like a block delimiter
    if (trimmed === '' || trimmed === '}' || trimmed === '{') {
      break;
    }

    startLine--;
  }

  // Find the block end within the selector block (look for non-empty lines going down)
  let endLine = cursorLine.number;
  while (endLine < selectorBlock.endLine) {
    const line = state.doc.line(endLine + 1);
    const trimmed = line.text.trim();

    // Stop if we find an empty line or closing brace
    if (trimmed === '' || trimmed === '}') {
      break;
    }

    endLine++;
  }

  // Update cache
  const result = { startLine, endLine };
  if (parseCache.lastDoc !== docString) {
    parseCache.lastDoc = docString;
    parseCache.blockLines.clear();
    parseCache.propertyMap.clear();
  }
  parseCache.blockLines.set(cursorLine.number, result);

  return result;
}

/**
 * Find the current line at cursor position
 */
function findCurrentLine(
  state: EditorView['state'],
): { startLine: number; endLine: number } | null {
  const selection = state.selection.main;
  const cursorLine = state.doc.lineAt(selection.head);
  return { startLine: cursorLine.number, endLine: cursorLine.number };
}

/**
 * Find all commented lines in a range - optimized with early returns
 */
function findCommentedLines(
  state: EditorView['state'],
  startLine: number,
  endLine: number,
): number[] {
  const commentedLines: number[] = [];

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum);
    if (line.text.trim().startsWith('//')) {
      commentedLines.push(lineNum);
    }
  }

  return commentedLines;
}

/**
 * Extract all distinct property names from a range of lines
 * Now with performance optimizations and caching
 */
function extractRangeProperties(
  state: EditorView['state'],
  startLine: number,
  endLine: number,
): string[] {
  const properties = new Set<string>();

  // Quick scan to avoid expensive tree operations when possible
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum);
    const trimmedText = line.text.trim();

    // Process commented lines with regex for speed
    if (trimmedText.startsWith('//')) {
      const match = trimmedText.match(/\/\/\s*([a-zA-Z-]+):/);
      if (match && match[1]) {
        properties.add(match[1].trim());
      }
      continue;
    }

    // Quick property extraction via regex for simple cases
    const quickMatch = trimmedText.match(/^([a-zA-Z-]+):/);
    if (quickMatch && quickMatch[1]) {
      properties.add(quickMatch[1].trim());
      continue;
    }

    // Use syntax tree as fallback for complex cases
    syntaxTree(state).iterate({
      from: line.from,
      to: line.to,
      enter: (node) => {
        if (node.type.name === 'PropertyName') {
          const name = state.doc.sliceString(node.from, node.to).trim();
          properties.add(name);
        }
        return false; // Only process the first property name node
      },
    });
  }

  return Array.from(properties);
}

/**
 * Find all occurrences of a property in a specific range of lines
 * Now with optimized property detection
 */
function findPropertyLinesInRange(
  state: EditorView['state'],
  propertyName: string,
  startLine: number,
  endLine: number,
): number[] {
  const lines: number[] = [];

  // Use regex-based scan for faster property detection
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum);
    const trimmedText = line.text.trim();

    // Skip commented lines quickly
    if (trimmedText.startsWith('//')) {
      continue;
    }

    // Check for property with fast regex first
    const propertyMatch = new RegExp(`^${propertyName}\\s*:`).test(trimmedText);
    if (propertyMatch) {
      lines.push(lineNum);
      continue;
    }

    // Fall back to syntax tree only for complex cases
    if (trimmedText.includes(propertyName)) {
      let found = false;
      syntaxTree(state).iterate({
        from: line.from,
        to: line.to,
        enter: (node) => {
          if (node.type.name === 'PropertyName') {
            const name = state.doc.sliceString(node.from, node.to).trim();
            if (name === propertyName) {
              found = true;
              return false;
            }
          }
          return !found;
        },
      });

      if (found) {
        lines.push(lineNum);
      }
    }
  }

  return lines;
}

/**
 * Batch comment operation to reduce individual transactions
 */
function batchCommentLines(view: EditorView, linesToComment: number[]): void {
  if (linesToComment.length === 0) return;

  // Group adjacent lines to reduce the number of selections
  const ranges: { start: number; end: number }[] = [];
  let currentRange: { start: number; end: number } | null = null;

  linesToComment
    .sort((a, b) => a - b)
    .forEach((lineNum) => {
      if (!currentRange) {
        currentRange = { start: lineNum, end: lineNum };
      } else if (lineNum === currentRange.end + 1) {
        currentRange.end = lineNum;
      } else {
        ranges.push(currentRange);
        currentRange = { start: lineNum, end: lineNum };
      }
    });

  if (currentRange) {
    ranges.push(currentRange);
  }

  // Create selections for each range
  const selections = ranges.map((range) => {
    const startLine = view.state.doc.line(range.start);
    const endLine = view.state.doc.line(range.end);
    return EditorSelection.range(startLine.from, endLine.to);
  });

  if (selections.length > 0) {
    const selection = EditorSelection.create(selections);
    const tr = view.state.update({ selection });
    view.dispatch(tr);
    toggleLineComment({ state: tr.state, dispatch: view.dispatch });
  }
}

/**
 * Core function to evaluate properties - improved implementation with batched operations
 */
function evaluatePropertiesCore(
  { state, dispatch }: { state: EditorView['state']; dispatch?: (tr: Transaction) => void },
  blockRange: { startLine: number; endLine: number },
): boolean {
  if (!dispatch) return false;

  // Store the original selection to restore it later
  const originalSelection = state.selection;

  // Clear cache if document changed
  if (parseCache.lastDoc !== state.doc.toString()) {
    parseCache.lastDoc = state.doc.toString();
    parseCache.blockLines.clear();
    parseCache.propertyMap.clear();
  }

  // Get the selector block boundaries
  const selectorBlock = findSelectorBlockBoundaries(state);
  if (!selectorBlock) return false;

  // Find any commented lines in the block range
  const commentedLines = findCommentedLines(state, blockRange.startLine, blockRange.endLine);

  // Step 1: First uncomment all commented lines in the block range
  if (commentedLines.length > 0) {
    const commentRanges = commentedLines.map((lineNum) => {
      const line = state.doc.line(lineNum);
      return EditorSelection.range(line.from, line.from);
    });

    const commentSelection = EditorSelection.create(commentRanges);
    const tr = state.update({
      selection: commentSelection,
      effects: flashLinesEffect.of(blockRange),
    });
    dispatch(tr);
    lineUncomment({ state: tr.state, dispatch });

    requestAnimationFrame(() => {
      const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
      if (view) {
        applyRangeEvaluation(view, blockRange, selectorBlock);
      }
    });

    return true;
  } else {
    dispatch(
      state.update({
        effects: flashLinesEffect.of(blockRange),
      }),
    );

    const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
    if (!view) return false;

    return applyRangeEvaluation(view, blockRange, selectorBlock);
  }

  function applyRangeEvaluation(
    view: EditorView,
    blockRange: { startLine: number; endLine: number },
    selectorBlock: { startLine: number; endLine: number },
  ): boolean {
    if (!view) return false;

    const updatedState = view.state;
    let anyProcessed = false;
    const linesToComment: number[] = [];

    // Extract all distinct property names from the block range
    const blockProperties = extractRangeProperties(
      updatedState,
      blockRange.startLine,
      blockRange.endLine,
    );

    blockProperties.forEach((propName) => {
      // Find ALL occurrences of this property within the selector block
      const allPropLines = findPropertyLinesInRange(
        updatedState,
        propName,
        selectorBlock.startLine,
        selectorBlock.endLine,
      );

      if (allPropLines.length > 1) {
        // Find the last occurrence within our block range
        const blockPropLines = allPropLines.filter(
          (line) => line >= blockRange.startLine && line <= blockRange.endLine,
        );

        if (blockPropLines.length > 0) {
          const lastActiveLine = blockPropLines[blockPropLines.length - 1];

          // Comment out all other occurrences of this property in the selector
          const linesToDeactivate = allPropLines.filter((line) => line !== lastActiveLine);
          linesToComment.push(...linesToDeactivate);
          anyProcessed = true;
        }
      }
    });

    // Apply all comments in one batch operation
    if (linesToComment.length > 0) {
      batchCommentLines(view, linesToComment);
    }

    // Restore the original cursor position/selection
    requestAnimationFrame(() => {
      view.dispatch({
        selection: originalSelection,
      });
    });

    return anyProcessed;
  }
}

/**
 * Command to evaluate properties in the current CSS block
 */
const evaluatePropertiesBlock: StateCommand = (params) => {
  const block = findBlockLines(params.state);
  if (!block) return false;

  return evaluatePropertiesCore(params, block);
};

/**
 * Command to comment all lines in the current CSS block
 */
const commentBlock: StateCommand = ({ state, dispatch }) => {
  const block = findBlockLines(state);
  if (!block) return false;

  // Store original selection
  const originalSelection = state.selection;

  // Check if all lines in block are commented
  let allCommented = true;
  for (let lineNum = block.startLine; lineNum <= block.endLine; lineNum++) {
    const line = state.doc.line(lineNum);
    if (!line.text.trim().startsWith('//')) {
      allCommented = false;
      break;
    }
  }

  // If all lines are commented, uncomment them
  if (allCommented) {
    const commentRanges: readonly SelectionRange[] = [];
    for (let lineNum = block.startLine; lineNum <= block.endLine; lineNum++) {
      const line = state.doc.line(lineNum);
      (commentRanges as SelectionRange[]).push(EditorSelection.range(line.from, line.from));
    }
    const selection = EditorSelection.create(commentRanges);
    const tr = state.update({ selection });
    dispatch(tr);
    lineUncomment({ state: tr.state, dispatch });

    // Restore cursor position
    requestAnimationFrame(() => {
      const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
      if (view) {
        view.dispatch({
          selection: originalSelection,
        });
      }
    });
    return true;
  }
  // Otherwise comment all lines (but avoid double commenting)
  else {
    const commentRanges: readonly SelectionRange[] = [];
    for (let lineNum = block.startLine; lineNum <= block.endLine; lineNum++) {
      const line = state.doc.line(lineNum);
      if (!line.text.trim().startsWith('//')) {
        (commentRanges as SelectionRange[]).push(EditorSelection.range(line.from, line.to));
      }
    }
    if ((commentRanges as SelectionRange[]).length > 0) {
      const selection = EditorSelection.create(commentRanges);
      const tr = state.update({ selection });
      dispatch(tr);
      toggleLineComment({ state: tr.state, dispatch });

      // Restore cursor position
      requestAnimationFrame(() => {
        const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
        if (view) {
          view.dispatch({
            selection: originalSelection,
          });
        }
      });
      return true;
    }
  }
  return false;
};

/**
 * Command to evaluate properties in just the current line
 * If the line is not commented, it will be commented
 * If the line is commented, it will be evaluated
 */
const evaluatePropertiesLine: StateCommand = (params) => {
  const line = findCurrentLine(params.state);
  if (!line) return false;

  // Store original selection
  const originalSelection = params.state.selection;

  // Check if current line is commented
  const currentLine = params.state.doc.line(line.startLine);
  const isCommented = currentLine.text.trim().startsWith('//');

  // If not commented, just comment it
  if (!isCommented) {
    const ranges: readonly SelectionRange[] = [
      EditorSelection.range(currentLine.from, currentLine.to),
    ];
    const selection = EditorSelection.create(ranges);
    const tr = params.state.update({ selection });
    params.dispatch?.(tr);
    toggleLineComment({ state: tr.state, dispatch: params.dispatch });

    // Restore cursor position
    requestAnimationFrame(() => {
      const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
      if (view) {
        view.dispatch({
          selection: originalSelection,
        });
      }
    });
    return true;
  }

  // If commented, evaluate it
  return evaluatePropertiesCore(params, line);
};

/**
 * Creates the property evaluator extension with keyboard shortcuts
 */
export function propertyEvaluator(): Extension {
  return [
    keymap.of([
      { key: 'Alt-Enter', run: evaluatePropertiesBlock },
      { key: 'Ctrl-Enter', run: evaluatePropertiesLine },
      { key: 'Shift-Alt-Enter', run: commentBlock },
    ]),
    flashEffect(),
  ];
}
