<script>
    export let content = "Hello World"
    export let isCurrent = false
    export let settings = 1
    $: isCurrentClass = isCurrent ? 'current' : ''
</script>

<span
        contenteditable="true"
        class="{isCurrentClass}"
        style="{settings.inlineStyle}"
        style:font-size="{settings.fontSize}em"
>
    {content}
</span>


<style>

    .current {
        color: blue;
    }
</style>
