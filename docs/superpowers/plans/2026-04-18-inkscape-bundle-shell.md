# Inkscape Bundle + Shell Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle Inkscape 1.4.3 Portable inside the app and replace per-conversion `spawn()` calls with a single persistent `--shell` process, eliminating the external Inkscape install requirement.

**Architecture:** A new `InkscapeShell` class manages the lifecycle of a single long-running `inkscape --shell` process. `conversionService.js` becomes a thin I/O wrapper that delegates to the shell. `index.js` starts the shell on `app.whenReady()` and stops it on `before-quit`. The Inkscape portable is downloaded via `npm run setup-inkscape` and bundled into production builds via `electron-builder`'s `extraResources`.

**Tech Stack:** Electron 39, Node.js child_process, `7zip-bin` (already in node_modules via electron-builder), Inkscape 1.4.3 Portable (Windows x64)

---

## Task 1: Config — `.gitignore`, `package.json`, `electron-builder.yml`

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `electron-builder.yml`

- [ ] **Step 1: Update `.gitignore`**

Open `.gitignore` and add after the `*.emf` line:

```
# Bundled Inkscape Portable (run: npm run setup-inkscape)
resources/inkscape/
```

- [ ] **Step 2: Update `package.json` scripts and devDependencies**

In `package.json`, add to `"scripts"`:
```json
"setup-inkscape": "node scripts/setup-inkscape.js"
```

Add to `"devDependencies"`:
```json
"7zip-bin": "^5.2.0"
```

`7zip-bin` is already in `node_modules` as a transitive dep of `electron-builder`, but making it explicit prevents breakage if electron-builder changes its internals.

- [ ] **Step 3: Add `extraResources` to `electron-builder.yml`**

Open `electron-builder.yml` and add after the `asarUnpack` block:

```yaml
extraResources:
  - from: resources/inkscape
    to: inkscape
    filter:
      - "**/*"
```

This copies `resources/inkscape/` into `{output}/win-unpacked/resources/inkscape/` during the production build, accessible at `process.resourcesPath + '/inkscape'`.

- [ ] **Step 4: Run `npm install` to register `7zip-bin` as explicit dep**

```bash
npm install
```

Expected: completes with no errors. `"7zip-bin"` appears in `package.json` devDependencies.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json package-lock.json electron-builder.yml
git commit -m "chore: add setup-inkscape script, extraResources config, gitignore inkscape bundle"
```

---

## Task 2: Setup script — `scripts/setup-inkscape.js`

**Files:**
- Create: `scripts/setup-inkscape.js`

This script downloads Inkscape 1.4.3 Portable (Windows x64), verifies its SHA-256 checksum, and extracts it to `resources/inkscape/`.

- [ ] **Step 1: Create `scripts/` directory and the script file**

Create `scripts/setup-inkscape.js` with the following complete content:

```js
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

const require = createRequire(import.meta.url)
const { path7za } = require('7zip-bin')

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
        `  Update INKSCAPE_SHA256 in scripts/setup-inkscape.js if this is a legitimate new release.`
    )
  }
  console.log('  → Checksum OK.')

  console.log('Extracting (this may take a minute)...')
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
```

- [ ] **Step 2: Run the setup script**

```bash
npm run setup-inkscape
```

Expected output (first run — takes 1–2 minutes to download ~95 MB):
```
Downloading Inkscape 1.4.3...
  → Download complete.
Verifying SHA-256 checksum...
  → Checksum OK.
Extracting (this may take a minute)...
...
✓ Inkscape Portable ready at ...\resources\inkscape
```

Verify `resources/inkscape/bin/inkscape.exe` exists.

- [ ] **Step 3: Run again to confirm idempotency**

```bash
npm run setup-inkscape
```

Expected:
```
✓ Inkscape already set up at ...\resources\inkscape
```

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-inkscape.js package.json package-lock.json
git commit -m "feat: add setup-inkscape script to download Inkscape 1.4.3 Portable"
```

---

## Task 3: `InkscapeShell` class (TDD)

**Files:**
- Create: `src/main/inkscapeShell.js`
- Create: `tests/main/inkscapeShell.test.js`

The `InkscapeShell` class manages a single persistent `inkscape --shell` process. It spawns the process, waits for the `> ` prompt on stdout (ready signal), then accepts `convert()` calls which write a command to stdin and wait for the next `> ` prompt.

