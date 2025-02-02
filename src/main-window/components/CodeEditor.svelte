<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { EditorView, keymap, WidgetType, ViewPlugin, Decoration } from "@codemirror/view";
    import { EditorState } from "@codemirror/state";
    import { defaultKeymap, toggleComment, toggleLineComment } from "@codemirror/commands";
    import { sass, sassLanguage } from "@codemirror/lang-sass";
    import { html } from "@codemirror/lang-html";
    import { basicSetup } from "codemirror";
    import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
    import { closeBrackets } from "@codemirror/autocomplete";
    import { syntaxTree } from "@codemirror/language";
    import { linter, lintGutter } from "@codemirror/lint";

    export let value = "";
    export let language = "css";
    export let controllerSettings = [];
    export let svgFiltersCode = "";
    export let fontFamilys = [];
    const dispatch = createEventDispatcher();
    let element;
    let view;
    let filterIds = [];
    let isUpdatingFromPreview = false;

    function extractFilterIds(svgCode) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgCode, 'text/html');
        const filters = doc.querySelectorAll('filter[id]');
        return Array.from(filters).map(filter => filter.id);
    }

    $: if (svgFiltersCode) {
        filterIds = extractFilterIds(svgFiltersCode);
        console.log('Available filters:', filterIds);
    }

    function createCompletions(context) {
        // Check for font-family completion
        let before = context.matchBefore(/font-family:\s*[^;]*/)
        if (before) {
            let word = context.matchBefore(/[^:\s;]*$/)
            if (!word && !context.explicit) return null

            const options = fontFamilys.map(font => ({
                label: font.name,
                type: 'class',
                boost: 1
            }));

            return {
                from: word.from,
                options,
                validFor: /^[^;]*$/
            }
        }

        // Check for MIDI variable completion
        let varWord = context.matchBefore(/\$\w*/)
        if (varWord && !(varWord.from == varWord.to && !context.explicit)) {
            return {
                from: varWord.from,
                validFor: /^\$\w*$/,
                options: controllerSettings.map(setting => ({
                    label: '$' + setting.var,
                    type: 'variable',
                    detail: `Current value: ${setting.value}`,
                    boost: 1
                }))
            }
        }

        // Check for filter completion
        let filterWord = context.matchBefore(/url\(#[^)]*/)
        if (filterWord && !(filterWord.from == filterWord.to && !context.explicit)) {
            console.log('Filter completion triggered');
            const hashIndex = filterWord.text.lastIndexOf('#');
            
            // Find if there's a closing parenthesis and semicolon after the cursor
            const afterCursor = context.state.doc.sliceString(filterWord.to, filterWord.to + 10);
            const hasClosing = afterCursor.match(/^\s*\);/);
            
            return {
                from: filterWord.from + (hashIndex >= 0 ? hashIndex + 1 : filterWord.text.length),
                validFor: /^[a-zA-Z0-9-]*$/,
                options: filterIds.map(id => ({
                    label: id,
                    type: 'filter',
                    detail: 'SVG Filter',
                    info: () => {
                        const el = document.createElement('div');
                        el.style.filter = `url(#${id})`;
                        el.style.padding = '5px';
                        el.textContent = 'Preview';
                        return el;
                    },
                    apply: (view, completion, from, to) => {
                        const insert = hasClosing ? completion.label : `${completion.label});`;
                        view.dispatch({
                            changes: {
                                from,
                                to: hasClosing ? to : to,
                                insert
                            }
                        });
                    }
                }))
            }
        }

        // Let the default completions handle everything else
        return null;
    }

    $: if (view && value !== view.state.doc.toString() && !isUpdatingFromPreview) {
        view.dispatch({
            changes: {
                from: 0,
                to: view.state.doc.length,
                insert: value
            }
        });
    }

    // Remove all decoration-related code and keep only the linter
    const duplicatePropertiesLinter = linter(view => {
        try {
            const diagnostics = [];
            const properties = new Map();
            let currentRule = null;
            
            syntaxTree(view.state).iterate({
                enter: (node) => {
                    if (node?.type?.name === "RuleSet") {
                        currentRule = node;
                    }
                    
                    if (node?.type?.name === "PropertyName") {
                        const property = view.state.doc.sliceString(node.from, node.to).trim();
                        if (!property) return;
                        
                        const line = view.state.doc.lineAt(node.from);
                        if (line.text.trim().startsWith('//')) return;
                        
                        const ruleKey = currentRule ? currentRule.from : 'global';
                        if (!properties.has(ruleKey)) {
                            properties.set(ruleKey, new Map());
                        }
                        
                        const ruleProperties = properties.get(ruleKey);
                        if (!ruleProperties.has(property)) {
                            ruleProperties.set(property, [{ node, line }]);
                        } else {
                            const existing = ruleProperties.get(property);
                            existing.push({ node, line });
                            console.log(`Found duplicate '${property}' on line ${line.number} (first used on line ${existing[0].line.number})`);
                            
                            // Create diagnostic immediately for this duplicate
                            diagnostics.push({
                                from: node.from,
                                to: node.to,
                                severity: "warning",
                                message: `Duplicate '${property}' (-> ${existing[0].line.number})`,
                                actions: [{
                                    name: "// Comment",
                                    apply(view, from, to) {
                                        const lineStart = line.from + line.text.match(/^\s*/)[0].length;
                                        view.dispatch({
                                            changes: { from: lineStart, insert: "// " }
                                        });
                                    }
                                }]
                            });
                        }
                    }
                },
                leave: (node) => {
                    if (node === currentRule) currentRule = null;
                }
            });

            return diagnostics;
        } catch (err) {
            console.error("Error in linter:", err);
            return [];
        }
    });


    // Helper to transform SASS values
    function transformSassValue(str, settings) {
        if (!settings || !Array.isArray(settings) || settings.length === 0) return null;
        
        const values = [];
        let foundAny = false;
        
        // Find all $variables in the string
        const regex = /\$(\w+)(?:\s*\*\s*([\d.]+)([a-z%]+)?)?/g;
        let match;
        
        while ((match = regex.exec(str)) !== null) {
            const [_, varName, number, unit] = match;
            const setting = settings.find(s => s.var === varName);
            
            if (setting) {
                foundAny = true;
                if (number) {
                    const result = setting.value * parseFloat(number);
                    values.push(unit ? result + unit : result);
                } else {
                    values.push(setting.value);
                }
            }
        }
        
        return foundAny ? values.join(', ') : null;
    }

    class ValueWidget extends WidgetType {
        constructor(value) {
            super();
            this.value = value;
        }

        eq(other) {
            return other.value === this.value;
        }

        toDOM() {
            const span = document.createElement("span");
            span.className = "cm-sass-value";
            span.style.cssText = `
                display: inline-block;
                color: #888;
                pointer-events: none;
                user-select: none;
                white-space: pre;
                padding-left: 1ch;
            `;
            span.textContent = `→ ${this.value}`;
            return span;
        }

        ignoreEvent() { return true; }
    }

    function createValueDecorations(view) {
        const widgets = [];
        const settings = controllerSettings;

        for (let {from, to} of view.visibleRanges) {
            syntaxTree(view.state).iterate({
                from, to,
                enter: (node) => {
                    if (node.type.name === "Declaration") {
                        const line = view.state.doc.lineAt(node.from);
                        const lineContent = line.text;
                        
                        if (lineContent.includes('$') && !lineContent.trim().startsWith('//')) {
                            const value = transformSassValue(lineContent, settings);
                            if (value !== null) {
                                widgets.push(Decoration.widget({
                                    widget: new ValueWidget(value),
                                    side: 1
                                }).range(line.to));
                            }
                        }
                    }
                }
            });
        }
        return Decoration.set(widgets);
    }

    const EditorTheme = EditorView.theme({
        '.ͼk': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            // outline: '1px solid lightblue',
            // borderRadius: '0.2em',
            // padding: '0em 0.2em'
        }
    });

    const sassValuePlugin = ViewPlugin.fromClass(class {
        decorations;

        constructor(view) {
            this.decorations = createValueDecorations(view);
        }

        update(update) {
            this.decorations = createValueDecorations(update.view);
        }
    }, {
        decorations: v => v.decorations
    });

    // Add reactive statement to force plugin update when settings change
    $: if (view && controllerSettings) {
        view.dispatch(view.state.update());
    }

    onMount(() => {
        const languageSupport = language === 'css' ? sass() : html();
        
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
                    { key: "Mod-/", run: toggleLineComment },
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