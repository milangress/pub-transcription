import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [svelte()],
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@components': resolve('src/renderer/src/components'),
        '@stores': resolve('src/renderer/src/stores'),
        '@utils': resolve('src/renderer/src/utils'),
        '@preload': resolve('src/preload'),
        '@electron': resolve('src/main')
      }
    }
  }
})