- [ ] **Step 1: Write the failing tests**

Create `tests/main/inkscapeShell.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

const mockSpawn = vi.fn()
vi.mock('child_process', () => ({ spawn: mockSpawn }))
vi.mock('electron', () => ({ app: { getPath: vi.fn(), isPackaged: false } }))

/** Creates a mock ChildProcess that mimics what spawn() returns. */
function makeMockProc() {
  const proc = new EventEmitter()
  proc.stdin = { write: vi.fn() }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  return proc
}

const { InkscapeShell } = await import('../../src/main/inkscapeShell.js')

describe('InkscapeShell', () => {
  let shell
  let proc

  beforeEach(() => {
    vi.clearAllMocks()
    proc = makeMockProc()
    mockSpawn.mockReturnValue(proc)
    shell = new InkscapeShell('C:\\fake\\inkscape.exe')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── start() ──────────────────────────────────────────────────────────────

  describe('start()', () => {
    it('resolves when stdout emits "> "', async () => {
      const p = shell.start()
      proc.stdout.emit('data', 'Inkscape interactive shell mode.\n> ')
      await expect(p).resolves.toBeUndefined()
      expect(mockSpawn).toHaveBeenCalledWith(
        'C:\\fake\\inkscape.exe',
        ['--shell'],
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
      )
    })

    it('rejects with STARTUP_TIMEOUT when no prompt arrives', async () => {
      vi.useFakeTimers()
      const p = shell.start()
      await vi.advanceTimersByTimeAsync(11_000)
      await expect(p).rejects.toThrow('STARTUP_TIMEOUT')
    })
  })

  // ── convert() ────────────────────────────────────────────────────────────

  describe('convert()', () => {
    async function startShell() {
      const p = shell.start()
      proc.stdout.emit('data', '> ')
      await p
    }

    it('writes command to stdin and resolves when stdout emits "> "', async () => {
      await startShell()

      const p = shell.convert('C:\\tmp\\in.emf', 'C:\\tmp\\out.svg')
      expect(proc.stdin.write).toHaveBeenCalledWith(
        'C:\\tmp\\in.emf --export-filename=C:\\tmp\\out.svg --export-area-drawing\n'
      )

      proc.stdout.emit('data', '> ')
      await expect(p).resolves.toBeUndefined()
    })

    it('rejects with TIMEOUT when no prompt arrives within timeout', async () => {
      vi.useFakeTimers()
      // startShell emits "> " synchronously, so startup resolves despite fake timers
      await startShell()

      const p = shell.convert('in.emf', 'out.svg', 200)
      await vi.advanceTimersByTimeAsync(300)
      await expect(p).rejects.toThrow('TIMEOUT')
    })

    it('rejects immediately when process crashes during conversion', async () => {
      const restartProc = makeMockProc()
      mockSpawn.mockReturnValueOnce(proc).mockReturnValue(restartProc)

      await startShell()

      const p = shell.convert('in.emf', 'out.svg')
      proc.emit('exit', 1, null)
      await expect(p).rejects.toThrow('PROCESS_CRASHED')
    })
  })

  // ── busy getter ───────────────────────────────────────────────────────────

  describe('busy', () => {
    it('is false before any conversion and true during one', async () => {
      const p = shell.start()
      proc.stdout.emit('data', '> ')
      await p

      expect(shell.busy).toBe(false)

      const cp = shell.convert('in.emf', 'out.svg')
      expect(shell.busy).toBe(true)

      proc.stdout.emit('data', '> ')
      await cp
      expect(shell.busy).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | head -40
```

