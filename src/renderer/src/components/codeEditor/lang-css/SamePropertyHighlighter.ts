import { syntaxTree } from '@codemirror/language';
import { type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin } from '@codemirror/view';

// Create a base theme for the property highlights
const propertyHighlightTheme = EditorView.baseTheme({
  '&light .cm-propertyHighlight': { backgroundColor: 'oklch(0.93 0.26 121.72 / 0.19);' },
  '&dark .cm-propertyHighlight': { backgroundColor: 'oklch(0.93 0.26 121.72 / 0.19);' },
  '&light .cm-propertyText': { color: 'red' },
  '&dark .cm-propertyText': { color: 'red' },
  '&light .cm-defaultPropertyText': { color: 'green' },
  '&dark .cm-defaultPropertyText': { color: 'green' },
});

// Decoration for highlighting the entire line
const propertyHighlight = Decoration.line({
  attributes: { class: 'cm-propertyHighlight' },
});

// Decoration for highlighting matching property names in red
const propertyTextHighlight = Decoration.mark({
  attributes: { class: 'cm-propertyText' },
});

// Decoration for highlighting all property names in green
const defaultPropertyHighlight = Decoration.mark({
  attributes: { class: 'cm-defaultPropertyText' },
});

// Check if the cursor is on a line containing a PropertyName node or a commented property
function getPropertyNameAtCursor(
  view: EditorView,
): { name: string; from: number; to: number } | null {
  const { state } = view;
  const selection = state.selection.main;
  const cursor = selection.head;

  // Get the current line where the cursor is
  const cursorLine = state.doc.lineAt(cursor);

  // Try to find property name in the syntax tree for this line
  let propertyName: { name: string; from: number; to: number } | null = null;
  syntaxTree(state).iterate({
    from: cursorLine.from,
    to: cursorLine.to,
    enter: (node) => {
      // Check if the node is a PropertyName and is on the same line as the cursor
      if (node.type.name === 'PropertyName') {
        propertyName = {
          name: state.doc.sliceString(node.from, node.to).trim(),
          from: node.from,
          to: node.to,
        };
        return false; // Stop iteration once found
      }
      return true;
    },
  });

  // If not found in syntax tree, check if we're on a commented line
  if (!propertyName) {
    const lineText = cursorLine.text.trim();

    if (lineText.startsWith('//')) {
      // Try to extract property name from the comment
      // Match any text followed by a colon, capturing the text
      const match = lineText.match(/\/\/\s*([a-zA-Z-]+):/);
      if (match && match[1]) {
        const name = match[1].trim();
        // Create propertyName since we're on the line containing this property
        const nameStart = cursorLine.from + lineText.indexOf(name);
        const nameEnd = nameStart + name.length;
        propertyName = {
          name,
          from: nameStart,
          to: nameEnd,
        };
      }
    }
  }

  return propertyName;
}

// Find all occurrences of a property name in the document
function findMatchingPropertyLines(view: EditorView, propertyName: string): number[] {
  const matches: number[] = [];
  const { state } = view;

  // Get the current line number to exclude it
  const currentLine = state.doc.lineAt(state.selection.main.head);

  // Find all PropertyName nodes in the syntax tree
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.type.name === 'PropertyName') {
        const name = state.doc.sliceString(node.from, node.to).trim();
        if (name === propertyName) {
          // Get the line for this property
          const line = state.doc.lineAt(node.from);
          // Only add if it's not the current line
          if (line.number !== currentLine.number) {
            matches.push(line.from);
          }
        }
      }
    },
  });

  // Also search for property in commented lines (not found by parser)
  for (let i = 1; i <= state.doc.lines; i++) {
    // Skip the current line
    if (i === currentLine.number) continue;

    const line = state.doc.line(i);
    const lineText = line.text.trim();

    // Check if it's a comment containing our property
    if (lineText.startsWith('//') && lineText.includes(propertyName + ':')) {
      // Only add if not already added (avoid duplicates)
      if (!matches.includes(line.from)) {
        matches.push(line.from);
      }
    }
  }

  // Sort matches by line position to ensure RangeSet is created correctly
  return matches.sort((a, b) => a - b);
}

// Create the decorations for matching properties
function createPropertyDecorations(view: EditorView): DecorationSet {
  const property = getPropertyNameAtCursor(view);
  const decorations: Array<{ from: number; to: number; value: Decoration }> = [];
  const matchingLines = property ? findMatchingPropertyLines(view, property.name) : [];

  // Single pass through the syntax tree to handle both default and matching properties
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.type.name === 'PropertyName') {
        const name = view.state.doc.sliceString(node.from, node.to).trim();

        // Add line background highlight if this is a matching property
        if (property && name === property.name) {
          const line = view.state.doc.lineAt(node.from);
          decorations.push(propertyHighlight.range(line.from));
          decorations.push(propertyTextHighlight.range(node.from, node.to));
        } else {
          // Apply default green highlight to non-matching properties
          decorations.push(defaultPropertyHighlight.range(node.from, node.to));
        }
      }
    },
  });

  // Add line background highlights for commented lines (without text highlighting)
  if (property) {
    for (const lineStart of matchingLines) {
      const line = view.state.doc.lineAt(lineStart);
      const lineText = line.text.trim();
      if (lineText.startsWith('//')) {
        decorations.push(propertyHighlight.range(lineStart));
      }
    }
  }

  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

// Create the plugin that manages property highlighting
const propertyHighlighterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = createPropertyDecorations(view);
    }

    update(update: { view: EditorView; selectionSet: boolean }): void {
      // Only recalculate decorations when selection changes
      if (update.selectionSet) {
        this.decorations = createPropertyDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

// Export the combined extension
export function propertyHighlighter(): Extension[] {
  return [propertyHighlightTheme, propertyHighlighterPlugin];
}
