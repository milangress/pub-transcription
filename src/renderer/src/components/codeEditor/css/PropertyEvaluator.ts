import { lineUncomment, toggleLineComment } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { type Extension, type StateCommand, EditorSelection, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { flashEffect, flashLinesEffect } from './FlashEffect';

/**
 * Find all lines containing the CSS block (start from the cursor position)
 */
function findBlockLines(state: EditorView['state']): { startLine: number; endLine: number } | null {
  const selection = state.selection.main;
  const cursor = selection.head;

  // Get the current line
  const cursorLine = state.doc.lineAt(cursor);

  // Find the block start (look for non-empty lines going up)
  let startLine = cursorLine.number;
  while (startLine > 1) {
    const line = state.doc.line(startLine - 1);
    const trimmed = line.text.trim();

    // Stop if we find an empty line or a line that doesn't look like CSS property (no braces yet)
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

  console.log(`Found block from ${startLine} to ${endLine}`);
  return { startLine, endLine };
}

/**
 * Find the current line at cursor position
 */
function findCurrentLine(
  state: EditorView['state'],
): { startLine: number; endLine: number } | null {
  const selection = state.selection.main;
  const cursorLine = state.doc.lineAt(selection.head);

  console.log(`Evaluating current line: ${cursorLine.number}`);
  return { startLine: cursorLine.number, endLine: cursorLine.number };
}

/**
 * Find all commented lines in a range
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
 */
function extractRangeProperties(
  state: EditorView['state'],
  startLine: number,
  endLine: number,
): string[] {
  const properties = new Set<string>();

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum);

    // Skip commented lines
    if (line.text.trim().startsWith('//')) {
      // Extract property name from comment
      const match = line.text.trim().match(/\/\/\s*([a-zA-Z-]+):/);
      if (match && match[1]) {
        properties.add(match[1].trim());
      }
      continue;
    }

    // Extract property from syntax tree
    syntaxTree(state).iterate({
      from: line.from,
      to: line.to,
      enter: (node) => {
        if (node.type.name === 'PropertyName') {
          const name = state.doc.sliceString(node.from, node.to).trim();
          properties.add(name);
        }
        return true;
      },
    });
  }

  return Array.from(properties);
}

/**
 * Find all occurrences of a property in a specific range of lines
 */
function findPropertyLinesInRange(
  state: EditorView['state'],
  propertyName: string,
  startLine: number,
  endLine: number,
): number[] {
  const lines: number[] = [];

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum);

    // Skip already commented lines since they won't have PropertyName nodes
    if (line.text.trim().startsWith('//')) {
      continue;
    }

    // Check active lines via syntax tree (this will automatically skip commented lines)
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
        return true;
      },
    });

    if (found) {
      lines.push(lineNum);
    }
  }

  return lines;
}

/**
 * Core function to evaluate properties - abstract implementation that can work with
 * either a single line or a block of lines
 */
function evaluatePropertiesCore(
  { state, dispatch }: { state: EditorView['state']; dispatch?: (tr: Transaction) => void },
  range: { startLine: number; endLine: number },
): boolean {
  if (!dispatch) return false;

  // Store the original selection to restore it later
  const originalSelection = state.selection;

  // Find any commented lines in the range
  const commentedLines = findCommentedLines(state, range.startLine, range.endLine);

  console.log(`Range spans lines ${range.startLine} to ${range.endLine}`);
  console.log(`Found ${commentedLines.length} commented lines in range`);

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

    // Now we need to wait for this transaction to complete before continuing
    setTimeout(() => {
      applyRangeEvaluation(range);
    }, 50);

    return true;
  } else {
    // No commented lines - add flash effect to a regular transaction
    dispatch(
      state.update({
        effects: flashLinesEffect.of(range),
      }),
    );

    // Proceed directly
    return applyRangeEvaluation(range);
  }

  // Helper function to apply the rest of the evaluation
  function applyRangeEvaluation(range: { startLine: number; endLine: number }): boolean {
    // Get the updated editor state
    const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
    if (!view || !dispatch) return false;

    const updatedState = view.state;

    // Step 2: Extract all distinct property names from the range
    const allProperties = extractRangeProperties(updatedState, range.startLine, range.endLine);
    console.log(
      `Found ${allProperties.length} distinct properties in range: ${allProperties.join(', ')}`,
    );

    // Step 3: For each property, comment out all occurrences outside the range
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

    // Comment out all properties outside the range
    if (outsideLinesToComment.length > 0) {
      console.log(`Commenting out ${outsideLinesToComment.length} properties outside range`);

      const outsideRanges = outsideLinesToComment.map((lineNum) => {
        const line = updatedState.doc.line(lineNum);
        return EditorSelection.range(line.from, line.from);
      });

      const outsideSelection = EditorSelection.create(outsideRanges);
      const trOutside = updatedState.update({ selection: outsideSelection });
      view.dispatch(trOutside);
      toggleLineComment({ state: trOutside.state, dispatch: view.dispatch });

      // Wait for this to complete before doing the next step
      setTimeout(() => {
        handleRangeProperties(range, allProperties);
      }, 50);

      return true;
    } else {
      // No outside properties to comment, proceed with range properties
      return handleRangeProperties(range, allProperties);
    }
  }

  // Helper function to handle properties within the range
  function handleRangeProperties(
    range: { startLine: number; endLine: number },
    properties: string[],
  ): boolean {
    const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
    if (!view || !dispatch) return false;

    const updatedState = view.state;

    // Step 4: For each property in the range, ensure only the last instance is active
    let anyProcessed = false;

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
        const linesToComment = propLines.slice(0, propLines.length - 1);
        console.log(
          `For property '${propName}', commenting out ${linesToComment.length} of ${propLines.length} occurrences`,
        );

        const propRanges = linesToComment.map((lineNum) => {
          const line = updatedState.doc.line(lineNum);
          return EditorSelection.range(line.from, line.from);
        });

        const propSelection = EditorSelection.create(propRanges);
        const trProp = updatedState.update({
          selection: propSelection,
        });
        view.dispatch(trProp);
        toggleLineComment({ state: trProp.state, dispatch: view.dispatch });

        anyProcessed = true;
      }
    });

    // Final step: Restore the original cursor position/selection
    setTimeout(() => {
      const finalView = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
      if (finalView) {
        // Map the original selection through potential document changes
        // to handle cases where line numbers might have changed
        finalView.dispatch({
          selection: originalSelection,
        });
      }
    }, 50);

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