Expected: all 6 tests FAIL with "Cannot find module" or similar (file doesn't exist yet).

- [ ] **Step 3: Create `src/main/inkscapeShell.js`**

```js
import { spawn } from 'child_process'

const STARTUP_TIMEOUT_MS = 10_000
const PROMPT = '> '

export class InkscapeShell {
  constructor(executablePath) {
    this._exe = executablePath
    this._proc = null
    this._ready = false
    this._buffer = ''
    this._pendingResolve = null
    this._pendingReject = null
    this._stopping = false
  }

  /** True while a convert() call is awaiting the completion prompt. */
  get busy() {
    return this._pendingResolve !== null
  }

  /**
   * Spawns `inkscape --shell` and waits for the first `> ` prompt.
   * Resolves when the shell is ready to accept commands.
   * Rejects with Error('STARTUP_TIMEOUT') if the prompt doesn't arrive in 10 s.
   */
  async start() {
    this._stopping = false
    this._ready = false
    this._buffer = ''

    await new Promise((resolve, reject) => {
      const startTimer = setTimeout(
        () => reject(new Error('STARTUP_TIMEOUT')),
        STARTUP_TIMEOUT_MS
      )

      this._proc = spawn(this._exe, ['--shell'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      this._proc.stdout.on('data', (chunk) => {
        this._buffer += chunk.toString()
        if (!this._buffer.includes(PROMPT)) return

        if (!this._ready) {
          // First prompt — startup complete
          clearTimeout(startTimer)
          this._ready = true
          this._buffer = ''
          resolve()
        } else if (this._pendingResolve) {
          // Subsequent prompt — conversion complete
          const res = this._pendingResolve
          this._pendingResolve = null
          this._pendingReject = null
          this._buffer = ''
          res()
        }
      })

      this._proc.on('exit', (_code, _signal) => {
        if (this._stopping) return

        // Unexpected crash — reject any active convert() call
        const rej = this._pendingReject
        this._pendingResolve = null
        this._pendingReject = null
        if (rej) rej(new Error('PROCESS_CRASHED'))

        this._ready = false
        this._proc = null
        // Auto-restart silently
        this.start().catch(() => {})
      })

      this._proc.on('error', (err) => {
        clearTimeout(startTimer)
        reject(err)
      })
    })
  }

  /**
   * Kills the Inkscape process. Called on app before-quit.
   */
  stop() {
    this._stopping = true
    this._ready = false
    this._proc?.kill()
    this._proc = null
  }

  /**
   * Sends an EMF→SVG conversion command to the running shell.
   * @param {string} emfPath  Absolute path to the input .emf file (already written)
   * @param {string} svgPath  Absolute path where Inkscape should write the output .svg
   * @param {number} timeout  Milliseconds before rejecting with TIMEOUT (default 15 s)
   * @returns {Promise<void>} Resolves when Inkscape signals completion with `> `
   */
  async convert(emfPath, svgPath, timeout = 15_000) {
    if (!this._ready) throw new Error('SHELL_NOT_READY')

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingResolve = null
        this._pendingReject = null
        reject(new Error('TIMEOUT'))
      }, timeout)

      this._pendingResolve = () => {
        clearTimeout(timer)
        resolve()
      }
      this._pendingReject = (err) => {
        clearTimeout(timer)
        reject(err)
      }

      const cmd = `${emfPath} --export-filename=${svgPath} --export-area-drawing\n`
      this._proc.stdin.write(cmd)
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | head -40
```

Expected: all 6 tests in `inkscapeShell.test.js` PASS. Other test files also pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/main/inkscapeShell.js tests/main/inkscapeShell.test.js
git commit -m "feat: add InkscapeShell class with start/stop/convert and auto-restart"
```

---

## Task 4: Update `conversionService.js` (TDD)

**Files:**
- Modify: `src/main/conversionService.js`
- Modify: `tests/main/conversionService.test.js`

Remove `findInkscape()` and `checkInkscapeVersion()`. Add `setShell()`. Update `convert()` to delegate to the injected shell instance instead of spawning Inkscape itself.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `tests/main/conversionService.test.js` with:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    promises: {
      ...actual.promises,
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
      ),
      unlink: vi.fn().mockResolvedValue(undefined),
    },
  }
})

vi.mock('electron', () => ({ app: { getPath: vi.fn() } }))

const { convert, setShell, isValidSVG, getSVGMetadata } = await import(
  '../../src/main/conversionService.js'
)

describe('ConversionService', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── isValidSVG() ─────────────────────────────────────────────────────────

  describe('isValidSVG()', () => {
    it('returns true for valid SVG with content', () => {
      expect(
        isValidSVG('<svg xmlns="..."><rect x="0" y="0" width="10" height="10"/></svg>')
      ).toBe(true)
    })

    it('returns false for empty string', () => {
      expect(isValidSVG('')).toBe(false)
    })

    it('returns false for SVG with empty body', () => {
      expect(isValidSVG('<svg xmlns="..."></svg>')).toBe(false)
    })

    it('returns false for non-SVG content', () => {
      expect(isValidSVG('Hello world')).toBe(false)
    })
  })

  // ── getSVGMetadata() ──────────────────────────────────────────────────────

  describe('getSVGMetadata()', () => {
    it('extracts width and height from svg root element', () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="148mm"><rect width="50" height="50"/></svg>'
      const meta = getSVGMetadata(svg, 500)
      expect(meta.width).toBe('210mm')
      expect(meta.height).toBe('148mm')
    })

    it('returns unknown when svg has no width/height attributes', () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>'
      const meta = getSVGMetadata(svg, 100)
      expect(meta.width).toBe('unknown')
      expect(meta.height).toBe('unknown')
    })

    it('reports sizeBytes as byte length of the SVG string', () => {
      const svg = '<svg></svg>'
      const meta = getSVGMetadata(svg, 0)
      expect(meta.sizeBytes).toBe(Buffer.byteLength(svg, 'utf8'))
    })

    it('passes through conversionMs unchanged', () => {
      const meta = getSVGMetadata('<svg width="1" height="1"></svg>', 1234)
      expect(meta.conversionMs).toBe(1234)
    })
  })

  // ── convert() ────────────────────────────────────────────────────────────

  describe('convert()', () => {
    it('delegates to shell.convert() and returns SVG from the output file', async () => {
      const mockShell = { convert: vi.fn().mockResolvedValue(undefined) }
      setShell(mockShell)

      const result = await convert(Buffer.from([0x01]))
      expect(result).toContain('<svg')
      expect(mockShell.convert).toHaveBeenCalledOnce()
      // shell.convert receives (emfPath, svgPath, timeout) — both are tmp paths
      const [emfArg, svgArg] = mockShell.convert.mock.calls[0]
      expect(emfArg).toMatch(/schclip_.*\.emf$/)
      expect(svgArg).toMatch(/schclip_.*\.svg$/)
    })

    it('rejects when shell.convert() rejects with TIMEOUT', async () => {
      const mockShell = {
        convert: vi.fn().mockRejectedValue(new Error('TIMEOUT')),
      }
      setShell(mockShell)
      await expect(convert(Buffer.from([0x01]))).rejects.toThrow('TIMEOUT')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | head -50
```

Expected: `conversionService.test.js` tests FAIL — `setShell` and updated `convert` don't exist yet.

- [ ] **Step 3: Rewrite `src/main/conversionService.js`**

Replace the entire file contents with:

```js
import { promises as fsp } from 'fs'
import path from 'path'
import os from 'os'

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
 * Converts an EMF Buffer to an SVG string using the bundled Inkscape shell.
 * Writes the buffer to a temp .emf file, tells the shell to convert it,
 * reads back the resulting .svg, then cleans up both temp files.
 *
 * @param {Buffer} emfBuffer  Raw EMF bytes from the clipboard
 * @param {number} timeout    ms before aborting (default 15 s)
 * @returns {Promise<string>} SVG content string
 */
export async function convert(emfBuffer, timeout = 15_000) {
  const id = crypto.randomUUID()
  const tmpDir = os.tmpdir()
  const emfPath = path.join(tmpDir, `schclip_${id}.emf`)
  const svgPath = path.join(tmpDir, `schclip_${id}.svg`)

  await fsp.writeFile(emfPath, emfBuffer)
  try {
    await _shell.convert(emfPath, svgPath, timeout)
    return await fsp.readFile(svgPath, 'utf8')
  } finally {
    await fsp.unlink(emfPath).catch(() => {})
    await fsp.unlink(svgPath).catch(() => {})
  }
}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npm test -- --reporter=verbose
```

Expected: ALL tests pass across all test files. `conversionService.test.js` should show 10 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/conversionService.js tests/main/conversionService.test.js
git commit -m "refactor: conversionService — remove findInkscape/checkInkscapeVersion, delegate to InkscapeShell"
```

---

## Task 5: Update `projectStore.js` (TDD)

**Files:**
- Modify: `src/main/projectStore.js`
- Modify: `tests/main/projectStore.test.js`

Remove `inkscapePath` and `conversionTimeout` from the settings store. These are no longer user-configurable — the path is bundled and the timeout is an internal constant in `InkscapeShell`.

- [ ] **Step 1: Add failing tests to `tests/main/projectStore.test.js`**

At the end of the `describe('ProjectStore')` block (after line 115, before the closing `}`), add:

```js
  it('getSettings does not include inkscapePath', () => {
    expect(store.getSettings()).not.toHaveProperty('inkscapePath')
  })

  it('getSettings does not include conversionTimeout', () => {
    expect(store.getSettings()).not.toHaveProperty('conversionTimeout')
  })
