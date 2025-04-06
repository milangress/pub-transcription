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
import { settings } from '../../../stores/settings.svelte.js'

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
    valueDisplay.textContent = `${this.setting.value.toFixed(1)}`

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
  const controllerSettings = settings.controllerSettings

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
          const setting = controllerSettings.find((s) => s.var === varName)

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
  // Calculate how much to change value based on pixel movement
  // Use step and range to scale appropriately
  const [min, max] = setting.range
  const range = max - min

  // Scale the drag movement - each 100px = full range by default
  // Adjust sensitivity with step - smaller steps = more precision needed
  const dragScale = (range / 100) * (setting.step || 1)
  const newValue = initialValue + dragPixels * dragScale

  // Clamp to range and round to nearest step
  const step = setting.step || 1
  const steppedValue = Math.round(newValue / step) * step
  return Math.max(min, Math.min(max, steppedValue))
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
        if (update.docChanged || update.viewportChanged) {
          this.decorations = controllerSliders(update.view)
        }
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
          const setting = settings.controllerSettings.find((s) => s.var === varName)

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
            const setting = settings.controllerSettings.find((s) => s.var === this.draggedVarName)
            if (!setting) return

            // Update value based on drag
            const newValue = updateValueFromDrag(this.startValue, deltaX, setting)

            // Update value in the store
            settings.updateControllerValue(this.draggedVarName, newValue)

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
    marginLeft: '0',
    cursor: 'ew-resize',
    borderRadius: '0.1em',
    padding: '0.1em 0.3em',
    userSelect: 'none',
    transition: 'scale 0.05s ease-in-out',
  },
  '.cm-controller-value': {
    fontSize: '0.7em',
    color: 'oklab(0.7 0.32 -0.12);',
    fontWeight: 'bold',
    userSelect: 'none',
    pointerEvents: 'none'
  },
  '.cm-controller-slider:hover': {
    backgroundColor: 'oklch(0.95 0.24 107.73 / 0.9)'
  },
  '.cm-controller-slider-dragging': {
    scale: 1.5,
    backgroundColor: 'oklch(0.95 0.24 107.73 / 0.9)'
  }
})

// Main extension factory function
export function controllerValueSliders(): Extension[] {
  return [controllerSliderPlugin(), sliderWidgetTheme]
}
