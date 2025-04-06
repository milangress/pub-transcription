import { syntaxTree } from '@codemirror/language'
import { StateEffect, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type PluginValue,
  type ViewUpdate,
} from '@codemirror/view'
import type { ControllerSetting } from 'src/renderer/src/types'

// Global variable to store the current settings
let currentSettings: ControllerSetting[] = []

// Define an effect to update controller settings
export const updateControllerSettingsEffect = StateEffect.define()

// Widget to display computed values at the end of lines
class CompiledValueWidget extends WidgetType {
  value: string
  constructor(value) {
    super()
    this.value = value
  }

  eq(other: CompiledValueWidget): boolean {
    return other.value === this.value
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-compiled-value'
    span.style.cssText = `
      display: inline-block;
      color: #888;
      pointer-events: none;
      user-select: none;
      white-space: pre;
      padding-left: 1ch;
    `
    span.textContent = `→ ${this.value}`
    return span
  }

  ignoreEvent(): boolean {
    return true
  }
}

// Helper to compute value from a binary expression node
function computeBinaryExpression(
  view: EditorView,
  node,
  settings: ControllerSetting[]
): string | null {
  if (!settings || !Array.isArray(settings) || settings.length === 0) return null

  let varName: string | null = null
  let operator: string | null = null
  let number: number | null = null
  let unit: string | null = null

  console.log('computing binary expression', node)

  // We need to find the children of this binary expression
  // We'll use syntaxTree.iterate for this specific node
  syntaxTree(view.state).iterate({
    enter: (childNode) => {
      // Only process direct children of our node
      if (childNode.from >= node.from && childNode.to <= node.to && childNode !== node) {
        const childName = childNode.type.name
        const childText = view.state.doc.sliceString(childNode.from, childNode.to)
        console.log('childNode', childName, childText)
        if (childName === 'SassVariableName') {
          varName = childText.substring(1) // Remove the $ prefix
        } else if (childName === 'BinOp') {
          operator = childText.trim()
        } else if (childName === 'NumberLiteral') {
          // Extract the number and unit if present
          const match = childText.match(/^([\d.]+)([a-z%]*)$/)
          if (match) {
            number = parseFloat(match[1])
            unit = match[2] || ''
          } else {
            number = parseFloat(childText)
            unit = ''
          }
        }
      }
      // Continue iteration for all nodes
      return true
    },
    from: node.from,
    to: node.to
  })

  // Find the setting for this variable
  const setting = settings.find((s) => s.var === varName)
  if (!setting) return null

  if (!number || !operator || !varName) {
    console.error('missing number, operator, or varName', number, operator, varName)
    return null
  }
  console.log('Var', varName, setting.value, operator, number)
  // Compute the result based on the operator
  let result
  switch (operator) {
    case '+':
      result = setting.value + number
      break
    case '-':
      result = setting.value - number
      break
    case '*':
      result = setting.value * number
      break
    case '/':
      result = setting.value / number
      break
    default:
      return null
  }

  // Return the formatted result with the unit if present
  return unit ? `${result}${unit}` : result.toString()
}

// Theme for styling the compiled values
const compiledValueTheme = EditorView.theme({
  '.cm-compiled-value': {
    opacity: 0.7
  }
})

// Simple function to update controller settings
export function updateControllerValues(view, settings): void {
  currentSettings = settings

  if (view) {
    console.log('Updating with settings:', settings)
    // Force an editor update to refresh decorations
    view.dispatch({})
  }
}

// Extension for displaying compiled controller values
export function compiledControllerValues(initialSettings: ControllerSetting[] = []): Extension {
  // Initialize global settings
  currentSettings = initialSettings

  // Create the view plugin
  const plugin = ViewPlugin.fromClass(
    class implements PluginValue {
      decos: DecorationSet

      constructor() {
        this.decos = Decoration.none
      }

      update(update: ViewUpdate): void {
        const processedLines = new Set()
        // Process visible lines for performance
        for (const { from, to } of update.view.visibleRanges) {
          syntaxTree(update.view.state).iterate({
            from,
            to,
            enter: (node) => {
              // Skip if not a binary expression with a SASS variable
              if (node.type.name !== 'BinaryExpression') return

              // Find the line containing this expression
              const line = update.view.state.doc.lineAt(node.from)

              // Skip if we've already processed this line
              if (processedLines.has(line.number)) return

              // Compute the value of this expression
              const value = computeBinaryExpression(update.view, node, currentSettings)
              console.log('value', value)
              if (value !== null) {
                processedLines.add(line.number)
                const widget = new CompiledValueWidget(value)
                const decorationWidget = Decoration.widget({
                  widget,
                  side: 1
                })
                this.decos = Decoration.set(decorationWidget.range(line.to))
                console.log('decos', this.decos)
              }
            }
          })
        }
      }
    },
    {
      decorations: (v) => v.decos
    }
  )

  return [compiledValueTheme, plugin]
}