```

Also, remove or update these two existing tests that reference the old fields:
- Line 85: `expect(settings.conversionTimeout).toBe(15000)` — **delete this assertion** (change the test to just check `startMinimized`):

Replace:
```js
  it('getSettings returns defaults when unset', () => {
    const settings = store.getSettings()
    expect(settings.conversionTimeout).toBe(15000)
    expect(settings.startMinimized).toBe(false)
  })
```
With:
```js
  it('getSettings returns defaults when unset', () => {
    const settings = store.getSettings()
    expect(settings.startMinimized).toBe(false)
    expect(settings.theme).toBe('system')
    expect(settings.closeHides).toBe(true)
  })
```

- Lines 89–92: The `updateSettings persists changes` test uses `inkscapePath`. Replace it:

Replace:
```js
  it('updateSettings persists changes', () => {
    store.updateSettings({ inkscapePath: 'C:\\inkscape.exe' })
    expect(store.getSettings().inkscapePath).toBe('C:\\inkscape.exe')
  })
```
With:
```js
  it('updateSettings persists changes', () => {
    store.updateSettings({ theme: 'dark' })
    expect(store.getSettings().theme).toBe('dark')
  })
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
npm test -- tests/main/projectStore.test.js --reporter=verbose
```

Expected: the two new `not.toHaveProperty` tests FAIL because the store still returns `inkscapePath` and `conversionTimeout`.

- [ ] **Step 3: Update `src/main/projectStore.js`**

Replace `SETTINGS_DEFAULTS` with:

```js
const SETTINGS_DEFAULTS = {
  startMinimized: false,
  closeHides: true,
  theme: 'system',
}
```

Replace `getSettings()` with:

```js
  getSettings() {
    return {
      startMinimized: this._settings.get('startMinimized', false),
      closeHides: this._settings.get('closeHides', true),
      theme: this._settings.get('theme', 'system'),
    }
  }
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --reporter=verbose
```

Expected: ALL tests pass. Specifically, all `projectStore.test.js` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/projectStore.js tests/main/projectStore.test.js
git commit -m "refactor: remove inkscapePath and conversionTimeout from settings store"
```

