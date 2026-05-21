#!/usr/bin/env node
/**
 * Downloads Inkscape 1.4.3 Portable (Windows x64) to resources/inkscape/.
 * Run once before building: npm run setup-inkscape
 *
 * Idempotent: if resources/inkscape/bin/inkscape.exe already exists, exits immediately.
 */
import { execFileSync } from 'child_process'
import {
  existsSync,
  createWriteStream,
  createReadStream,
  mkdirSync,
  readdirSync,
  renameSync,
  unlinkSync,
} from 'fs'
import { get } from 'https'
import { createHash } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RESOURCES_DIR = path.join(ROOT, 'resources')
const DEST_DIR = path.join(RESOURCES_DIR, 'inkscape')
const TMP_FILE = path.join(RESOURCES_DIR, 'inkscape-setup.7z')

// ── Pinned version ───────────────────────────────────────────────────────────
// To upgrade: update URL and SHA256, delete resources/inkscape/, re-run.
const INKSCAPE_VERSION = '1.4.3'
const INKSCAPE_URL =
  'https://inkscape.org/gallery/item/58916/inkscape-1.4.3_2025-12-25_0d15f75-x64.7z'
const INKSCAPE_SHA256 =
  '466c58b10f239e87a72f4ec9eac34e30285c249685e32c3bfe7f969cba44a9f4'

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const inkExe = path.join(DEST_DIR, 'bin', 'inkscape.exe')
  if (existsSync(inkExe)) {
    console.log(`✓ Inkscape already set up at ${DEST_DIR}`)
    return
  }

  mkdirSync(RESOURCES_DIR, { recursive: true })

  console.log(`Downloading Inkscape ${INKSCAPE_VERSION}...`)
  await download(INKSCAPE_URL, TMP_FILE)
  console.log('  → Download complete.')

  console.log('Verifying SHA-256 checksum...')
  const actual = await sha256file(TMP_FILE)
  if (actual.toLowerCase() !== INKSCAPE_SHA256.toLowerCase()) {
    unlinkSync(TMP_FILE)
    throw new Error(
      `Checksum mismatch!\n  expected: ${INKSCAPE_SHA256}\n  got:      ${actual}\n` +
        `  Update INKSCAPE_SHA256 in scripts/setup-inkscape.mjs if this is a legitimate new release.`
    )
  }
  console.log('  → Checksum OK.')

  console.log('Extracting (this may take a minute)...')
  const require = createRequire(import.meta.url)
  const { path7za } = require('7zip-bin')
  execFileSync(path7za, ['x', TMP_FILE, `-o${RESOURCES_DIR}`, '-y'], { stdio: 'inherit' })

  // The 7z archive extracts to a versioned subdirectory, e.g. inkscape-1.4.3_.../
  // Find it and rename to the canonical resources/inkscape/
  const extracted = readdirSync(RESOURCES_DIR)
    .map((f) => path.join(RESOURCES_DIR, f))
    .find((f) => existsSync(path.join(f, 'bin', 'inkscape.exe')))

  if (!extracted) {
    throw new Error('inkscape.exe not found in extracted contents. Check the archive structure.')
  }
  renameSync(extracted, DEST_DIR)
  unlinkSync(TMP_FILE)

  console.log(`✓ Inkscape Portable ready at ${DEST_DIR}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Downloads url to dest, following HTTP redirects. */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    const follow = (u) => {
      get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(new URL(res.headers.location, u).href)
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} from ${u}`))
        }
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
        file.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

/** Returns the lowercase hex SHA-256 of a file. */
function sha256file(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message)
  process.exit(1)
})
