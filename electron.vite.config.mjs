import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function copyOverlays() {
  return {
    name: 'copy-overlay-html',
    closeBundle() {
      const src = path.resolve(__dirname, 'src/renderer/overlay')
      const dest = path.resolve(__dirname, 'out/renderer/overlay')
      mkdirSync(dest, { recursive: true })
      for (const file of readdirSync(src)) {
        copyFileSync(path.join(src, file), path.join(dest, file))
      }
    },
  }
}

export default defineConfig({
  main: {
    build: { rollupOptions: { external: ['electron-store'] } }
  },
  preload: {
    build: { rollupOptions: { external: ['electron-store'] } }
  },
  renderer: {
    plugins: [react(), copyOverlays()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/renderer/src'),
      }
    }
  }
})