---

## Task 6: Update `src/main/index.js`

**Files:**
- Modify: `src/main/index.js`

Wire up the `InkscapeShell` instance, update the app lifecycle, simplify `paste-schematic`, and remove the `check-inkscape-version` IPC handler.

- [ ] **Step 1: Update imports at the top of `index.js`**

Replace the existing import line for `conversionService`:
```js
import { convert, findInkscape, isValidSVG, getSVGMetadata, checkInkscapeVersion } from './conversionService.js'
```
With:
```js
import { convert, setShell, isValidSVG, getSVGMetadata } from './conversionService.js'
import { InkscapeShell } from './inkscapeShell.js'
```

- [ ] **Step 2: Add `resolveInkExe()` helper and module-level shell instance**

After the `const store = new ProjectStore()` line, add:

```js
// ── Inkscape shell ────────────────────────────────────────────────────────

function resolveInkExe() {
  return is.dev
    ? path.join(process.cwd(), 'resources/inkscape/bin/inkscape.exe')
    : path.join(process.resourcesPath, 'inkscape/bin/inkscape.exe')
}

const inkscapeShell = new InkscapeShell(resolveInkExe())
```

- [ ] **Step 3: Update `app.whenReady()` — remove auto-detect, start the shell**

Replace the entire `app.whenReady().then(...)` block with:

