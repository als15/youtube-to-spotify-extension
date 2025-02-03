import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import copy from 'rollup-plugin-copy'

export default defineConfig({
  plugins: [
    vue(),
    copy({
      targets: [
        { src: 'manifest.json', dest: 'dist' },
        { src: 'background.js', dest: 'dist' }
      ],
      hook: 'writeBundle' // copy after bundle is written
    })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
})
