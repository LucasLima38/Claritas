import { promises as fsp, constants as fsConstants } from 'fs'
import path from 'path'
import sharp from 'sharp'

/**
 * Generates a filename from a prefix and counter.
 * Counter is zero-padded to 3 digits (e.g., prefix=BLDC_ counter=3 → BLDC_003.svg).
 * Counters above 999 are not padded.
 */
export function generateFilename(prefix, counter) {
  const padded = String(counter).padStart(3, '0')
  return `${prefix}${padded}.svg`
}

/**
 * Generates a filename from a prefix, counter, and file extension.
 * Counter is zero-padded to 3 digits (e.g., prefix=BLDC_ counter=3 ext=png → BLDC_003.png).
 * Counters above 999 are not padded.
 */
export function generateFilenameWithExt(prefix, counter, ext) {
  const padded = String(counter).padStart(3, '0')
  return `${prefix}${padded}.${ext}`
}

/**
 * Checks whether an output directory exists and is writable.
 * Uses W_OK so that read-only directories are treated as missing,
 * prompting the user to choose another folder rather than hitting EACCES.
 */
export async function checkOutputDir(dir) {
  try {
    await fsp.access(dir, fsConstants.W_OK)
    return { exists: true }
  } catch {
    return { exists: false }
  }
}

/**
 * Saves SVG content to disk.
 * Creates the output directory if it does not exist.
 * @returns {Promise<string>} The full absolute path of the saved file.
 */
export async function saveSVG(svgContent, outputDir, filename) {
  await fsp.mkdir(outputDir, { recursive: true })
  const fullPath = path.join(outputDir, filename)
  try {
    await fsp.writeFile(fullPath, svgContent, 'utf8')
  } catch (err) {
    const code = err.code ?? 'WRITE_ERROR'
    throw new Error(`${code}: ${err.message}`)
  }
  return fullPath
}

/**
 * Saves a binary buffer to disk.
 * Creates the output directory if it does not exist.
 * @returns {Promise<string>} The full absolute path of the saved file.
 */
export async function saveBuffer(buffer, outputDir, filename) {
  await fsp.mkdir(outputDir, { recursive: true })
  const fullPath = path.join(outputDir, filename)
  try {
    await fsp.writeFile(fullPath, buffer)
  } catch (err) {
    const code = err.code ?? 'WRITE_ERROR'
    throw new Error(`${code}: ${err.message}`)
  }
  return fullPath
}

/**
 * Applies resolution scaling to an image buffer using sharp.
 * - 'normal' or null/undefined: returns buffer unchanged (no-op)
 * - 'low': resizes to 0.5× dimensions
 * - 'high': resizes to 2× dimensions
 * @returns {Promise<Buffer>} The processed (or original) buffer.
 */
export async function applyResolution(buffer, mimeType, resolution) {
  if (resolution === 'normal' || !resolution) return buffer
  const factor = resolution === 'high' ? 2 : 0.5
  const metadata = await sharp(buffer).metadata()
  return sharp(buffer)
    .resize(Math.round(metadata.width * factor), Math.round(metadata.height * factor))
    .toBuffer()
}

/**
 * Saves image from a data URL (PNG/JPG) to disk.
 * Decodes base64 content and writes the binary buffer.
 * Creates the output directory if it does not exist.
 * @returns {Promise<string>} The full absolute path of the saved file.
 */
export async function saveImage(dataURL, outputDir, filename) {
  await fsp.mkdir(outputDir, { recursive: true })
  const base64Data = dataURL.replace(/^data:[^;]+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  const fullPath = path.join(outputDir, filename)
  try {
    await fsp.writeFile(fullPath, buffer)
  } catch (err) {
    const code = err.code ?? 'WRITE_ERROR'
    throw new Error(`${code}: ${err.message}`)
  }
  return fullPath
}
