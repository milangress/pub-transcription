import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import {
    Decoration,
    EditorView,
    ViewPlugin,
    WidgetType,
    type DecorationSet,
    type ViewUpdate
} from '@codemirror/view'
import type { ControllerSetting } from 'src/renderer/src/types'
import { settings as SettingsStore } from '../../../stores/settings.svelte.js'
// Global variable to store the current settings
let currentSettings: ControllerSetting[] = []

// Widget for displaying and controlling values via dragging
class ControllerSliderWidget extends WidgetType {
  constructor(
    readonly setting: ControllerSetting,
    readonly variableName: string
  ) {
    super()
  }

  eq(other: ControllerSliderWidget): boolean {
    return other.setting.value === this.setting.value && other.variableName === this.variableName
  }

  toDOM(): HTMLElement {
    // Create container for the widget
    const container = document.createElement('span')
    container.className = 'cm-controller-slider'

    // Add current value indicator
    const valueDisplay = document.createElement('span')
    valueDisplay.className = 'cm-controller-value'
    valueDisplay.textContent = `${parseFloat(this.setting.value.toFixed(3))}`

    // Assemble the widget
    container.appendChild(valueDisplay)

    return container
  }

  // Allow handling events from within the widget
  ignoreEvent(): boolean {
    return false
  }
}

// Find controller variables and create widget decorations
function controllerSliders(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  // Process only visible ranges for performance
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        // Check if this is a SASS variable name
        if (node.type.name === 'SassVariableName') {
          // Get the variable name without $ prefix
          const varName = view.state.doc.sliceString(node.from, node.to).substring(1)

          // Find corresponding controller setting
          const setting = currentSettings.find((s) => s.var === varName)

          if (setting) {
            // Create widget after the variable
            const deco = Decoration.widget({
              widget: new ControllerSliderWidget(setting, varName),
              side: 1 // Place widget after the variable
            })
            builder.add(node.to, node.to, deco)
          }
        }
      }
    })
  }

  return builder.finish()
}

// Function to apply value changes based on drag amount
function updateValueFromDrag(
  initialValue: number,
  dragPixels: number,
  setting: ControllerSetting
): number {
  const [min, max] = setting.range
  const range = max - min
  
  // Calculate velocity-based scaling factor
  // Higher velocity = more aggressive changes
  const velocity = Math.abs(dragPixels) / 10 // Normalize pixels to a reasonable range
  const velocityScale = Math.pow(velocity + 1, 1.5) / 10 // Non-linear scaling
  
  // Calculate the change amount based on range and velocity
  // For zero or small initial values, we use range as base multiplier
  const baseMultiplier = Math.max(Math.abs(initialValue), range / 100)
  const changeAmount = (dragPixels * velocityScale * baseMultiplier) / 100
  
  // Apply the change
  const newValue = initialValue + changeAmount
  
  // Clamp to range
  return Math.max(min, Math.min(max, newValue))
}

// Simple function to update controller settings
export function updateControllerSliderValues(
  view: EditorView,
  settings: ControllerSetting[]
): void {
  console.log('updateControllerSliderValues', settings)
  currentSettings = settings

  if (view) {
    // Force an editor update to refresh decorations
    view.dispatch({})
  }
}

// ViewPlugin to manage slider widgets and interaction
export const controllerSliderPlugin = (): Extension => {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      dragging: boolean = false
      draggedVarName: string | null = null
      startX: number = 0
      startValue: number = 0
      draggingSpan: HTMLElement | null = null

      constructor(readonly view: EditorView) {
        this.decorations = controllerSliders(view)
      }

      update(update: ViewUpdate): void {
          this.decorations = controllerSliders(update.view)
      }
    },
    {
      decorations: (v) => v.decorations,

      eventHandlers: {
        mousedown(e: MouseEvent, view: EditorView): boolean {
          // Check if click is on a slider widget
          const target = e.target as HTMLElement

          if (!target.closest('.cm-controller-slider')) {
            return false
          }

          // Find the position in the document
          const pos = view.posAtDOM(target)

          // Find the node at this position and try to get the SassVariableName
          const variableNode = syntaxTree(view.state).resolveInner(pos, -1)

          // Extract variable name
          const varName = view.state.doc
            .sliceString(variableNode.from, variableNode.to)
            .substring(1)

          // Find setting for this variable
          const setting = currentSettings.find((s) => s.var === varName)

          if (!setting) {
            return false
          }

          // Start dragging
          this.dragging = true
          this.draggedVarName = varName
          this.startX = e.clientX
          this.startValue = setting.value
          this.draggingSpan = target
          this.draggingSpan.classList.add('cm-controller-slider-dragging')

          // Create overlay to capture mouse events and prevent text selection
          const overlay = document.createElement('div')
          overlay.className = 'cm-drag-overlay'
          overlay.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            z-index: 1000;
            cursor: ew-resize;
          `
          document.body.appendChild(overlay)

          // Set up drag event listeners
          const onMouseMove = (e: MouseEvent): void => {
            if (!this.dragging || !this.draggedVarName) return

            // Calculate drag distance
            const deltaX = e.clientX - this.startX

            // Find current setting
            const setting = currentSettings.find((s) => s.var === this.draggedVarName)
            if (!setting) return

            // Update value based on drag
            const newValue = updateValueFromDrag(this.startValue, deltaX, setting)

            // Update the value using the settings store
            SettingsStore.updateControllerValue(this.draggedVarName, newValue)

            // Force editor to redraw
            view.dispatch({})
          }

          const onMouseUp = (): void => {
            // Clean up
            this.dragging = false
            this.draggedVarName = null
            this.draggingSpan?.classList.remove('cm-controller-slider-dragging')

            // Remove overlay
            document.body.removeChild(overlay)

            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
          }

          // Add global event listeners
          document.addEventListener('mousemove', onMouseMove)
          document.addEventListener('mouseup', onMouseUp)

          // Prevent text selection during drag
          e.preventDefault()
          return true
        }
      }
    }
  )
}

// Styles for the widget
const sliderWidgetTheme = EditorView.theme({
  '.cm-controller-slider': {
    display: 'inline-block',
    marginInline: '0',
    cursor: 'ew-resize',
    borderRadius: '0.1em',
    padding: '0 0.5em',
    userSelect: 'none',
    transition: 'scale 0.05s ease-in-out',
    scale: 0.8,
    backgroundColor: 'lightgray'
  },
  '.cm-controller-value': {
    fontSize: '0.9em',
    marginInline: '0',
    color: 'oklab(0.7 0.32 -0.12);',
    fontWeight: 'bold',
    userSelect: 'none',
    pointerEvents: 'none'
  },
  '.cm-controller-slider:hover': {
    backgroundColor: 'oklch(0.95 0.24 107.73 / 0.9)'
  },
  '.cm-controller-slider-dragging': {

    backgroundColor: 'oklch(0.95 0.24 107.73 / 0.9)'
  }
})

// Main extension factory function
export function controllerValueSliders(): Extension[] {
  return [controllerSliderPlugin(), sliderWidgetTheme]
}
