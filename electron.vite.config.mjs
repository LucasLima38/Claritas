import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  main: {
    build: { rollupOptions: { external: ['electron-store'] } }
  },
  preload: {
    build: { rollupOptions: { external: ['electron-store'] } }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/renderer/src'),
      }
    }
  }
})
