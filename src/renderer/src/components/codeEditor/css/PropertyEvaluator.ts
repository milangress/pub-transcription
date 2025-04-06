import { lineUncomment, toggleLineComment } from '@codemirror/commands';
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

  // If no property found, check if we're on a commented line
  if (!propertyName) {
    const lineText = cursorLine.text.trim()
    if (lineText.startsWith('//')) {
      // Try to extract property name from the comment
      const match = lineText.match(/\/\/\s*([a-zA-Z-]+):/)
      if (match && match[1]) {
        const name = match[1].trim()
        propertyName = {
          name,
          from: cursorLine.from,
          to: cursorLine.from + name.length,
          line: cursorLine.number
        }
      }
    }
  }

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

  console.log(`Found block from ${startLine} to ${endLine}`)
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
): { active: number[]; commented: number[] } {
  const active: number[] = []
  const commented: number[] = []

  // Iterate through all lines in the block
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum)
    const lineText = line.text.trim()

    // First check if it's a commented line with our property
    if (lineText.startsWith('//') && lineText.includes(propertyName + ':')) {
      commented.push(lineNum)
      continue
    }

    // Use syntax tree to find active property name nodes
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
      active.push(lineNum)
    }
  }

  return { active, commented }
}

/**
 * Command function that evaluates and comments out duplicate properties
 */
const evaluateProperties: StateCommand = ({ state, dispatch }) => {
  // Find the property at the cursor
  const property = getPropertyAtCursor(state)
  if (!property) return false

  // Find the CSS block
  const block = findBlockLines(state)
  if (!block) return false

  // Get all lines with the same property (both active and commented)
  const { active, commented } = findPropertyLinesInBlock(
    state,
    property.name,
    block.startLine,
    block.endLine
  )

  console.log(`Evaluating property: ${property.name}`)
  console.log(`Found ${active.length} active occurrences at lines: ${active.join(', ')}`)
  console.log(`Found ${commented.length} commented occurrences at lines: ${commented.join(', ')}`)

  // Set up our transactions as a two-step process

  // Step 1: If there are any commented lines, uncomment them
  if (commented.length > 0) {
    const commentedRanges = commented.map((lineNum) => {
      const line = state.doc.line(lineNum)
      return EditorSelection.range(line.from, line.from)
    })

    if (dispatch) {
      // Set the selection to all commented lines
      const commentedSelection = EditorSelection.create(commentedRanges)
      const tr1 = state.update({ selection: commentedSelection })
      dispatch(tr1)

      // Uncomment these lines
      lineUncomment({ state: tr1.state, dispatch })

      // We need to wait for this transaction to be applied before proceeding
      // In a real app, you might want to use a more robust approach
      setTimeout(() => {
        // Now let's get the updated state and proceed with step 2
        const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)
        if (view) {
          const updatedState = view.state

          // Since we uncommented all properties, now handle them as if they're all active
          const allLines = findPropertyLinesInBlock(
            updatedState,
            property.name,
            block.startLine,
            block.endLine
          ).active

          // Keep only the last property active
          const linesToComment = allLines.slice(0, allLines.length - 1)

          // Create selection ranges for lines to comment
          const ranges = linesToComment.map((lineNum) => {
            const line = updatedState.doc.line(lineNum)
            return EditorSelection.range(line.from, line.from)
          })

          // Comment these lines
          if (ranges.length > 0) {
            const tempSelection = EditorSelection.create(ranges)
            const tr2 = updatedState.update({ selection: tempSelection })
            view.dispatch(tr2)
            toggleLineComment({ state: tr2.state, dispatch: view.dispatch })
          }
        }
      }, 50) // small delay to ensure the first transaction is applied
    }

    return true
  }

  // If no commented lines, just handle active lines
  if (active.length <= 1) return false

  // Only comment out all but the last property
  const linesToComment = active.slice(0, active.length - 1)

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
