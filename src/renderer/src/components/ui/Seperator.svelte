<script lang="ts">
  import { Separator } from 'bits-ui';
</script>

<Separator.Root />

<style>
  :global([data-separator-root]) {
    background-color: var(--bg-color);
    border: calc(var(--border-width) / 2) solid var(--border-color);
    border-radius: 0;
  }
</style>
