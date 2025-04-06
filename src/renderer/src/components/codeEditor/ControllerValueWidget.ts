import { syntaxTree } from '@codemirror/language'
import {
    Decoration,
    EditorView,
    ViewPlugin,
    WidgetType,
    type DecorationSet,
    type Range
} from '@codemirror/view'
import type { ControllerSetting } from 'src/renderer/src/types'
import { settings } from '../../stores/settings.svelte'

class ControllerValueWidget extends WidgetType {
  constructor(
    readonly value: number,
    readonly varName: string,
    readonly step: number,
    readonly initialX: number | null = null
  ) {
    super()
  }

  eq(other: ControllerValueWidget): boolean {
    return other.value === this.value && other.varName === this.varName
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-controller-value'
    wrap.textContent = `[${this.value}]`
    wrap.setAttribute('data-var', this.varName)
    wrap.setAttribute('data-step', this.step.toString())
    wrap.style.cursor = 'ew-resize'
    return wrap
  }

  ignoreEvent(): boolean {
    return false
  }
}

function createControllerDecorations(
  view: EditorView,
  controllerSettings: ControllerSetting[]
): DecorationSet {
  const widgets: Range<Decoration>[] = []

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.type.name === 'VariableName') {
          const varName = view.state.doc.sliceString(node.from, node.to)
          if (varName.startsWith('$')) {
            const setting = controllerSettings.find((s) => s.var === varName.substring(1))
            if (setting) {
              widgets.push(
                Decoration.widget({
                  widget: new ControllerValueWidget(setting.value, setting.var, setting.step),
                  side: 1
                }).range(node.to)
              )
            }
          }
        }
      }
    })
  }

  return Decoration.set(widgets)
}

interface UpdateInfo {
  docChanged?: boolean
  viewportChanged?: boolean
  view: EditorView
}

class ControllerValuePluginClass {
  decorations: DecorationSet
  dragging: boolean = false
  startX: number | null = null
  currentVar: string | null = null
  startValue: number | null = null
  controllerSettings: ControllerSetting[]

  constructor(view: EditorView, settings: ControllerSetting[]) {
    this.controllerSettings = settings
    this.decorations = createControllerDecorations(view, settings)
  }

  update(update: UpdateInfo): void {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = createControllerDecorations(update.view, this.controllerSettings)
    }
  }
}

export const controllerValuePlugin = {
  init: (controllerSettings: ControllerSetting[]) =>
    ViewPlugin.fromClass(
      class extends ControllerValuePluginClass {
        constructor(view: EditorView) {
          super(view, controllerSettings)
        }
      },
      {
        decorations: (v) => v.decorations,

        eventHandlers: {
          mousedown(e: MouseEvent): boolean {
            const target = e.target as HTMLElement
            if (target.classList.contains('cm-controller-value')) {
              const varName = target.getAttribute('data-var')
              if (!varName) return false

              const plugin = this as unknown as ControllerValuePluginClass
              const setting = plugin.controllerSettings.find((s) => s.var === varName)
              if (!setting) return false

              plugin.dragging = true
              plugin.startX = e.clientX
              plugin.currentVar = varName
              plugin.startValue = setting.value

              e.preventDefault()
              return true
            }
            return false
          },

          mousemove(e: MouseEvent, view: EditorView): void {
            const plugin = this as unknown as ControllerValuePluginClass
            if (!plugin.dragging || !plugin.currentVar || plugin.startX === null || plugin.startValue === null) return

            const dx = e.clientX - plugin.startX
            const sensitivity = 0.01
            const setting = plugin.controllerSettings.find((s) => s.var === plugin.currentVar)
            if (!setting) return

            const delta = dx * sensitivity * setting.step
            const newValue = Number.parseFloat((plugin.startValue + delta).toFixed(2))
            settings.updateControllerValue(plugin.currentVar, newValue)

            // Force redraw of decorations
            plugin.decorations = createControllerDecorations(view, plugin.controllerSettings)
          },

          mouseup(): void {
            const plugin = this as unknown as ControllerValuePluginClass
            if (!plugin.dragging) return
            plugin.dragging = false
            plugin.startX = null
            plugin.currentVar = null
            plugin.startValue = null
          }
        }
      }
    )
}
