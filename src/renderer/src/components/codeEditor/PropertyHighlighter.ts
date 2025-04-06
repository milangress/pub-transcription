import { syntaxTree } from '@codemirror/language'
import { type Extension } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin } from '@codemirror/view'

// Create a base theme for the property highlights
const propertyHighlightTheme = EditorView.baseTheme({
  '&light .cm-propertyHighlight': { backgroundColor: 'rgba(0, 119, 255, 0.15)' },
  '&dark .cm-propertyHighlight': { backgroundColor: 'rgba(0, 119, 255, 0.25)' }
})

// Decoration for highlighting the entire line
const propertyHighlight = Decoration.line({
  attributes: { class: 'cm-propertyHighlight' }
})

// Check if the cursor is on a PropertyName node
function getPropertyNameAtCursor(
  view: EditorView
): { name: string; from: number; to: number } | null {
  const { state } = view
  const selection = state.selection.main
  const cursor = selection.head

  // Get the syntax node at cursor position
  let propertyName: { name: string; from: number; to: number } | null = null
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.type.name === 'PropertyName' && node.from <= cursor && node.to >= cursor) {
        propertyName = {
          name: state.doc.sliceString(node.from, node.to).trim(),
          from: node.from,
          to: node.to
        }
        return false // Stop iteration once found
      }
    }
  })

  return propertyName
}

// Find all occurrences of a property name in the document
function findMatchingPropertyLines(view: EditorView, propertyName: string): number[] {
  const matches: number[] = []
  const { state } = view

  // Find all PropertyName nodes in the syntax tree
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.type.name === 'PropertyName') {
        const name = state.doc.sliceString(node.from, node.to).trim()
        if (name === propertyName) {
          // Get the line for this property
          const line = state.doc.lineAt(node.from)
          matches.push(line.from)
        }
      }
    }
  })

  // Also search for property in commented lines (not found by parser)
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    const lineText = line.text.trim()
    
    // Check if it's a comment containing our property
    if (lineText.startsWith('//') && lineText.includes(propertyName + ':')) {
      // Only add if not already added (avoid duplicates)
      if (!matches.includes(line.from)) {
        matches.push(line.from)
      }
    }
  }

  // Sort matches by line position to ensure RangeSet is created correctly
  return matches.sort((a, b) => a - b)
}

// Create the decorations for matching properties
function createPropertyDecorations(view: EditorView): DecorationSet {
  const property = getPropertyNameAtCursor(view)
  
  if (!property) {
    return Decoration.none
  }
  
  const matchingLines = findMatchingPropertyLines(view, property.name)
  const decorations = matchingLines.map((lineStart) => propertyHighlight.range(lineStart))
  
  return Decoration.set(decorations)
}

// Create the plugin that manages property highlighting
const propertyHighlighterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    
    constructor(view: EditorView) {
      this.decorations = createPropertyDecorations(view)
    }
    
    update(update: { view: EditorView; selectionSet: boolean }): void {
      // Only recalculate decorations when selection changes
      if (update.selectionSet) {
        this.decorations = createPropertyDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
)

// Export the combined extension
export function propertyHighlighter(): Extension[] {
  return [propertyHighlightTheme, propertyHighlighterPlugin]
}
