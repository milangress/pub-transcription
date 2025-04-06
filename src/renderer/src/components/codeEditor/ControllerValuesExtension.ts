/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// ^ This disables TypeScript checking for this file

import { syntaxTree } from '@codemirror/language'
import { StateEffect } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'

// Global variable to store the current settings
let currentSettings = []

// Define an effect to update controller settings
export const updateControllerSettingsEffect = StateEffect.define()

// Widget to display computed values at the end of lines
class CompiledValueWidget extends WidgetType {
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

// Helper to compute SASS expressions with controller values
function computeSassExpression(str: string, settings: ControllerSetting[]): string | null {
  if (!settings || !Array.isArray(settings) || settings.length === 0) return null

  const values = []
  let foundAny = false

  // Find all $variables in the string
  const regex = /\$(\w+)(?:\s*\*\s*([\d.]+)([a-z%]+)?)?/g
  let match

  while ((match = regex.exec(str)) !== null) {
    const [, varName, multiplier, unit] = match
    const setting = settings.find((s) => s.var === varName)

    if (setting) {
      foundAny = true
      if (multiplier) {
        const result = setting.value * parseFloat(multiplier)
        values.push(unit ? result + unit : result.toString())
      } else {
        values.push(setting.value.toString())
      }
    }
  }

  return foundAny ? values.join(', ') : null
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
export function compiledControllerValues(initialSettings = []) : Extension {
  // Initialize global settings
  currentSettings = initialSettings

  // Create the view plugin
  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.createDecorations(view)
      }

      update(update): void {
        // Always recreate on any update
        this.decorations = this.createDecorations(update.view)
      }

      createDecorations(view): DecorationSet {
        const decorations = []

        // Process visible lines for performance
        for (const { from, to } of view.visibleRanges) {
          syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node) => {
              if (node.type.name === 'Declaration') {
                const line = view.state.doc.lineAt(node.from)
                const lineContent = line.text

                // Check for $ variables
                if (lineContent.includes('$') && !lineContent.trim().startsWith('//')) {
                  const value = computeSassExpression(lineContent, currentSettings)

                  if (value !== null) {
                    const widget = new CompiledValueWidget(value)
                    decorations.push(
                      Decoration.widget({
                        widget,
                        side: 1
                      }).range(line.to)
                    )
                  }
                }
              }
            }
          })
        }

        return Decoration.set(decorations)
      }
    },
    {
      decorations: (v) => v.decorations
    }
  )

  return [compiledValueTheme, plugin]
}
