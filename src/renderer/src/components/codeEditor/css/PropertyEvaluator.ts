import { lineUncomment, toggleLineComment } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { type Extension, type StateCommand, EditorSelection, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { flashEffect, flashLinesEffect } from './FlashEffect';

// Cache for storing parsing results to avoid redundant operations
const parseCache = {
  lastDoc: null as string | null,
  blockLines: new Map<number, { startLine: number; endLine: number }>(),
  propertyMap: new Map<string, { line: number; commented: boolean }[]>(),
};

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

  // Find the block start (look for non-empty lines going up)
  let startLine = cursorLine.number;
  while (startLine > 1) {
    const line = state.doc.line(startLine - 1);
    const trimmed = line.text.trim();

    // Stop if we find an empty line or a line that doesn't look like CSS property
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
  range: { startLine: number; endLine: number },
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

  // Find any commented lines in the range
  const commentedLines = findCommentedLines(state, range.startLine, range.endLine);

  // Step 1: First uncomment all commented lines in the range
  if (commentedLines.length > 0) {
    // Create a selection for all commented lines
    const commentRanges = commentedLines.map((lineNum) => {
      const line = state.doc.line(lineNum);
      return EditorSelection.range(line.from, line.from);
    });

    // Apply lineUncomment to all commented lines
    const commentSelection = EditorSelection.create(commentRanges);
    const tr = state.update({
      selection: commentSelection,
      effects: flashLinesEffect.of(range),
    });
    dispatch(tr);
    lineUncomment({ state: tr.state, dispatch });

    // Use requestAnimationFrame instead of setTimeout for better performance
    requestAnimationFrame(() => {
      const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
      if (view) {
        applyRangeEvaluation(view, range);
      }
    });

    return true;
  } else {
    // No commented lines - add flash effect to a regular transaction
    dispatch(
      state.update({
        effects: flashLinesEffect.of(range),
      }),
    );

    // Get the view directly
    const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
    if (!view) return false;

    // Proceed directly
    return applyRangeEvaluation(view, range);
  }

  // Helper function to apply the rest of the evaluation using the view directly
  function applyRangeEvaluation(
    view: EditorView,
    range: { startLine: number; endLine: number },
  ): boolean {
    if (!view) return false;

    const updatedState = view.state;

    // Step 2: Extract all distinct property names from the range
    const allProperties = extractRangeProperties(updatedState, range.startLine, range.endLine);

    // Step 3: Collect all lines to comment outside the range
    const outsideLinesToComment: number[] = [];

    allProperties.forEach((propName) => {
      // Find occurrences outside the range (before the range)
      if (range.startLine > 1) {
        const beforeLines = findPropertyLinesInRange(
          updatedState,
          propName,
          1,
          range.startLine - 1,
        );
        outsideLinesToComment.push(...beforeLines);
      }

      // Find occurrences outside the range (after the range)
      if (range.endLine < updatedState.doc.lines) {
        const afterLines = findPropertyLinesInRange(
          updatedState,
          propName,
          range.endLine + 1,
          updatedState.doc.lines,
        );
        outsideLinesToComment.push(...afterLines);
      }
    });

    // Comment out all properties outside the range in a single batch
    if (outsideLinesToComment.length > 0) {
      batchCommentLines(view, outsideLinesToComment);

      requestAnimationFrame(() => {
        handleRangeProperties(view, range, allProperties);
      });

      return true;
    } else {
      // No outside properties to comment, proceed with range properties
      return handleRangeProperties(view, range, allProperties);
    }
  }

  // Helper function to handle properties within the range (optimized)
  function handleRangeProperties(
    view: EditorView,
    range: { startLine: number; endLine: number },
    properties: string[],
  ): boolean {
    if (!view) return false;

    const updatedState = view.state;
    let anyProcessed = false;
    const linesToComment: number[] = [];

    // Collect all lines to comment in one pass
    properties.forEach((propName) => {
      // Find all instances of this property in the range
      const propLines = findPropertyLinesInRange(
        updatedState,
        propName,
        range.startLine,
        range.endLine,
      );

      if (propLines.length > 1) {
        // Keep only the last occurrence active
        linesToComment.push(...propLines.slice(0, propLines.length - 1));
        anyProcessed = true;
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
 * Command to evaluate properties in just the current line
 */
const evaluatePropertiesLine: StateCommand = (params) => {
  const line = findCurrentLine(params.state);
  if (!line) return false;

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
    ]),
    flashEffect(),
  ];
}
