import {
    autocompletion,
    type Completion,
    type CompletionContext,
    type CompletionResult
} from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { ControllerSetting, FontFamily } from 'src/renderer/src/types'

interface CompletionOptions {
  fontFamilies: FontFamily[]
  controllerSettings: ControllerSetting[]
  filterIds: string[]
}

/**
 * Creates a completion source function for CodeMirror
 * Provides completions for:
 * - font-family values
 * - MIDI controller variables ($var)
 * - SVG filter IDs for url(#filter)
 */
export function createCompletionSource(options: CompletionOptions) {
  const { fontFamilies, controllerSettings, filterIds } = options

  return (context: CompletionContext): CompletionResult | null => {
    // Font-family completion
    const before = context.matchBefore(/font-family:\s*[^;]*/)
    if (before) {
      const word = context.matchBefore(/[^:\s;]*$/)
      if (!word && !context.explicit) return null

      const fontOptions: Completion[] = fontFamilies.map((font) => ({
        label: font.name,
        type: 'class',
        boost: 1
      }))

      return {
        from: word?.from ?? before.from,
        options: fontOptions,
        validFor: /^[^;]*$/
      }
    }

    // MIDI variable completion
    const varWord = context.matchBefore(/\$\w*/)
    if (varWord && varWord.from !== null && !(varWord.from === varWord.to && !context.explicit)) {
      return {
        from: varWord.from,
        validFor: /^\$\w*$/,
        options: controllerSettings.map((setting) => ({
          label: '$' + setting.var,
          type: 'variable',
          detail: `Current value: ${setting.value}`,
          boost: 1
        }))
      }
    }

    // SVG filter completion
    const filterWord = context.matchBefore(/url\(#[^)]*/)
    if (
      filterWord &&
      filterWord.from !== null &&
      !(filterWord.from === filterWord.to && !context.explicit)
    ) {
      const hashIndex = filterWord.text.lastIndexOf('#')

      // Find if there's a closing parenthesis and semicolon after the cursor
      const afterCursor = context.state.doc.sliceString(filterWord.to, filterWord.to + 10)
      const hasClosing = afterCursor.match(/^\s*\);/)

      return {
        from: filterWord.from + (hashIndex >= 0 ? hashIndex + 1 : filterWord.text.length),
        validFor: /^[a-zA-Z0-9-]*$/,
        options: filterIds.map((id) => ({
          label: id,
          type: 'filter',
          detail: 'SVG Filter',
          info: (): HTMLElement => {
            const el = document.createElement('div')
            el.style.filter = `url(#${id})`
            el.style.padding = '5px'
            el.textContent = 'Preview'
            return el
          },
          apply: (view: EditorView, completion: Completion, from: number, to: number): void => {
            const insert = hasClosing ? completion.label : `${completion.label});`
            view.dispatch({
              changes: {
                from,
                to: hasClosing ? to : to,
                insert
              }
            })
          }
        }))
      }
    }

    // Let the default completions handle everything else
    return null
  }
}

/**
 * Creates the completion extension for CodeMirror
 */
export function createCompletionExtension(options: CompletionOptions): Extension {
  return autocompletion({
    override: [createCompletionSource(options)]
  })
}
