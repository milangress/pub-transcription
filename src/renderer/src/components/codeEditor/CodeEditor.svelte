<script lang="ts">
  import { closeBrackets, completionKeymap } from '@codemirror/autocomplete';
  import { defaultKeymap, toggleComment, toggleLineComment } from '@codemirror/commands';
  import { html } from '@codemirror/lang-html';
  import { sass, sassLanguage } from '@codemirror/lang-sass';
  import { syntaxTree } from '@codemirror/language';
  import { lintGutter } from '@codemirror/lint';
  import { EditorState, Prec } from '@codemirror/state';
  import { EditorView, keymap } from '@codemirror/view';
  import { basicSetup } from 'codemirror';
  import type { ControllerSetting, FontFamily } from 'src/renderer/src/types';
  import { onMount } from 'svelte';
  import { settings } from '../../stores/settings.svelte.js';
  import { createAIExtension } from './AIExtension';
  import { createCompletionSource, updateCompletionOptions } from './css/Completions.js';
  import {
    controllerValueSliders,
    updateControllerSliderValues,
  } from './css/ControllerValueSliderWidget.js';
  import {
    compiledControllerValues,
    updateControllerValues,
  } from './css/ControllerValuesLineAnnotation.js';
  import { livecodingKeymap } from './css/LivecodingKeymapExtra.js';
  import { propertyEvaluator } from './css/PropertyEvaluator.js';
  import { propertyHighlighter } from './css/PropertyHighlighter.js';

  let {
    value = $bindable(''),
    language = 'css',
    controllerSettings = [],
    fontFamilys = [],
    onChange = () => {},
    pureStyle = false,
  } = $props<{
    value: string;
    language: 'css' | 'html';
    controllerSettings: ControllerSetting[];
    fontFamilys?: FontFamily[];
    onChange?: (value: string) => void;
    pureStyle?: boolean;
  }>();

  let element = $state<HTMLDivElement | undefined>();
  let view = $state<EditorView | undefined>();
  let isUpdatingFromPreview = $state(false);
  let syntaxTreeVizRepresentation = $state('');

  console.log('My fontFamilys', fontFamilys);

  $effect(() => {
    if (view && value !== view.state.doc.toString() && !isUpdatingFromPreview) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    }
  });

  function vizualizeParserTreeLinebreaks(tree: string): string {
    // NOTE: Just a hacky way to make the parser tree more readable
    return tree
      .replace(/LineComment/g, 'LineComment\n  ')
      .replace(/"{"/g, '"{"\n  ')
      .replace(/";"/g, '";"\n  ')
      .replace(/"}"/g, '\n"}"');
  }

  $effect(() => {
    if (view) {
      syntaxTreeVizRepresentation = vizualizeParserTreeLinebreaks(
        syntaxTree(view.state).toString(),
      );
    }
  });

  // Update all extensions when settings change
  $effect(() => {
    if (view && controllerSettings && language === 'css') {
      const currentSettings = $state.snapshot(controllerSettings);
      // Update controller values extension
      updateControllerValues(currentSettings);
      updateControllerSliderValues(view, currentSettings);
      // Update completions with latest settings
      updateCompletionOptions({
        fontFamilies: fontFamilys,
        controllerSettings: currentSettings,
        filterIds: $state.snapshot(settings.filterIds),
      });
    }
  });

  onMount(() => {
    if (!element) return;

    const languageSupport = language === 'css' ? sass() : html();
    const completionOptions = {
      fontFamilies: fontFamilys,
      controllerSettings,
      filterIds: settings.filterIds,
    };

    // Base extensions that apply to both HTML and CSS
    const baseExtensions = [
      basicSetup,
      languageSupport,
      closeBrackets(),
      lintGutter(),
      createAIExtension(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          value = update.state.doc.toString();
          onChange(value);
          syntaxTreeVizRepresentation = vizualizeParserTreeLinebreaks(
            syntaxTree(update.state).toString(),
          );
        }
      }),
    ];

    // CSS-specific extensions
    const cssExtensions =
      language === 'css'
        ? [
            compiledControllerValues(controllerSettings),
            controllerValueSliders(),
            propertyHighlighter(),
            propertyEvaluator(),
            sassLanguage.data.of({
              autocomplete: createCompletionSource(completionOptions),
            }),
            keymap.of([
              ...defaultKeymap,
              ...completionKeymap,
              ...livecodingKeymap,
              { key: 'Mod-/', run: toggleLineComment },
              { key: 'Shift-Alt-a', run: toggleComment },
            ]),
            Prec.highest(keymap.of(livecodingKeymap)),
          ]
        : [
            // HTML-specific keymaps without CSS-specific extensions
            keymap.of([
              ...defaultKeymap,
              ...completionKeymap,
              { key: 'Mod-/', run: toggleLineComment },
              { key: 'Shift-Alt-a', run: toggleComment },
            ]),
          ];

    const state = EditorState.create({
      doc: value,
      extensions: [...baseExtensions, ...cssExtensions],
    });

    view = new EditorView({
      state,
      parent: element,
    });
  });
</script>

<div bind:this={element} class="editor-wrapper"></div>
{#if !pureStyle}
  <details class="parser-tree">
    <summary>Parser Tree</summary>
    <pre>{syntaxTreeVizRepresentation}</pre>
  </details>
{/if}

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
