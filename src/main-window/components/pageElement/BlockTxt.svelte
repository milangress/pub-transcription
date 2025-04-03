<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { BlockTxtSettings, ControllerSetting } from '../../types';
    import { checkPosition } from './checkPosition.js';

    const dispatch = createEventDispatcher<{
        overflow: void;
    }>();

    export let content: string = "Hello World";
    export let isCurrent: boolean = false;
    export let settings: BlockTxtSettings = {
        inlineStyle: '',
        controllerSettings: []
    };

    function transformSassToCSS(str: string | undefined, controllerSettings: ControllerSetting[]): string {
        if (!str) return '';
        const cssStr = str.toString();
        
        // Remove SASS structure (selector and braces)
        let result = cssStr.replace(/\..*{\n/gm, '')
            .replace(/^}$/gm, '')
            // Remove comments
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//gm, '');

        if (controllerSettings && Array.isArray(controllerSettings) && controllerSettings.length > 0) {
            controllerSettings.forEach(setting => {
                // Replace $variable * number[unit] pattern
                const varPattern = new RegExp('\\$' + setting.var + '\\s*\\*\\s*([\\d.]+)([a-z%]+)?', 'g')
                result = result.replace(varPattern, (_match, number, unit) => {
                    const value = setting.value * parseFloat(number)
                    return unit ? value + unit : value.toString()
                })

                // Replace plain $variable pattern
                const plainVarPattern = new RegExp('\\$' + setting.var + '\\b', 'g')
                result = result.replace(plainVarPattern, setting.value.toString())
            })
        }

        return result.trim()
    }

    $: isCurrentClass = isCurrent ? 'current' : ''
    $: compiledStyle = transformSassToCSS(settings?.inlineStyle, settings?.controllerSettings)
</script>

<span
    class="{isCurrentClass}"
    style="{compiledStyle}"
    use:checkPosition={!isCurrent ? {
        onOverflow: () => dispatch('overflow')
    } : null}
>
    {content}&nbsp;<wbr>
</span>

<style>
    span {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        filter: blur(0);
        -webkit-filter: blur(0);
    }
    .current {
        color: blue;
    }
</style>
