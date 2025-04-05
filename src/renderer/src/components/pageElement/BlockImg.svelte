<script lang="ts">
  interface Props {
    content?: string;
    isCurrent?: boolean;
  }

  let { content = 'Hello World', isCurrent = false }: Props = $props();
  let isCurrentClass = $derived(isCurrent ? 'current' : '')
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
