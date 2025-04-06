<script lang="ts">
  import {
      closeBrackets,
      completionKeymap
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
  import { createCompletionSource } from './css/Completions.js'
  import { compiledControllerValues, updateControllerValues } from './css/ControllerValuesExtension.js'
  import { controllerValueSliders, updateControllerSliderValues } from './css/ControllerValueSliderWidget.js'
  import { propertyEvaluator } from './css/PropertyEvaluator.js'
  import { propertyHighlighter } from './css/PropertyHighlighter.js'

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
      updateControllerSliderValues(view, $state.snapshot(controllerSettings))
    }
  })

  onMount(() => {
    if (!element) return

    const languageSupport = language === 'css' ? sass() : html()
    const completionOptions = {
      fontFamilies: fontFamilys,
      controllerSettings,
      filterIds: settings.filterIds
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageSupport,
        closeBrackets(),
        lintGutter(),
        compiledControllerValues(controllerSettings),
        controllerValueSliders(),
        propertyHighlighter(),
        propertyEvaluator(),
        sassLanguage.data.of({
          autocomplete: createCompletionSource(completionOptions)
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