```js
app.whenReady().then(async () => {
  mainWindow = createWindow()
  tray = createTray(mainWindow, store)

  // Start the bundled Inkscape shell (non-blocking for window show)
  inkscapeShell.start().then(() => {
    setShell(inkscapeShell)
  }).catch((err) => {
    console.error('Inkscape shell failed to start:', err.message)
  })

  // Show window unless startMinimized is set
  if (!store.getSettings().startMinimized) {
    mainWindow.show()
  }

  // Send theme immediately after load
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('theme-changed', {
      isDark: nativeTheme.shouldUseDarkColors,
    })
  })
})
```

- [ ] **Step 4: Add `before-quit` handler to stop the shell**

After the `app.on('window-all-closed', ...)` block, add:

```js
app.on('before-quit', () => {
  inkscapeShell.stop()
})
```

- [ ] **Step 5: Update the `paste-schematic` IPC handler**

Replace the entire `ipcMain.handle('paste-schematic', ...)` block with:

```js
ipcMain.handle('paste-schematic', async () => {
  const emfBuffer = await readEMF()
  if (!emfBuffer) {
    return { error: 'NO_EMF', message: 'Nenhum esquemático vetorial encontrado no clipboard.' }
  }

  if (inkscapeShell.busy) {
    return { error: 'BUSY' }
  }

  const startTime = Date.now()

  try {
    const svgContent = await convert(emfBuffer)

    if (!isValidSVG(svgContent)) {
      return {
        error: 'INVALID_SVG',
        message: 'Conversão incompleta — o SVG gerado está em branco. Tente novamente.',
      }
    }

    const metadata = getSVGMetadata(svgContent, Date.now() - startTime)
    pendingSVG = { svgContent, metadata }

    return { ok: true, svgContent, metadata }
  } catch (err) {
    pendingSVG = null
    if (err.message === 'TIMEOUT') {
      return { error: 'TIMEOUT', message: 'O Inkscape demorou mais de 15s. Tente novamente.' }
    }
    return { error: 'ERROR', message: `Erro de conversão: ${err.message}` }
  }
})
```

- [ ] **Step 6: Remove the `check-inkscape-version` IPC handler**

Delete the following block from `index.js` (around line 262):

```js
ipcMain.handle('check-inkscape-version', async (_event, { path: inkPath }) => {
  return await checkInkscapeVersion(inkPath)
})
```

- [ ] **Step 7: Run all tests**

```bash
npm test -- --reporter=verbose
```

Expected: ALL tests pass. (index.js is not directly unit-tested — the shell and conversion service are tested via their own tests.)

- [ ] **Step 8: Commit**

```bash
git add src/main/index.js
git commit -m "feat: wire InkscapeShell into app lifecycle, remove Inkscape path detection"
```

---

## Task 7: Update `src/preload/index.js`

**Files:**
- Modify: `src/preload/index.js`

Remove the `checkInkscapeVersion` bridge — the IPC handler was removed in Task 6 and this entry is now dead code.

- [ ] **Step 1: Remove `checkInkscapeVersion` from the preload**

In `src/preload/index.js`, delete this line:

```js
  checkInkscapeVersion: (data) => ipcRenderer.invoke('check-inkscape-version', data),
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --reporter=verbose
```

Expected: ALL tests pass (preload is not unit-tested).

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.js
git commit -m "chore: remove checkInkscapeVersion from preload bridge"
```

---

## Task 8: UI cleanup — delete `InkscapeBanner`, update `App.jsx`, update `Settings.jsx`

**Files:**
- Delete: `src/renderer/src/components/InkscapeBanner.jsx`
- Modify: `src/renderer/src/App.jsx`
- Modify: `src/renderer/src/components/Settings.jsx`

- [ ] **Step 1: Delete `InkscapeBanner.jsx`**

```bash
git rm src/renderer/src/components/InkscapeBanner.jsx
```

- [ ] **Step 2: Update `App.jsx` — remove InkscapeBanner import and usage**

Replace the entire contents of `src/renderer/src/App.jsx` with:

```jsx
import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { useApp } from './context/AppContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toolbar from './components/Toolbar.jsx'
import ClipboardArea from './components/ClipboardArea.jsx'
import ClipGrid from './components/ClipGrid.jsx'
import StatusBar from './components/StatusBar.jsx'
import Settings from './components/Settings.jsx'

