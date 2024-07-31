<script>
    export let content = "Hello World"
    export let isCurrent = false
    export let settings = {}

    function transformSassToCSS(str, settings) {
        // Remove SASS structure (selector and braces)
        str = str.replace(/\..*{\n/gm, '')
        str = str.replace(/^}$/gm, '')
        // Remove comments
        str = str.replace(/\/\/.*$/gm, '')
        str = str.replace(/\/\*[\s\S]*?\*\//gm, '')

        if (settings && Array.isArray(settings) && settings.length > 0) {
            settings.forEach(setting => {
                // Replace $variable * number[unit] pattern
                const varPattern = new RegExp('\\$' + setting.var + '\\s*\\*\\s*([\\d.]+)([a-z%]+)?', 'g')
                str = str.replace(varPattern, (match, number, unit) => {
                    const result = setting.value * parseFloat(number)
                    return unit ? result + unit : result
                })

                // Replace plain $variable pattern
                const plainVarPattern = new RegExp('\\$' + setting.var + '\\b', 'g')
                str = str.replace(plainVarPattern, setting.value)
            })
        }

        return str.trim()
    }

    
    $: isCurrentClass = isCurrent ? 'current' : ''
    $: replacedInlineStyles = transformSassToCSS(settings.inlineStyle, settings.controllerSettings)
</script>

<span
        class="{isCurrentClass}"
        style="{replacedInlineStyles}"
        style:font-family="{settings.fontFamily.name}"
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
