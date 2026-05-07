import { createWorker } from 'tesseract.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let worker = null

async function ensureWorker() {
  if (worker) return worker
  const langPath = path.join(app.getPath('userData'), 'tessdata')
  fs.mkdirSync(langPath, { recursive: true })
  worker = await createWorker(['por', 'eng'], 1, {
    langPath,
    cacheMethod: 'readWrite',
  })
  return worker
}

export async function recognizeDataURL(dataURL) {
  const w = await ensureWorker()
  const { data: { text } } = await w.recognize(dataURL)
  return text.trim()
}

export function terminateOcr() {
  if (worker) {
    worker.terminate()
    worker = null
  }
}
