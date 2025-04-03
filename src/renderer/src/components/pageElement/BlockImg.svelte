<script lang="ts">
  export let content: string = 'Hello World'
  export let isCurrent: boolean = false
  $: isCurrentClass = isCurrent ? 'current' : ''
</script>

<img src={content} alt="img" class={isCurrentClass} />

<style>
  img {
    width: 100px;
    height: 100px;
    display: inline-block;
  }
  .current {
    color: blue;
  }
</style>
