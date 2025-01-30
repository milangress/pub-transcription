<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { EditorView, keymap } from "@codemirror/view";
    import { EditorState } from "@codemirror/state";
    import { defaultKeymap, toggleComment } from "@codemirror/commands";
    import { css } from "@codemirror/lang-css";
    import { html } from "@codemirror/lang-html";
    import { basicSetup } from "codemirror";

    export let value = "";
    export let language = "css";
    
    const dispatch = createEventDispatcher();
    let element;
    let view;

    $: if (view && value !== view.state.doc.toString()) {
        view.dispatch({
            changes: {
                from: 0,
                to: view.state.doc.length,
                insert: value
            }
        });
    }

    onMount(() => {
        const languageSupport = language === 'css' ? css() : html();
        
        const state = EditorState.create({
            doc: value,
            extensions: [
                basicSetup,
                languageSupport,
                keymap.of([
                    ...defaultKeymap,
                    { key: "Mod-/", run: toggleComment },
                    { key: "Shift-Alt-a", run: toggleComment }
                ]),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        value = update.state.doc.toString();
                        dispatch('change', value);
                    }
                })
            ]
        });

        view = new EditorView({
            state,
            parent: element
        });

        return () => {
            view.destroy();
        };
    });
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
</style> 