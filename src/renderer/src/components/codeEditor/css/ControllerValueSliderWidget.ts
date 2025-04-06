import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import {
    Decoration,
    EditorView,
    ViewPlugin,
    WidgetType,
    type DecorationSet,
    type ViewUpdate
} from '@codemirror/view'
import type { ControllerSetting } from 'src/renderer/src/types'

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
    valueDisplay.textContent = `${this.setting.value}`

    // Add draggable handle
    const handle = document.createElement('span')
    handle.className = 'cm-controller-handle'
    handle.title = `Drag to adjust value (${this.setting.range[0]}-${this.setting.range[1]})`

    // Assemble the widget
    container.appendChild(valueDisplay)
    container.appendChild(handle)

    return container
  }

  // Allow handling events from within the widget
  ignoreEvent(): boolean {
    return false
  }
}

// Effect to update a controller setting value
export const updateControllerValueEffect = StateEffect.define<{
  name: string
  value: number
}>()

// Find controller variables and create widget decorations
function controllerSliders(view: EditorView, settings: ControllerSetting[]): DecorationSet {
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
          const setting = settings.find((s) => s.var === varName)

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
export const controllerSliderPlugin = (settings: ControllerSetting[] = []): Extension => {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      dragging: boolean = false
      draggedSetting: ControllerSetting | null = null
      startX: number = 0
      startValue: number = 0

      constructor(readonly view: EditorView) {
        this.decorations = controllerSliders(view, settings)
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.startState.field(controllerSliderState) !==
            update.state.field(controllerSliderState)
        ) {
          const currentSettings = update.state.field(controllerSliderState)
          this.decorations = controllerSliders(update.view, currentSettings)
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

          // Find the node at this position
          const node = syntaxTree(view.state).resolveInner(pos)

          if (node.type.name !== 'SassVariableName') {
            return false
          }

          // Extract variable name
          const varName = view.state.doc.sliceString(node.from, node.to).substring(1)

          // Find setting for this variable
          const settings = view.state.field(controllerSliderState)
          const setting = settings.find((s) => s.var === varName)

          if (!setting) {
            return false
          }

          // Start dragging
          this.dragging = true
          this.draggedSetting = setting
          this.startX = e.clientX
          this.startValue = setting.value

          // Set up drag event listeners
          const onMouseMove = (e: MouseEvent): void => {
            if (!this.dragging || !this.draggedSetting) return

            // Calculate drag distance
            const deltaX = e.clientX - this.startX

            // Update value based on drag
            const newValue = updateValueFromDrag(this.startValue, deltaX, this.draggedSetting)

            // Dispatch state effect to update value
            view.dispatch({
              effects: updateControllerValueEffect.of({
                name: this.draggedSetting.name,
                value: newValue
              })
            })
          }

          const onMouseUp = (): void => {
            // Clean up
            this.dragging = false
            this.draggedSetting = null
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

// State field to track controller settings
export const controllerSliderState = StateField.define<ControllerSetting[]>({
  create: () => [],

  update: (settings, tr) => {
    // Handle updates from effects
    for (const e of tr.effects) {
      if (e.is(updateControllerValueEffect)) {
        const { name, value } = e.value
        // Create a new array with the updated setting
        return settings.map((s) => (s.name === name ? { ...s, value } : s))
      }
    }
    return settings
  },

  // Provide decorations to the editor
  provide: (field) => {
    return EditorView.decorations.of((view) => {
      return controllerSliders(view, view.state.field(field))
    })
  }
})

// Styles for the widget
const sliderWidgetTheme = EditorView.theme({
  '.cm-controller-slider': {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '0.5em',
    cursor: 'ew-resize',
    borderRadius: '3px',
    padding: '0 4px'
  },
  '.cm-controller-value': {
    fontSize: '0.8em',
    padding: '0 4px',
    color: '#008800',
    fontWeight: 'bold'
  },
  '.cm-controller-handle': {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#008800',
    marginLeft: '2px'
  },
  '.cm-controller-slider:hover': {
    backgroundColor: 'rgba(0, 136, 0, 0.1)'
  }
})

// Main extension factory function
export function controllerValueSliders(settings: ControllerSetting[] = []): Extension[] {
  return [
    controllerSliderState.init(() => settings),
    controllerSliderPlugin(settings),
    sliderWidgetTheme
  ]
}
