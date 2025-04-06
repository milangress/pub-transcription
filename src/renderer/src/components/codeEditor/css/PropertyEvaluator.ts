import { lineUncomment, toggleLineComment } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { type Extension, type StateCommand, EditorSelection } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

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
 * Find all commented lines in a block
 */
function findCommentedLines(
  state: EditorView['state'],
  startLine: number,
  endLine: number
): number[] {
  const commentedLines: number[] = []

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum)
    if (line.text.trim().startsWith('//')) {
      commentedLines.push(lineNum)
    }
  }

  return commentedLines
}

/**
 * Extract all distinct property names from a block
 */
function extractBlockProperties(
  state: EditorView['state'],
  startLine: number,
  endLine: number
): string[] {
  const properties = new Set<string>()

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum)

    // Skip commented lines
    if (line.text.trim().startsWith('//')) {
      // Extract property name from comment
      const match = line.text.trim().match(/\/\/\s*([a-zA-Z-]+):/)
      if (match && match[1]) {
        properties.add(match[1].trim())
      }
      continue
    }

    // Extract property from syntax tree
    syntaxTree(state).iterate({
      from: line.from,
      to: line.to,
      enter: (node) => {
        if (node.type.name === 'PropertyName') {
          const name = state.doc.sliceString(node.from, node.to).trim()
          properties.add(name)
        }
        return true
      }
    })
  }

  return Array.from(properties)
}

/**
 * Find all occurrences of a property in a specific range of lines
 */
function findPropertyLinesInRange(
  state: EditorView['state'],
  propertyName: string,
  startLine: number,
  endLine: number
): number[] {
  const lines: number[] = []

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = state.doc.line(lineNum)

    // Skip commented lines
    if (line.text.trim().startsWith('//')) {
      // If commented, check if it contains our property
      if (line.text.trim().includes(propertyName + ':')) {
        lines.push(lineNum)
      }
      continue
    }

    // Check active lines
    let found = false
    syntaxTree(state).iterate({
      from: line.from,
      to: line.to,
      enter: (node) => {
        if (node.type.name === 'PropertyName') {
          const name = state.doc.sliceString(node.from, node.to).trim()
          if (name === propertyName) {
            found = true
            return false
          }
        }
        return true
      }
    })

    if (found) {
      lines.push(lineNum)
    }
  }

  return lines
}

/**
 * Command function that evaluates properties in the current CSS block
 */
const evaluateProperties: StateCommand = ({ state, dispatch }) => {
  // Find the current CSS block
  const block = findBlockLines(state)
  if (!block) return false

  // Find any commented lines in the block
  const commentedLines = findCommentedLines(state, block.startLine, block.endLine)

  console.log(`Block spans lines ${block.startLine} to ${block.endLine}`)
  console.log(`Found ${commentedLines.length} commented lines in block`)

  // Step 1: First uncomment all commented lines in the block
  if (commentedLines.length > 0 && dispatch) {
    // Create a selection for all commented lines
    const commentRanges = commentedLines.map((lineNum) => {
      const line = state.doc.line(lineNum)
      return EditorSelection.range(line.from, line.from)
    })

    // Apply lineUncomment to all commented lines
    const commentSelection = EditorSelection.create(commentRanges)
    const tr = state.update({ selection: commentSelection })
    dispatch(tr)
    lineUncomment({ state: tr.state, dispatch })

    // Now we need to wait for this transaction to complete before continuing
    setTimeout(() => {
      applyBlockEvaluation(block)
    }, 50)

    return true
  } else {
    // No commented lines, proceed directly
    return applyBlockEvaluation(block)
  }

  // Helper function to apply the rest of the evaluation
  function applyBlockEvaluation(block: { startLine: number; endLine: number }): boolean {
    // Get the updated editor state
    const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)
    if (!view || !dispatch) return false

    const updatedState = view.state

    // Step 2: Extract all distinct property names from the block
    const allProperties = extractBlockProperties(updatedState, block.startLine, block.endLine)
    console.log(
      `Found ${allProperties.length} distinct properties in block: ${allProperties.join(', ')}`
    )

    // Step 3: For each property, comment out all occurrences outside the block
    const outsideLinesToComment: number[] = []

    allProperties.forEach((propName) => {
      // Find occurrences outside the block (before the block)
      if (block.startLine > 1) {
        const beforeLines = findPropertyLinesInRange(updatedState, propName, 1, block.startLine - 1)
        outsideLinesToComment.push(...beforeLines)
      }

      // Find occurrences outside the block (after the block)
      if (block.endLine < updatedState.doc.lines) {
        const afterLines = findPropertyLinesInRange(
          updatedState,
          propName,
          block.endLine + 1,
          updatedState.doc.lines
        )
        outsideLinesToComment.push(...afterLines)
      }
    })

    // Comment out all properties outside the block
    if (outsideLinesToComment.length > 0) {
      console.log(`Commenting out ${outsideLinesToComment.length} properties outside block`)

      const outsideRanges = outsideLinesToComment.map((lineNum) => {
        const line = updatedState.doc.line(lineNum)
        return EditorSelection.range(line.from, line.from)
      })

      const outsideSelection = EditorSelection.create(outsideRanges)
      const trOutside = updatedState.update({ selection: outsideSelection })
      view.dispatch(trOutside)
      toggleLineComment({ state: trOutside.state, dispatch: view.dispatch })

      // Wait for this to complete before doing the next step
      setTimeout(() => {
        handleBlockProperties(block, allProperties)
      }, 50)

      return true
    } else {
      // No outside properties to comment, proceed with block properties
      return handleBlockProperties(block, allProperties)
    }
  }

  // Helper function to handle properties within the block
  function handleBlockProperties(
    block: { startLine: number; endLine: number },
    properties: string[]
  ): boolean {
    const view = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)
    if (!view || !dispatch) return false

    const updatedState = view.state

    // Step 4: For each property in the block, ensure only the last instance is active
    let anyProcessed = false

    properties.forEach((propName) => {
      // Find all instances of this property in the block
      const propLines = findPropertyLinesInRange(
        updatedState,
        propName,
        block.startLine,
        block.endLine
      )

      if (propLines.length > 1) {
        // Keep only the last occurrence active
        const linesToComment = propLines.slice(0, propLines.length - 1)
        console.log(
          `For property '${propName}', commenting out ${linesToComment.length} of ${propLines.length} occurrences`
        )

        const propRanges = linesToComment.map((lineNum) => {
          const line = updatedState.doc.line(lineNum)
          return EditorSelection.range(line.from, line.from)
        })

        const propSelection = EditorSelection.create(propRanges)
        const trProp = updatedState.update({ selection: propSelection })
        view.dispatch(trProp)
        toggleLineComment({ state: trProp.state, dispatch: view.dispatch })

        anyProcessed = true
      }
    })

    return anyProcessed
  }
}

/**
 * Creates the property evaluator extension
 */
export function propertyEvaluator(): Extension {
  return keymap.of([{ key: 'Alt-Enter', run: evaluateProperties }])
}
