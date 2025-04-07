<script lang="ts">
  interface Props {
    isPrintPreview?: boolean;
    onClick?: any;
  }

  let { isPrintPreview = false, onClick = () => {} }: Props = $props();
</script>

<button
  class="preview-button"
  class:active={isPrintPreview}
  onclick={onClick}
  disabled={isPrintPreview}
>
  {isPrintPreview ? '🖨️ Preview Mode (5s)' : '👁️ Preview Print'}
</button>

<style>
  .preview-button {
    padding: 6px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-family: monospace;
    font-size: 0.9em;
    transition: all 0.2s ease;
  }

  .preview-button:hover:not(:disabled) {
    background: #f0f0f0;
  }

  .preview-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .preview-button.active {
    background: #e6f3ff;
    border-color: #007bff;
    color: #007bff;
  }
</style>
