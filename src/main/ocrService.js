import { createWorker } from 'tesseract.js'
import { app } from 'electron'
import path from 'path'

let worker = null

async function ensureWorker() {
  if (worker) return worker
  const langPath = path.join(app.getPath('userData'), 'tessdata')
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
