import { spawn, execSync } from 'child_process'
import { existsSync, promises as fsp } from 'fs'
import path from 'path'
import os from 'os'

const INKSCAPE_DEFAULT_PATHS = [
  'C:\\Program Files\\Inkscape\\bin\\inkscape.exe',
  'C:\\Program Files (x86)\\Inkscape\\bin\\inkscape.exe',
]

/**
 * Attempts to find the Inkscape executable on the system.
 * Checks default paths, then Windows registry.
 * Returns the path string or null if not found.
 */
export function findInkscape() {
  for (const p of INKSCAPE_DEFAULT_PATHS) {
    if (existsSync(p)) return p
  }

  try {
    const regOutput = execSync(
      'reg query "HKLM\\SOFTWARE\\Inkscape" /ve',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const match = regOutput.match(/REG_SZ\s+(.+)/)
    if (match) {
      const dir = match[1].trim()
      const candidate = path.join(dir, 'bin', 'inkscape.exe')
      if (existsSync(candidate)) return candidate
    }
  } catch {
    // Registry not available or key missing
  }

  return null
}

/**
 * Returns true if the SVG string contains meaningful content.
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
 * Converts an EMF Buffer to an SVG string using Inkscape CLI.
 * @param {Buffer} emfBuffer   Raw EMF bytes from the clipboard
 * @param {string} inkscapePath  Absolute path to inkscape.exe
 * @param {number} timeout     Milliseconds before aborting (default 15000)
 * @returns {Promise<string>} SVG content string
 */
export async function convert(emfBuffer, inkscapePath, timeout = 15000) {
  const id = crypto.randomUUID()
  const tmpDir = os.tmpdir()
  const emfPath = path.join(tmpDir, `schclip_${id}.emf`)
  const svgPath = path.join(tmpDir, `schclip_${id}.svg`)

  await fsp.writeFile(emfPath, emfBuffer)

  try {
    await new Promise((resolve, reject) => {
      const proc = spawn(inkscapePath, [`--export-filename=${svgPath}`, emfPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error('TIMEOUT'))
      }, timeout)

      proc.on('close', (code) => {
        clearTimeout(timer)
        if (code !== 0) reject(new Error(`Inkscape exited with code ${code}`))
        else resolve()
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    return await fsp.readFile(svgPath, 'utf8')
  } finally {
    await fsp.unlink(emfPath).catch(() => {})
    await fsp.unlink(svgPath).catch(() => {})
  }
}

/**
 * Runs `inkscape --version` and parses the version string.
 * @param {string} inkscapePath Absolute path to inkscape.exe
 * @returns {Promise<{ok: boolean, version?: string, error?: string}>}
 */
export async function checkInkscapeVersion(inkscapePath) {
  return new Promise((resolve) => {
    let output = ''
    let errOutput = ''
    let proc
    try {
      proc = spawn(inkscapePath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      return resolve({ ok: false, error: err.message })
    }

    proc.stdout.on('data', (chunk) => { output += chunk.toString() })
    proc.stderr.on('data', (chunk) => { errOutput += chunk.toString() })

    proc.on('close', (code) => {
      if (code !== 0) return resolve({ ok: false, error: errOutput.trim() || `Exit code ${code}` })
      const match = output.match(/Inkscape\s+(\d+(?:\.\d+)+)/)
      if (match) {
        resolve({ ok: true, version: match[1] })
      } else {
        resolve({ ok: false, error: 'Could not parse version' })
      }
    })

    proc.on('error', (err) => resolve({ ok: false, error: err.message }))
  })
}
