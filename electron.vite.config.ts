import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          print: resolve(__dirname, 'src/preload/print.ts')
        }
      }
    }
  },
  renderer: {
    plugins: [svelte()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          print: resolve(__dirname, 'src/renderer/print.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@components': resolve('src/renderer/src/components'),
        '@stores': resolve('src/renderer/src/stores'),
        '@utils': resolve('src/renderer/src/utils'),
        '@preload': resolve('src/preload'),
        '@electron': resolve('src/main'),
        '@types': resolve('src/types')
      }
    }
  }
})
