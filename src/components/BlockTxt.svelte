<script>
    export let content = "Hello World"
    export let isCurrent = false
    export let settings = {}

    function replaceVariables(str, settings) {
        console.log(str, settings)
        if (settings && Array.isArray(settings) && settings.length>0) {
            settings.forEach(function (setting) {
                str = str.replace(new RegExp(setting.var, 'g'), setting.value)
            })
            /*settings.forEach(setting => {
                window[setting.var] = setting.value
            })
            str = eval('`'+str+'`')*/
            console.log('replaced: ',str)
        }
        return str
    }
    $: isCurrentClass = isCurrent ? 'current' : ''
    $: replacedInlineStyles = replaceVariables(settings.inlineStyle, settings.controllerSettings)
</script>

<span
        class="{isCurrentClass}"
        style="{replacedInlineStyles}"
        style:font-size="{settings.fontSize}em"
>
    {content}
</span>


<style>

    .current {
        color: blue;
    }
</style>
