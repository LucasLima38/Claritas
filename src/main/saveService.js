import { promises as fsp } from 'fs'
import path from 'path'

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
 * Checks whether an output directory exists and is accessible.
 */
export async function checkOutputDir(dir) {
  try {
    await fsp.access(dir)
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
