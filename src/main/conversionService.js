import { promises as fsp } from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { optimize } from 'svgo'

/** Injected by index.js after the shell has started. */
let _shell = null

/**
 * Injects the InkscapeShell instance.
 * Called from index.js once the shell has successfully started.
 * @param {import('./inkscapeShell.js').InkscapeShell} shell
 */
export function setShell(shell) {
  _shell = shell
}

/**
 * Returns true if the SVG string contains meaningful content.
 * @param {string} svgContent
 * @returns {boolean}
 */
export function isValidSVG(svgContent) {
  if (!svgContent || svgContent.trim().length === 0) return false
  if (!svgContent.includes('<svg')) return false
  const bodyMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  if (!bodyMatch) return false
  return bodyMatch[1].trim().length > 10
}

/**
 * Extracts width, height and size metadata from an SVG string.
 * @param {string} svgContent
 * @param {number} conversionMs
 */
export function getSVGMetadata(svgContent, conversionMs) {
  const widthMatch = svgContent.match(/width="([^"]+)"/)
  const heightMatch = svgContent.match(/height="([^"]+)"/)
  return {
    width: widthMatch?.[1] ?? 'unknown',
    height: heightMatch?.[1] ?? 'unknown',
    sizeBytes: Buffer.byteLength(svgContent, 'utf8'),
    conversionMs,
  }
}

/**
 * Runs SVGO preset-default on the SVG string.
 * Preserves viewBox and IDs (needed for KiCad output).
 * Falls back to the original string if SVGO throws.
 * @param {string} svgContent
 * @returns {string}
 */
function optimizeSvg(svgContent) {
  try {
    const result = optimize(svgContent, {
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              removeViewBox: false,
              cleanupIds: false,
            },
          },
        },
      ],
    })
    return result.data
  } catch {
    return svgContent
  }
}

/**
 * Exports SVG content to the final format and writes to outputPath.
 * SVG: written directly.
 * PNG/JPG/PDF: written via a second Inkscape action chain (SVG→target format).
 *
 * @param {string} svgContent   Already-optimized SVG string (from convert())
 * @param {'svg'|'png'|'jpg'|'pdf'} format
 * @param {string} outputPath   Absolute destination path
 * @param {number} timeout      ms before rejecting with TIMEOUT (default 30 s)
 */
export async function exportToFormat(svgContent, format, outputPath, timeout = 30_000) {
  if (format === 'svg') {
    await fsp.writeFile(outputPath, svgContent, 'utf8')
    return
  }
  if (!_shell) throw new Error('SHELL_NOT_INITIALIZED')

  const tmpSvg = path.join(os.tmpdir(), `schclip_exp_${randomUUID()}.svg`)
  await fsp.writeFile(tmpSvg, svgContent, 'utf8')
  try {
    // Inkscape uses 'jpeg' not 'jpg'
    const inkFormat = format === 'jpg' ? 'jpeg' : format
    const dpiPart = format !== 'pdf' ? 'export-dpi:300; ' : ''
    const qualityPart = format === 'jpg' ? 'export-jpeg-quality:95; ' : ''
    const actions =
      `file-open:${tmpSvg}; ` +
      `export-type:${inkFormat}; ` +
      `${dpiPart}` +
      `${qualityPart}` +
      `export-filename:${outputPath}; ` +
      `export-do; file-close`
    await _shell.execute(actions, timeout)
  } finally {
    await fsp.unlink(tmpSvg).catch(() => {})
  }
}

/**
 * Converts an EMF Buffer to an SVG string using the bundled Inkscape shell.
 * Writes the buffer to a temp .emf file, tells the shell to convert it,
 * reads back the resulting .svg, then cleans up both temp files.
 *
 * @param {Buffer} emfBuffer  Raw EMF bytes from the clipboard
 * @param {number} timeout    ms before aborting (default 15 s)
 * @returns {Promise<string>} SVG content string
 */
export async function convert(emfBuffer, timeout = 15_000) {
  const id = randomUUID()
  const tmpDir = os.tmpdir()
  const emfPath = path.join(tmpDir, `schclip_${id}.emf`)
  const svgPath = path.join(tmpDir, `schclip_${id}.svg`)

  await fsp.writeFile(emfPath, emfBuffer)
  try {
    if (!_shell) throw new Error('SHELL_NOT_INITIALIZED')
    await _shell.convert(emfPath, svgPath, timeout)
    const svgContent = await fsp.readFile(svgPath, 'utf8')
    return optimizeSvg(svgContent)
  } finally {
    await fsp.unlink(emfPath).catch(() => {})
    await fsp.unlink(svgPath).catch(() => {})
  }
}
