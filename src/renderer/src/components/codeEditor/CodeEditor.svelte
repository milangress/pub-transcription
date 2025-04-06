<script lang="ts">
  import {
      autocompletion,
      closeBrackets,
      completionKeymap,
      type Completion
  } from '@codemirror/autocomplete'
  import { defaultKeymap, toggleComment, toggleLineComment } from '@codemirror/commands'
  import { html } from '@codemirror/lang-html'
  import { sass, sassLanguage } from '@codemirror/lang-sass'
  import { syntaxTree } from '@codemirror/language'
  import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
  import { EditorState } from '@codemirror/state'
  import {
      Decoration,
      EditorView,
      keymap,
      ViewPlugin,
      WidgetType,
      type DecorationSet
  } from '@codemirror/view'
  import { basicSetup } from 'codemirror'
  import type { ControllerSetting, FontFamily } from 'src/renderer/src/types'
  import { onMount } from 'svelte'
  import { settings } from '../../stores/settings.svelte.js'

  let {
    value = $bindable(''),
    language = 'css',
    controllerSettings = [],
    fontFamilys = [],
    onChange = (_value: string) => {}
  } = $props<{
    value?: string
    language?: 'css' | 'html'
    controllerSettings?: ControllerSetting[]
    fontFamilys?: FontFamily[]
    onChange?: (value: string) => void
  }>()

  let element = $state<HTMLDivElement | undefined>()
  let view = $state<EditorView | undefined>()
  let isUpdatingFromPreview = $state(false)
  let syntaxTreeVizRepresentation = $state('')

  function createCompletions(context: any) {
    // Check for font-family completion
    let before = context.matchBefore(/font-family:\s*[^;]*/)
    if (before) {
      let word = context.matchBefore(/[^:\s;]*$/)
      if (!word && !context.explicit) return null

      const options: Completion[] = fontFamilys.map((font) => ({
        label: font.name,
        type: 'class',
        boost: 1
      }))

      return {
        from: word?.from ?? before.from,
        options,
        validFor: /^[^;]*$/
      }
    }

    // Check for MIDI variable completion
    let varWord = context.matchBefore(/\$\w*/)
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

    // Check for filter completion
    let filterWord = context.matchBefore(/url\(#[^)]*/)
    if (
      filterWord &&
      filterWord.from !== null &&
      !(filterWord.from === filterWord.to && !context.explicit)
    ) {
      console.log('Filter completion triggered')
      const hashIndex = filterWord.text.lastIndexOf('#')

      // Find if there's a closing parenthesis and semicolon after the cursor
      const afterCursor = context.state.doc.sliceString(filterWord.to, filterWord.to + 10)
      const hasClosing = afterCursor.match(/^\s*\);/)

      return {
        from: filterWord.from + (hashIndex >= 0 ? hashIndex + 1 : filterWord.text.length),
        validFor: /^[a-zA-Z0-9-]*$/,
        options: settings.filterIds.map((id) => ({
          label: id,
          type: 'filter',
          detail: 'SVG Filter',
          info: () => {
            const el = document.createElement('div')
            el.style.filter = `url(#${id})`
            el.style.padding = '5px'
            el.textContent = 'Preview'
            return el
          },
          apply: (view: EditorView, completion: Completion, from: number, to: number) => {
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

  $effect(() => {
    if (view && value !== view.state.doc.toString() && !isUpdatingFromPreview) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value
        }
      })
    }
  })

  // Remove all decoration-related code and keep only the linter
  const duplicatePropertiesLinter = linter((view) => {
    try {
      const diagnostics: Diagnostic[] = []
      const properties = new Map<string, Map<string, Array<{ node: any; line: any }>>>()
      let currentRule: any = null

      syntaxTree(view.state).iterate({
        enter: (node: any) => {
          if (node?.type?.name === 'RuleSet') {
            currentRule = node
          }

          if (node?.type?.name === 'PropertyName') {
            const property = view.state.doc.sliceString(node.from, node.to).trim()
            if (!property) return

            const line = view.state.doc.lineAt(node.from)
            if (!line || line.text.trim().startsWith('//')) return

            const ruleKey = currentRule ? currentRule.from : 'global'
            if (!properties.has(ruleKey)) {
              properties.set(ruleKey, new Map())
            }

            const ruleProperties = properties.get(ruleKey)!
            if (!ruleProperties.has(property)) {
              ruleProperties.set(property, [{ node, line }])
            } else {
              const existing = ruleProperties.get(property)!
              existing.push({ node, line })
              console.log(
                `Found duplicate '${property}' on line ${line.number} (first used on line ${existing[0].line.number})`
              )

              // Create diagnostic immediately for this duplicate
              diagnostics.push({
                from: node.from,
                to: node.to,
                severity: 'warning',
                message: `Duplicate '${property}' (-> ${existing[0].line.number})`,
                actions: [
                  {
                    name: '// Comment',
                    apply(view: EditorView, _from: number, _to: number) {
                      const match = line.text.match(/^\s*/)
                      const indentLength = match ? match[0].length : 0
                      const lineStart = line.from + indentLength
                      view.dispatch({
                        changes: { from: lineStart, insert: '// ' }
                      })
                    }
                  }
                ]
              })
            }
          }
        },
        leave: (node: any) => {
          if (node?.type?.name === 'RuleSet') {
            currentRule = null
          }
        }
      })

      return diagnostics
    } catch (error) {
      console.error('Error in linter:', error)
      return []
    }
  })

  // Helper to transform SASS values
  function transformSassValue(str: string, settings: ControllerSetting[]): string | null {
    if (!settings || !Array.isArray(settings) || settings.length === 0) return null

    const values: string[] = []
    let foundAny = false

    // Find all $variables in the string
    const regex = /\$(\w+)(?:\s*\*\s*([\d.]+)([a-z%]+)?)?/g
    let match

    while ((match = regex.exec(str)) !== null) {
      const [_, varName, number, unit] = match
      const setting = settings.find((s) => s.var === varName)

      if (setting) {
        foundAny = true
        if (number) {
          const result = setting.value * parseFloat(number)
          values.push(unit ? result + unit : result.toString())
        } else {
          values.push(setting.value.toString())
        }
      }
    }

    return foundAny ? values.join(', ') : null
  }

  class ValueWidget extends WidgetType {
    value: string

    constructor(value: string) {
      super()
      this.value = value
    }

    eq(other: ValueWidget): boolean {
      return other.value === this.value
    }

    toDOM(): HTMLElement {
      const span = document.createElement('span')
      span.className = 'cm-sass-value'
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

  function createValueDecorations(view: EditorView): DecorationSet {
    const widgets: any[] = []
    const settings = controllerSettings

    for (let { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node) => {
          if (node.type.name === 'Declaration') {
            const line = view.state.doc.lineAt(node.from)
            const lineContent = line.text

            if (lineContent.includes('$') && !lineContent.trim().startsWith('//')) {
              const value = transformSassValue(lineContent, settings)
              if (value !== null) {
                widgets.push(
                  Decoration.widget({
                    widget: new ValueWidget(value),
                    side: 1
                  }).range(line.to)
                )
              }
            }
          }
        }
      })
    }
    return Decoration.set(widgets)
  }

  const EditorTheme = EditorView.theme({
    '.ͼk': {
      backgroundColor: 'rgba(0, 0, 0, 0.1)'
    }
  })

  const sassValuePlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = createValueDecorations(view)
      }

      update(update: { view: EditorView }) {
        this.decorations = createValueDecorations(update.view)
      }
    },
    {
      decorations: (v) => v.decorations
    }
  )

  // Add reactive statement to force plugin update when settings change
  $effect(() => {
    if (view && controllerSettings) {
      view.dispatch(view.state.update())
    }
  })

  function vizualizeParserTreeLinebreaks(tree: string): string {
    // NOTE: Just a hacky way to make the parser tree more readable
    return tree
      .replace(/\"{"/g, '"{"\n  ')
      .replace(/\";"/g, '";"\n  ')
      .replace(/\"}"/g, '\n"}"')
  }

  $effect(() => {
    if (view) {
      syntaxTreeVizRepresentation = vizualizeParserTreeLinebreaks(syntaxTree(view.state).toString())
    }
  })

  onMount(() => {
    if (!element) return

    const languageSupport = language === 'css' ? sass() : html()

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageSupport,
        closeBrackets(),
        autocompletion(),
        lintGutter(),
        EditorTheme,
        duplicatePropertiesLinter,
        sassValuePlugin,
        sassLanguage.data.of({
          autocomplete: createCompletions
        }),
        keymap.of([
          ...defaultKeymap,
          ...completionKeymap,
          { key: 'Mod-/', run: toggleLineComment },
          { key: 'Shift-Alt-a', run: toggleComment }
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            value = update.state.doc.toString()
            onChange(value)
            syntaxTreeVizRepresentation = vizualizeParserTreeLinebreaks(syntaxTree(update.state).toString())
          }
        })
      ]
    })

    view = new EditorView({
      state,
      parent: element
    })
  })
</script>

<div bind:this={element} class="editor-wrapper"></div>
<details class="parser-tree">
  <summary>Parser Tree</summary>
  <pre>{syntaxTreeVizRepresentation}</pre>
</details>

<style>
  .editor-wrapper {
    height: 100%;
    width: 100%;
  }

  .editor-wrapper :global(.cm-editor) {
    height: 100%;
  }

  .editor-wrapper :global(.cm-scroller) {
    overflow: auto;
  }

  .parser-tree {
    margin-top: 1rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 4px;
  }

  .parser-tree pre {
    margin: 0.5rem 0;
    white-space: pre;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 0.9em;
    overflow-x: auto;
    tab-size: 2;
    line-height: 1.4;
    padding: 0.5rem;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 3px;
  }
</style>
