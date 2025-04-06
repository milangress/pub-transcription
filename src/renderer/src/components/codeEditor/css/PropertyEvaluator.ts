import { toggleLineComment } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { type Extension, type StateCommand, EditorSelection } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

/**
 * Gets the CSS property at the current cursor position
 */
function getPropertyAtCursor(
  state: EditorView['state']
): { name: string; from: number; to: number; line: number } | null {
  const selection = state.selection.main
  const cursor = selection.head

  // Get the current line where the cursor is
  const cursorLine = state.doc.lineAt(cursor)

  // Try to find property name in the syntax tree for this line
  let propertyName: { name: string; from: number; to: number; line: number } | null = null

  syntaxTree(state).iterate({
    from: cursorLine.from,
    to: cursorLine.to,
    enter: (node) => {
      if (node.type.name === 'PropertyName') {
        propertyName = {
          name: state.doc.sliceString(node.from, node.to).trim(),
          from: node.from,
          to: node.to,
          line: cursorLine.number
        }
        return false // Stop iteration once found
      }
      return true
    }
  })

  return propertyName
}

/**
 * Find all lines containing the CSS block (start from the cursor position)
 */
function findBlockLines(state: EditorView['state']): { startLine: number; endLine: number } | null {
  const selection = state.selection.main
  const cursor = selection.head

  // Get the current line
  const cursorLine = state.doc.lineAt(cursor)

  // Find the block start (look for non-empty lines going up)
  let startLine = cursorLine.number
  while (startLine > 1) {
    const line = state.doc.line(startLine - 1)
    const trimmed = line.text.trim()

    // Stop if we find an empty line or a line that doesn't look like CSS property (no braces yet)
    if (trimmed === '' || trimmed === '}' || trimmed === '{') {
      break
    }

    startLine--
  }

  // Find the block end (look for non-empty lines going down)
  let endLine = cursorLine.number
  while (endLine < state.doc.lines) {
    const line = state.doc.line(endLine + 1)
    const trimmed = line.text.trim()

    // Stop if we find an empty line or closing brace
    if (trimmed === '' || trimmed === '}') {
      break
    }

    endLine++
  }

  return { startLine, endLine }
}

/**
 * Find all occurrences of a given property within a block
 */
function findPropertyLinesInBlock(
  state: EditorView['state'],
  propertyName: string,
  startLine: number,
  endLine: number
): number[] {
  const lines: number[] = []

  // Iterate through all lines in the block
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum)

    // Use syntax tree to find property name nodes
    let foundProperty = false
    syntaxTree(state).iterate({
      from: line.from,
      to: line.to,
      enter: (node) => {
        if (node.type.name === 'PropertyName') {
          const name = state.doc.sliceString(node.from, node.to).trim()
          if (name === propertyName) {
            foundProperty = true
            return false // Stop iteration for this line
          }
        }
        return true
      }
    })

    if (foundProperty) {
      lines.push(lineNum)
    }
  }

  return lines
}

/**
 * Command function that evaluates and comments out duplicate properties
 */
const evaluateProperties: StateCommand = ({ state, dispatch }) => {
  const property = getPropertyAtCursor(state)
  if (!property) return false

  // Find the CSS block
  const block = findBlockLines(state)
  if (!block) return false

  // Get all lines with the same property
  const propertyLines = findPropertyLinesInBlock(
    state,
    property.name,
    block.startLine,
    block.endLine
  )
  if (propertyLines.length <= 1) return false

  console.log(`Evaluating property: ${property.name}`)
  console.log(`Found ${propertyLines.length} occurrences at lines: ${propertyLines.join(', ')}`)

  // Only comment out all but the last property
  const linesToComment = propertyLines.slice(0, propertyLines.length - 1)

  // Create proper selection ranges for each line we want to comment
  const ranges = linesToComment.map((lineNum) => {
    const line = state.doc.line(lineNum)
    return EditorSelection.range(line.from, line.from)
  })

  // Create a transaction that applies comments to these ranges
  if (ranges.length > 0) {
    // Set a temporary selection that includes all the lines we want to comment
    const tempSelection = EditorSelection.create(ranges)

    // Apply the toggleLineComment command
    if (dispatch) {
      // Update the selection
      const tr = state.update({
        selection: tempSelection
      })
      dispatch(tr)

      // Apply toggle line comment on the selected lines
      toggleLineComment({ state: tr.state, dispatch })
    }

    return true
  }

  return false
}

/**
 * Creates the property evaluator extension
 */
export function propertyEvaluator(): Extension {
  return keymap.of([{ key: 'Alt-Enter', run: evaluateProperties }])
}
