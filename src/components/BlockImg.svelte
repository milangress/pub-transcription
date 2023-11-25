<script>
    export let content = "Hello World";
    export let isCurrent = false;
    $: isCurrentClass = isCurrent ? 'current' : '';
</script>
<img src="{content}" alt="img" class="{isCurrentClass}">


<style>
    img{
        width: 100px;
        height: 100px;
        display: inline-block;
    }
    .current {
        color: blue;
    }
</style>
