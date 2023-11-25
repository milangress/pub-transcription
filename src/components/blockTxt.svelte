<script>
    export let content = "Hello World";
    export let isCurrent = false;
    $: isCurrentClass = isCurrent ? 'current' : '';
</script>
<span class="{isCurrentClass}">{content}</span>


<style>
    .current {
        color: blue;
    }
</style>
