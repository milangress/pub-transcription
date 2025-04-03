import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  alias: {
    '@': 'src/renderer/src',
    '@assets': 'src/renderer/src/assets',
    '@components': 'src/renderer/src/components',
    '@stores': 'src/renderer/src/stores',
    '@utils': 'src/renderer/src/utils',
    '@preload': 'src/preload',
    '@electron': 'src/main'
  }
}
