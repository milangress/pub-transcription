<script lang="ts">
  import type { BlockTxtSettings, ControllerSetting } from 'src/types/index.js'
  import { checkPosition } from './checkPosition.js'

  let {
    content = 'Hello World',
    isCurrent = false,
    settings = {
      inlineStyle: '',
      controllerSettings: []
    },
    onOverflow = () => {}
  } = $props<{
    content?: string
    isCurrent?: boolean
    settings?: BlockTxtSettings
    onOverflow?: () => void
  }>()

  function transformSassToCSS(
    str: string | undefined,
    controllerSettings: ControllerSetting[]
  ): string {
    if (!str) return ''
    const cssStr = str.toString()

    // Remove SASS structure (selector and braces)
    let result = cssStr
      .replace(/\..*{\n/gm, '')
      .replace(/^}$/gm, '')
      // Remove comments
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//gm, '')

    if (controllerSettings && Array.isArray(controllerSettings) && controllerSettings.length > 0) {
      controllerSettings.forEach((setting) => {
        // Replace $variable * number[unit] pattern
        const varPattern = new RegExp('\\$' + setting.var + '\\s*\\*\\s*([\\d.]+)([a-z%]+)?', 'g')
        result = result.replace(varPattern, (_match, number, unit) => {
          const value = setting.value * parseFloat(number)
          return unit ? value + unit : value.toString()
        })

        // Replace plain $variable pattern
        const plainVarPattern = new RegExp('\\$' + setting.var + '\\b', 'g')
        result = result.replace(plainVarPattern, setting.value.toString())
      })
    }

    return result.trim()
  }

  let isCurrentClass = $derived(isCurrent ? 'current' : '')
  let compiledStyle = $derived(
    transformSassToCSS(settings?.inlineStyle, settings?.controllerSettings)
  )
</script>

<span
  class={isCurrentClass}
  style={compiledStyle}
  use:checkPosition={!isCurrent
    ? {
        registerOverflow: () => onOverflow()
      }
    : null}
>
  {content}&nbsp;<wbr />
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
