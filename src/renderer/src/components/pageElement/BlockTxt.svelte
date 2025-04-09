<script lang="ts">
  import { checkPosition } from './checkPosition.js';

  let {
    content = 'Hello World',
    isCurrent = false,
    editorCss = '',
    controllerValues = {},
    onOverflow = () => {},
  } = $props<{
    content?: string;
    isCurrent?: boolean;
    editorCss?: string;
    controllerValues: Record<string, number>;
    onOverflow?: () => void;
  }>();

  function transformSassToCSS(
    str: string | undefined,
    controllerValues: Record<string, number> = {},
  ): string {
    if (!str) return '';
    // Extract only the .el{} element
    const elMatch = str.match(/\.el\s*{([^}]*)}/);
    if (!elMatch || !elMatch[1]) return '';

    // Get just the content inside .el{}
    let cssContent = elMatch[1];

    // Remove comments in one pass
    cssContent = cssContent.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');

    // If no controller values, return cleaned CSS
    if (Object.keys(controllerValues).length === 0) return cssContent.trim();

    // Process variable replacements efficiently
    // Handle both $var and $var * value patterns in a single pass
    const result = cssContent.replace(
      /\$([a-zA-Z0-9_]+)(?:\s*\*\s*([\d.]+)([a-z%]+)?)?/g,
      (match, varName, multiplier, unit) => {
        const value = controllerValues[varName];
        if (value === undefined) return match; // Keep original if var not found

        if (multiplier !== undefined) {
          const calculated = value * parseFloat(multiplier);
          return unit ? calculated + unit : calculated.toString();
        }

        return value.toString();
      },
    );

    return result.trim();
  }

  let isCurrentClass = $derived(isCurrent ? 'current' : '');
  let compiledStyle = $derived(transformSassToCSS(editorCss, controllerValues));
</script>

<span
  class={isCurrentClass}
  style={compiledStyle}
  use:checkPosition={!isCurrent
    ? {
        registerOverflow: () => onOverflow(),
      }
    : null}
>
  {content}&nbsp;<wbr />
</span>

<style>
  span {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
    /* filter: blur(0);
    -webkit-filter: blur(0); */
  }
  .current {
    color: blue;
  }
</style>