export default function App() {
  const { state } = useApp()
  const [screen, setScreen] = useState('main')

  useEffect(() => {
    return window.electronAPI.onNavigateTo((s) => {
      if (s === 'settings') setScreen('settings')
    })
  }, [])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground select-none overflow-hidden">
      {/* Title bar */}
      <div className="h-10 flex items-center justify-center border-b border-border app-region-drag shrink-0">
        <span className="text-xs font-medium text-muted-foreground app-region-no-drag">
          SchematicClip
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar screen={screen} onNavigate={setScreen} />

        <div className="flex flex-col flex-1 overflow-hidden">
          {screen === 'main' ? (
            <>
              <Toolbar />
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <ClipboardArea />
                <ClipGrid />
              </div>
              <StatusBar />
            </>
          ) : (
            <Settings onBack={() => setScreen('main')} />
          )}
        </div>
      </div>

      <Toaster richColors position="bottom-center" />
    </div>
  )
}
```

- [ ] **Step 3: Update `Settings.jsx` — remove the Inkscape section**

Replace the entire contents of `src/renderer/src/components/Settings.jsx` with:

```jsx
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useApp } from '../context/AppContext.jsx'

const PROJECT_COLORS = ['#2f81f7', '#27c93f', '#ff9f43', '#e74c3c', '#9b59b6', '#1abc9c']

function BehaviorRow({ label, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-[12.5px] font-medium">{label}</p>
        <p className="text-[10.5px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="app-region-no-drag shrink-0" />
    </div>
  )
}

