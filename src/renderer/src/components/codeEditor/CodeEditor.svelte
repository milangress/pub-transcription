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
  import { lintGutter } from '@codemirror/lint'
  import { EditorState } from '@codemirror/state'
  import {
      EditorView,
      keymap
  } from '@codemirror/view'
  import { basicSetup } from 'codemirror'
  import type { ControllerSetting, FontFamily } from 'src/renderer/src/types'
  import { onMount } from 'svelte'
  import { settings } from '../../stores/settings.svelte.js'
  import { compiledControllerValues, updateControllerValues } from './ControllerValuesExtension'
  import { propertyHighlighter } from './PropertyHighlighter'

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

  function vizualizeParserTreeLinebreaks(tree: string): string {
    // NOTE: Just a hacky way to make the parser tree more readable
    return tree
      .replace(/LineComment/g, 'LineComment\n  ')
      .replace(/\"{"/g, '"{"\n  ')
      .replace(/\";"/g, '";"\n  ')
      .replace(/\"}"/g, '\n"}"')
  }

  $effect(() => {
    if (view) {
      syntaxTreeVizRepresentation = vizualizeParserTreeLinebreaks(syntaxTree(view.state).toString())
    }
  })

  // Add reactive statement to force plugin update when settings change
  $effect(() => {
    if (view && controllerSettings) {
      // console.log('controllerSettings', $state.snapshot(controllerSettings))
      updateControllerValues(view, $state.snapshot(controllerSettings))
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
        compiledControllerValues(controllerSettings),
        propertyHighlighter(),
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
  :global(.ͼ2 .cm-activeLine) {
    background-color: oklch(0.96 0.25 111.39 / 0.73);
  }
</style>
