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
      type DecorationSet
  } from '@codemirror/view'
  import { basicSetup } from 'codemirror'
  import type { ControllerSetting, FontFamily } from 'src/renderer/src/types'
  import { onMount } from 'svelte'
  import { settings } from '../../stores/settings.svelte.js'
  import { controllerValuePlugin } from './ControllerValueWidget'

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

  // Create mark decorations for SASS variables
  function createValueDecorations(view: EditorView): DecorationSet {
    const decorations: any[] = []
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
              const regex = /\$(\w+)(?:\s*\*\s*([\d.]+)([a-z%]+)?)?/g
              let match

              while ((match = regex.exec(lineContent)) !== null) {
                const [fullMatch, varName] = match
                const setting = settings.find((s) => s.var === varName)
                
                if (setting) {
                  const start = line.from + match.index
                  const end = start + fullMatch.length
                  const value = transformSassValue(fullMatch, [setting])

                  // Create a mark decoration for the variable
                  decorations.push(
                    Decoration.mark({
                      class: 'cm-sass-variable',
                      attributes: {
                        'data-var': varName,
                        'data-value': value || '',
                        'data-step': setting.step.toString(),
                        'title': `${varName} = ${value}`
                      }
                    }).range(start, end)
                  )

                  // Add the computed value as a separate mark
                  if (value) {
                    decorations.push(
                      Decoration.mark({
                        class: 'cm-sass-value'
                      }).range(end, end + 1)
                    )
                  }
                }
              }
            }
          }
        }
      })
    }

    return Decoration.set(decorations, true)
  }

  const EditorTheme = EditorView.theme({
    '.ͼk': {
      backgroundColor: 'rgba(0, 0, 0, 0.1)'
    },
    '.cm-sass-variable': {
      color: '#0077cc',
      cursor: 'ew-resize',
      borderBottom: '2px solid #0077cc',
      position: 'relative'
    },
    '.cm-sass-variable:hover::after': {
      content: 'attr(data-value)',
      position: 'absolute',
      bottom: '-24px',
      left: '0',
      backgroundColor: '#333',
      color: 'white',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      zIndex: '100'
    },
    '.cm-sass-value': {
      color: '#666',
      fontStyle: 'italic'
    }
  })

  // Create a ViewPlugin to handle variable dragging
  const sassVariablePlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      dragging: boolean
      currentVar: string | null
      startX: number
      lastValue: number
      
      constructor(view: EditorView) {
        this.decorations = createValueDecorations(view)
        this.dragging = false
        this.currentVar = null
        this.startX = 0
        this.lastValue = 0
        
        // Add mouse event listeners
        view.dom.addEventListener('mousedown', this.handleMouseDown.bind(this))
        window.addEventListener('mousemove', this.handleMouseMove.bind(this))
        window.addEventListener('mouseup', this.handleMouseUp.bind(this))
      }
      
      update(update: any) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = createValueDecorations(update.view)
        }
      }
      
      handleMouseDown(event: MouseEvent) {
        if (!event.altKey) return
        
        const target = event.target as HTMLElement
        if (target.classList.contains('cm-sass-variable')) {
          this.dragging = true
          this.currentVar = target.getAttribute('data-var')
          this.startX = event.clientX
          
          const setting = controllerSettings.find(s => s.var === this.currentVar)
          if (setting) {
            this.lastValue = setting.value
          }
          
          event.preventDefault()
        }
      }
      
      handleMouseMove(event: MouseEvent) {
        if (!this.dragging || !this.currentVar) return
        
        const setting = controllerSettings.find(s => s.var === this.currentVar)
        if (!setting) return
        
        const dx = event.clientX - this.startX
        const sensitivity = 0.01
        const delta = dx * sensitivity * setting.step
        
        const newValue = Number.parseFloat((this.lastValue + delta).toFixed(2))
        settings.updateControllerValue(this.currentVar, newValue)
      }
      
      handleMouseUp() {
        this.dragging = false
        this.currentVar = null
      }
      
      destroy() {
        window.removeEventListener('mousemove', this.handleMouseMove)
        window.removeEventListener('mouseup', this.handleMouseUp)
      }
    },
    {
      decorations: v => v.decorations
    }
  )

  // Add reactive statement to force plugin update when settings change
  $effect(() => {
    if (view && controllerSettings) {
      view.dispatch(view.state.update())
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
        controllerValuePlugin.init(controllerSettings),
        sassVariablePlugin,
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
          }
        })
      ]
    })

    view = new EditorView({
      state,
      parent: element
    })

    return () => {
      if (view) {
        view.destroy()
      }
    }
  })
</script>

<div bind:this={element} class="editor-wrapper"></div>

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

  :global(.cm-sass-variable) {
    cursor: ew-resize;
  }

  :global(.cm-controller-value) {
    display: inline-block;
    color: #666;
    margin-left: 0.5em;
    font-style: italic;
    cursor: ew-resize;
    user-select: none;
  }

  :global(.cm-controller-value:hover) {
    color: #0077cc;
  }
</style>