export default function Settings({ onBack }) {
  const { state, actions } = useApp()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [launchOnStartup, setLaunchOnStartup] = useState(false)

  // Load OS login-item state on mount
  useEffect(() => {
    window.electronAPI.getLoginItemSettings()
      .then(({ openAtLogin }) => setLaunchOnStartup(openAtLogin))
      .catch(() => setLaunchOnStartup(false))
  }, [])

  async function handleLaunchOnStartup(value) {
    setLaunchOnStartup(value)
    await window.electronAPI.setLoginItemSettings({ openAtLogin: value })
  }

  function openAdd() {
    setForm({ id: crypto.randomUUID(), name: '', prefix: '', outputDir: '', counter: 0, color: PROJECT_COLORS[0] })
    setEditingId('new')
  }

  function openEdit(project) {
    setForm({ ...project })
    setEditingId(project.id)
  }

  async function submitForm() {
    if (!form.name || !form.prefix || !form.outputDir) return
    if (editingId === 'new') {
      await actions.addProject(form)
    } else {
      await actions.updateProject(editingId, { name: form.name, prefix: form.prefix, outputDir: form.outputDir, color: form.color })
    }
    setEditingId(null)
    setForm(null)
  }

  async function chooseDir() {
    const result = await window.electronAPI.chooseDirectory()
    if (!result.canceled) setForm((f) => ({ ...f, outputDir: result.path }))
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="app-region-no-drag h-7 px-2 text-xs text-muted-foreground gap-1"
        >
          <ArrowLeft size={14} /> Voltar
        </Button>
        <h2 className="text-sm font-semibold">Configurações</h2>
      </div>

      <div className="p-5 flex flex-col gap-6 max-w-2xl">

        {/* Projects section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Projetos</p>

          <div className="flex flex-col gap-2">
            {state.projects.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 p-2.5 rounded-md border',
                  p.id === state.activeProjectId
                    ? 'bg-accent border-primary/30'
                    : 'bg-card border-border'
                )}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium truncate">{p.name}</span>
                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4">
                      {p.prefix}
                    </Badge>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground truncate">{p.outputDir || 'Sem pasta'}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil size={11} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-destructive hover:text-destructive"
                    onClick={() => actions.deleteProject(p.id)}
                  >
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add / Edit form */}
            {editingId ? (
              <div className="border border-primary rounded-md p-3 bg-accent/30 flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10.5px]">Nome do projeto</Label>
                    <Input
                      className="h-7 text-xs"
                      placeholder="Motor BLDC"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10.5px]">Prefixo</Label>
                    <Input
                      className="h-7 text-xs"
                      placeholder="BLDC_"
                      value={form.prefix}
                      onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10.5px]">Pasta de saída</Label>
                  <div className="flex gap-1.5">
                    <Input
                      className="h-7 text-xs flex-1"
                      placeholder="D:\Projetos\..."
                      value={form.outputDir}
                      onChange={(e) => setForm((f) => ({ ...f, outputDir: e.target.value }))}
                    />
                    <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={chooseDir}>
                      <FolderOpen size={12} className="mr-1" /> Explorar
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10.5px]">Cor</Label>
                  <div className="flex gap-2 mt-0.5">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className="w-5 h-5 rounded-full border-2 transition-all"
                        style={{ background: c, borderColor: form.color === c ? 'hsl(var(--foreground))' : 'transparent' }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="h-7 text-xs" onClick={submitForm}>
                    {editingId === 'new' ? 'Adicionar' : 'Salvar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setEditingId(null); setForm(null) }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={openAdd}
                className="border-dashed justify-start gap-2 text-xs text-muted-foreground h-9"
              >
                <Plus size={13} /> Adicionar projeto
              </Button>
            )}
          </div>
        </section>

        <Separator />

        {/* Comportamento section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Comportamento</p>
          <div className="flex flex-col divide-y divide-border">
            <BehaviorRow
              label="Iniciar com o Windows"
              description="Inicia automaticamente ao fazer login"
              checked={launchOnStartup}
              onCheckedChange={handleLaunchOnStartup}
            />
            <BehaviorRow
              label="Iniciar minimizado"
              description="Abre sem exibir a janela (apenas bandeja)"
              checked={state.settings.startMinimized ?? false}
              onCheckedChange={(v) => actions.updateSettings({ startMinimized: v })}
            />
            <BehaviorRow
              label="Botão fechar oculta o app"
              description="× mantém o app rodando na bandeja do sistema"
              checked={state.settings.closeHides ?? true}
              onCheckedChange={(v) => actions.updateSettings({ closeHides: v })}
            />
          </div>
        </section>

        <Separator />

        {/* Aparência section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Aparência</p>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10.5px]">Tema</Label>
            <Select
              value={state.settings.theme ?? 'system'}
              onValueChange={(value) => actions.updateSettings({ theme: value })}
            >
              <SelectTrigger className="h-7 text-xs w-56 app-region-no-drag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Sistema (padrão)</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="snnabb">Snnabb</SelectItem>
                <SelectItem value="charcoal">Charcoal</SelectItem>
                <SelectItem value="black-moon">Black Moon</SelectItem>
                <SelectItem value="blue-moon">Blue Moon</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10.5px] text-muted-foreground mt-1">
              "Sistema" segue automaticamente a configuração do Windows.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --reporter=verbose
```

Expected: ALL tests pass.

- [ ] **Step 5: Start the dev server and do a quick visual check**

```bash
npm run dev
```

Verify:
- App opens without errors in the console
- Settings panel has no "Inkscape" section — only Projetos, Comportamento, Aparência
- No amber InkscapeBanner appears at the top

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/App.jsx src/renderer/src/components/Settings.jsx src/renderer/src/components/InkscapeBanner.jsx
git commit -m "feat: remove InkscapeBanner and Inkscape settings section — Inkscape is now bundled"
```

---

## Task 9: End-to-end manual verification

**Files:** None — manual verification only.

- [ ] **Step 1: Verify dev mode conversion works**

With the dev server running (`npm run dev`):

1. Open KiCad (or any EDA tool) and copy a schematic to the clipboard
2. In SchematicClip, click **Colar Esquemático**
3. Expected: conversion completes in ~200 ms, preview appears
4. Click **Salvar** — SVG saved to the project folder

- [ ] **Step 2: Verify BUSY guard**

1. Trigger a conversion
2. While conversion is in progress, click **Colar Esquemático** again immediately
3. Expected: second click is ignored (button is disabled during conversion, or `BUSY` is returned silently)

- [ ] **Step 3: Build the production package**

```bash
npm run build:unpack
```

Expected: completes without errors. Check that `dist/win-unpacked/resources/inkscape/bin/inkscape.exe` exists.

- [ ] **Step 4: Run the built app**

Launch `dist/win-unpacked/SchematicClip.exe`. Perform a full conversion (copy from EDA → paste in SchematicClip → save). Expected: works identically to dev mode, ~200 ms conversion, no external Inkscape required.

- [ ] **Step 5: Final commit (if any cleanup needed)**

If no changes were needed: no commit required. If minor fixes were applied:

```bash
git add -A
git commit -m "fix: e2e verification fixes"
```
