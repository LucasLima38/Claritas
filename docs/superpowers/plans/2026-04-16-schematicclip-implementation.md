# SchematicClip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop Electron app that captures EMF clipboard data from Altium Designer, converts it to SVG via Inkscape CLI, shows a preview for confirmation, and saves with a configurable prefix + sequential filename.

**Architecture:** Electron main process hosts 5 focused services (ClipboardService, ConversionService, SaveService, ProjectStore, TrayManager) wired together via IPC. React renderer handles all UI via a context-based state machine (Idle → Converting → Preview → Saving → Error). Inkscape is called as a CLI subprocess — no custom EMF parsing.

**Tech Stack:** Electron (latest), React 18, Vite (electron-vite), Tailwind CSS 3 (dark mode via `class`), lucide-react, electron-store, electron-builder, Vitest.

---

## File Map

```
schematicclip/
├── src/
│   ├── main/
│   │   ├── index.js                   # App lifecycle, BrowserWindow, IPC wiring
│   │   ├── clipboardService.js        # Reads CF_ENHMETAFILE from Windows clipboard
│   │   ├── conversionService.js       # Inkscape path detection + EMF→SVG conversion
│   │   ├── saveService.js             # Sequential filename generation + disk write
│   │   ├── projectStore.js            # electron-store wrapper (projects/settings/history)
│   │   └── tray.js                    # System tray icon + context menu
│   ├── preload/
│   │   └── index.js                   # Secure IPC bridge (contextBridge)
│   └── renderer/
│       └── src/
│           ├── main.jsx               # React entry point, theme init
│           ├── App.jsx                # Root layout: sidebar + main area + settings
│           ├── context/
│           │   └── AppContext.jsx     # useReducer state machine + IPC listeners
│           └── components/
│               ├── Sidebar.jsx        # Project list, active project switch
│               ├── Toolbar.jsx        # Paste button, output folder display
│               ├── ClipboardArea.jsx  # Drop zone (idle) or PreviewArea (preview)
│               ├── PreviewArea.jsx    # SVG preview, metadata, Save/Discard
│               ├── ClipGrid.jsx       # Session history thumbnails
│               ├── StatusBar.jsx      # Live indicator, SVG count, next filename
│               ├── Settings.jsx       # Project CRUD + Inkscape config
│               ├── Toast.jsx          # Transient error/success notifications
│               └── InkscapeBanner.jsx # Persistent banner when Inkscape not found
├── tests/
│   └── main/
│       ├── clipboardService.test.js
│       ├── conversionService.test.js
│       ├── saveService.test.js
│       └── projectStore.test.js
├── assets/
│   └── icon.png                       # 256×256 app icon (tray + window)
├── electron.vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── electron-builder.yml
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `electron.vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`

- [ ] **Step 1: Scaffold with electron-vite**

```bash
cd "C:\Users\vieir\OneDrive\documentos\Claude\Projects\SchematicClip"
npm create electron-vite@latest . -- --template react
```

When prompted for project name, use `schematicclip`. When asked to overwrite — choose **yes** (the directory only has the `docs/` and `.git/` folders).

Expected output: `Done. Now run: npm install && npm run dev`

- [ ] **Step 2: Install all project dependencies**

```bash
npm install
npm install lucide-react
npm install electron-store
npm install -D tailwindcss postcss autoprefixer vitest @vitest/coverage-v8
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind for dark mode + renderer paths**

Replace the content of `tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/renderer/src/**/*.{js,jsx,html}', './src/renderer/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Add Tailwind directives to renderer CSS**

Replace `src/renderer/src/assets/main.css` (or create `src/renderer/src/index.css`) with:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
```

Import it in `src/renderer/src/main.jsx`:

```jsx
import './index.css'
```

- [ ] **Step 5: Configure Vitest in `electron.vite.config.js`**

Open `electron.vite.config.js` and add a `test` block:

```js
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: { rollupOptions: { external: ['electron-store'] } }
  },
  preload: {
    build: { rollupOptions: { external: ['electron-store'] } }
  },
  renderer: {
    plugins: [react()],
    test: {
      // Vitest config lives here for renderer tests (not used yet)
    }
  }
})
```

Create a separate `vitest.config.js` at the root for main process tests:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: true,
  },
})
```

- [ ] **Step 6: Add Inter font import and update `src/renderer/index.html`**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SchematicClip</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `assets/icon.png` placeholder**

Create a minimal 256×256 PNG icon. For now, copy any 256×256 PNG to `assets/icon.png`. It will be replaced before packaging. If you don't have one handy:

```bash
# PowerShell: create a simple colored square as placeholder
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.FillRectangle([System.Drawing.Brushes]::SteelBlue, 0, 0, 256, 256)
$bmp.Save("assets/icon.png")
$g.Dispose(); $bmp.Dispose()
```

- [ ] **Step 8: Add npm scripts to `package.json`**

Open `package.json` and ensure the `scripts` block contains:

```json
"scripts": {
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "preview": "electron-vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "dist": "npm run build && electron-builder"
}
```

- [ ] **Step 9: Verify the scaffold runs**

```bash
npm run dev
```

Expected: Electron window opens showing the default React template. Close it.

- [ ] **Step 10: Commit scaffold**

```bash
git add -A
git commit -m "feat: scaffold Electron+React+Vite+Tailwind project"
```

---

## Task 2: ProjectStore

**Files:**
- Create: `src/main/projectStore.js`
- Create: `tests/main/projectStore.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/projectStore.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock electron-store before importing ProjectStore
vi.mock('electron-store', () => {
  const Store = vi.fn().mockImplementation(() => {
    const data = {}
    return {
      get: vi.fn((key, defaultVal) => (key in data ? data[key] : defaultVal)),
      set: vi.fn((key, val) => { data[key] = val }),
      get store() { return data },
    }
  })
  return { default: Store }
})

// Also mock electron app for AppData path
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/test-appdata') }
}))

const { ProjectStore } = await import('../../src/main/projectStore.js')

describe('ProjectStore', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    store = new ProjectStore()
  })

  it('returns empty projects array by default', () => {
    expect(store.getProjects()).toEqual([])
  })

  it('adds a project', () => {
    const project = { id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 1, color: '#fff' }
    store.addProject(project)
    expect(store.getProjects()).toHaveLength(1)
    expect(store.getProjects()[0].id).toBe('p1')
  })

  it('returns active project', () => {
    const project = { id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 1, color: '#fff' }
    store.addProject(project)
    store.setActiveProject('p1')
    expect(store.getActiveProject().id).toBe('p1')
  })

  it('updates a project', () => {
    store.addProject({ id: 'p1', name: 'Old', prefix: 'O_', outputDir: '/tmp', counter: 1, color: '#fff' })
    store.updateProject('p1', { name: 'New', prefix: 'N_' })
    expect(store.getProjects()[0].name).toBe('New')
    expect(store.getProjects()[0].prefix).toBe('N_')
  })

  it('deletes a project', () => {
    store.addProject({ id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 1, color: '#fff' })
    store.deleteProject('p1')
    expect(store.getProjects()).toHaveLength(0)
  })

  it('increments counter and returns new value', () => {
    store.addProject({ id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 2, color: '#fff' })
    const next = store.incrementCounter('p1')
    expect(next).toBe(3)
    expect(store.getProjects()[0].counter).toBe(3)
  })

  it('throws when incrementing counter for unknown project', () => {
    expect(() => store.incrementCounter('nonexistent')).toThrow('not found')
  })

  it('initSession clears history entries', () => {
    store.addHistoryEntry({ id: '1', filename: 'test.svg', fullPath: '/tmp/test.svg', projectId: 'p1', timestamp: '', sizeBytes: 100 })
    store.initSession()
    expect(store.getHistory()).toHaveLength(0)
  })

  it('addHistoryEntry stores entry', () => {
    const entry = { id: '1', filename: 'BLDC_001.svg', fullPath: '/tmp/BLDC_001.svg', projectId: 'p1', timestamp: '2026-01-01T00:00:00Z', sizeBytes: 48000 }
    store.addHistoryEntry(entry)
    expect(store.getHistory()).toHaveLength(1)
    expect(store.getHistory()[0].filename).toBe('BLDC_001.svg')
  })

  it('getSettings returns defaults when unset', () => {
    const settings = store.getSettings()
    expect(settings.conversionTimeout).toBe(15000)
    expect(settings.startMinimized).toBe(false)
  })

  it('updateSettings persists changes', () => {
    store.updateSettings({ inkscapePath: 'C:\\inkscape.exe' })
    expect(store.getSettings().inkscapePath).toBe('C:\\inkscape.exe')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/projectStore.test.js
```

Expected: Multiple FAIL — `Cannot find module '../../src/main/projectStore.js'`

- [ ] **Step 3: Implement `src/main/projectStore.js`**

```js
import Store from 'electron-store'

const PROJECT_DEFAULTS = {
  projects: [],
  activeProjectId: null,
}

const SETTINGS_DEFAULTS = {
  inkscapePath: null,
  conversionTimeout: 15000,
  startMinimized: false,
}

export class ProjectStore {
  constructor() {
    this._projects = new Store({ name: 'projects', defaults: PROJECT_DEFAULTS })
    this._settings = new Store({ name: 'settings', defaults: SETTINGS_DEFAULTS })
    this._history = new Store({ name: 'history', defaults: { entries: [] } })
  }

  // ── Session ──────────────────────────────────────────────────────────────

  initSession() {
    this._history.set('entries', [])
  }

  // ── Projects ─────────────────────────────────────────────────────────────

  getProjects() {
    return this._projects.get('projects', [])
  }

  getActiveProjectId() {
    return this._projects.get('activeProjectId', null)
  }

  getActiveProject() {
    const id = this.getActiveProjectId()
    const projects = this.getProjects()
    return projects.find((p) => p.id === id) ?? projects[0] ?? null
  }

  setActiveProject(id) {
    this._projects.set('activeProjectId', id)
  }

  addProject(project) {
    const projects = this.getProjects()
    projects.push(project)
    this._projects.set('projects', projects)
  }

  updateProject(id, updates) {
    const projects = this.getProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Project ${id} not found`)
    projects[idx] = { ...projects[idx], ...updates }
    this._projects.set('projects', projects)
  }

  deleteProject(id) {
    const projects = this.getProjects().filter((p) => p.id !== id)
    this._projects.set('projects', projects)
    if (this.getActiveProjectId() === id) {
      this._projects.set('activeProjectId', projects[0]?.id ?? null)
    }
  }

  incrementCounter(projectId) {
    const project = this.getProjects().find((p) => p.id === projectId)
    if (!project) throw new Error(`Project ${projectId} not found`)
    const newCounter = project.counter + 1
    this.updateProject(projectId, { counter: newCounter })
    return newCounter
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  getSettings() {
    return {
      inkscapePath: this._settings.get('inkscapePath', null),
      conversionTimeout: this._settings.get('conversionTimeout', 15000),
      startMinimized: this._settings.get('startMinimized', false),
    }
  }

  updateSettings(updates) {
    for (const [key, value] of Object.entries(updates)) {
      this._settings.set(key, value)
    }
  }

  // ── History ───────────────────────────────────────────────────────────────

  addHistoryEntry(entry) {
    const entries = this._history.get('entries', [])
    entries.push(entry)
    this._history.set('entries', entries)
  }

  getHistory() {
    return this._history.get('entries', [])
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/projectStore.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/projectStore.js tests/main/projectStore.test.js
git commit -m "feat: add ProjectStore with full test coverage"
```

---

## Task 3: ClipboardService

**Files:**
- Create: `src/main/clipboardService.js`
- Create: `tests/main/clipboardService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/clipboardService.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockClipboard = {
  availableFormats: vi.fn(),
  readBuffer: vi.fn(),
}

vi.mock('electron', () => ({
  clipboard: mockClipboard,
}))

const { readEMF, hasEMF } = await import('../../src/main/clipboardService.js')

describe('ClipboardService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('hasEMF()', () => {
    it('returns true when CF_ENHMETAFILE is available', () => {
      mockClipboard.availableFormats.mockReturnValue(['text/plain', 'CF_ENHMETAFILE'])
      expect(hasEMF()).toBe(true)
    })

    it('returns false when clipboard has no EMF', () => {
      mockClipboard.availableFormats.mockReturnValue(['text/plain', 'image/png'])
      expect(hasEMF()).toBe(false)
    })

    it('returns false when clipboard is empty', () => {
      mockClipboard.availableFormats.mockReturnValue([])
      expect(hasEMF()).toBe(false)
    })
  })

  describe('readEMF()', () => {
    it('returns Buffer when EMF is available', () => {
      const fakeBuffer = Buffer.from([0x01, 0x02, 0x03])
      mockClipboard.availableFormats.mockReturnValue(['CF_ENHMETAFILE'])
      mockClipboard.readBuffer.mockReturnValue(fakeBuffer)
      const result = readEMF()
      expect(result).toBe(fakeBuffer)
      expect(mockClipboard.readBuffer).toHaveBeenCalledWith('CF_ENHMETAFILE')
    })

    it('returns null when no EMF on clipboard', () => {
      mockClipboard.availableFormats.mockReturnValue(['text/plain'])
      const result = readEMF()
      expect(result).toBeNull()
      expect(mockClipboard.readBuffer).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/clipboardService.test.js
```

Expected: FAIL — `Cannot find module '../../src/main/clipboardService.js'`

- [ ] **Step 3: Implement `src/main/clipboardService.js`**

```js
import { clipboard } from 'electron'

const EMF_FORMAT = 'CF_ENHMETAFILE'

/**
 * Returns true if the Windows clipboard currently holds EMF vector data.
 */
export function hasEMF() {
  return clipboard.availableFormats().includes(EMF_FORMAT)
}

/**
 * Reads the EMF bytes from the clipboard.
 * Returns a Buffer, or null if no EMF data is present.
 */
export function readEMF() {
  if (!hasEMF()) return null
  return clipboard.readBuffer(EMF_FORMAT)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/clipboardService.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/clipboardService.js tests/main/clipboardService.test.js
git commit -m "feat: add ClipboardService — reads CF_ENHMETAFILE"
```

---

## Task 4: ConversionService

**Files:**
- Create: `src/main/conversionService.js`
- Create: `tests/main/conversionService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/conversionService.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// ── fs mock ──────────────────────────────────────────────────────────────
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    promises: {
      ...actual.promises,
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'),
      unlink: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockResolvedValue(undefined),
    },
    existsSync: vi.fn().mockReturnValue(true),
  }
})

// ── child_process mock ───────────────────────────────────────────────────
const mockSpawn = vi.fn()
vi.mock('child_process', () => ({ spawn: mockSpawn }))

// ── electron mock ────────────────────────────────────────────────────────
vi.mock('electron', () => ({ app: { getPath: vi.fn() } }))

function makeFakeProcess(exitCode = 0, delay = 10) {
  const proc = new EventEmitter()
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  setTimeout(() => proc.emit('close', exitCode), delay)
  return proc
}

const { findInkscape, convert, isValidSVG } = await import('../../src/main/conversionService.js')

describe('ConversionService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('isValidSVG()', () => {
    it('returns true for valid SVG with content', () => {
      expect(isValidSVG('<svg xmlns="..."><rect x="0" y="0"/></svg>')).toBe(true)
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

  describe('findInkscape()', () => {
    it('returns path when default location exists', async () => {
      const { promises: fsp, existsSync } = await import('fs')
      existsSync.mockImplementation((p) => p.includes('inkscape.exe'))
      const result = findInkscape()
      expect(result).toContain('inkscape.exe')
    })

    it('returns null when no Inkscape found', async () => {
      const { existsSync } = await import('fs')
      existsSync.mockReturnValue(false)
      // suppress registry query failure
      const result = findInkscape()
      expect(result).toBeNull()
    })
  })

  describe('convert()', () => {
    it('resolves with SVG string on success', async () => {
      mockSpawn.mockReturnValue(makeFakeProcess(0))
      const emfBuffer = Buffer.from([0x01])
      const svg = await convert(emfBuffer, 'C:\\inkscape.exe')
      expect(svg).toContain('<svg')
    })

    it('rejects with TIMEOUT error when Inkscape hangs', async () => {
      const proc = makeFakeProcess(0, 99999) // never closes in time
      proc.kill = vi.fn()
      mockSpawn.mockReturnValue(proc)
      await expect(convert(Buffer.from([0x01]), 'C:\\inkscape.exe', 50))
        .rejects.toThrow('TIMEOUT')
      expect(proc.kill).toHaveBeenCalled()
    })

    it('rejects when Inkscape exits with non-zero code', async () => {
      mockSpawn.mockReturnValue(makeFakeProcess(1))
      await expect(convert(Buffer.from([0x01]), 'C:\\inkscape.exe'))
        .rejects.toThrow('code 1')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/conversionService.test.js
```

Expected: FAIL — `Cannot find module '../../src/main/conversionService.js'`

- [ ] **Step 3: Implement `src/main/conversionService.js`**

```js
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

// Default Inkscape install locations on Windows
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
  // 1. Check known default paths
  for (const p of INKSCAPE_DEFAULT_PATHS) {
    if (fs.existsSync(p)) return p
  }

  // 2. Try Windows registry
  try {
    const regOutput = execSync(
      'reg query "HKLM\\SOFTWARE\\Inkscape" /ve',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const match = regOutput.match(/REG_SZ\s+(.+)/)
    if (match) {
      const dir = match[1].trim()
      const candidate = path.join(dir, 'bin', 'inkscape.exe')
      if (fs.existsSync(candidate)) return candidate
    }
  } catch {
    // Registry not available or key missing — not an error
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

  await fs.promises.writeFile(emfPath, emfBuffer)

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

    return await fs.promises.readFile(svgPath, 'utf8')
  } finally {
    // Always clean up temp files
    await fs.promises.unlink(emfPath).catch(() => {})
    await fs.promises.unlink(svgPath).catch(() => {})
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/conversionService.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/conversionService.js tests/main/conversionService.test.js
git commit -m "feat: add ConversionService — Inkscape CLI EMF→SVG pipeline"
```

---

## Task 5: SaveService

**Files:**
- Create: `src/main/saveService.js`
- Create: `tests/main/saveService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/saveService.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockResolvedValue(undefined),
    },
  }
})

const { generateFilename, saveSVG, checkOutputDir } = await import('../../src/main/saveService.js')

describe('SaveService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('generateFilename()', () => {
    it('pads counter to 3 digits', () => {
      expect(generateFilename('BLDC_', 1)).toBe('BLDC_001.svg')
      expect(generateFilename('BLDC_', 12)).toBe('BLDC_012.svg')
      expect(generateFilename('BLDC_', 123)).toBe('BLDC_123.svg')
    })

    it('handles prefix without trailing underscore', () => {
      expect(generateFilename('RF', 5)).toBe('RF005.svg')
    })

    it('handles counter over 999', () => {
      expect(generateFilename('BLDC_', 1000)).toBe('BLDC_1000.svg')
    })
  })

  describe('saveSVG()', () => {
    it('writes SVG to the correct path', async () => {
      const { promises: fsp } = await import('fs')
      const fullPath = await saveSVG('<svg/>', 'D:\\docs', 'BLDC_001.svg')
      expect(fsp.mkdir).toHaveBeenCalledWith('D:\\docs', { recursive: true })
      expect(fsp.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('BLDC_001.svg'),
        '<svg/>',
        'utf8'
      )
      expect(fullPath).toContain('BLDC_001.svg')
    })

    it('throws EACCES when writeFile rejects with permission error', async () => {
      const { promises: fsp } = await import('fs')
      const err = new Error('permission denied')
      err.code = 'EACCES'
      fsp.writeFile.mockRejectedValue(err)
      await expect(saveSVG('<svg/>', 'C:\\Windows\\System32', 'test.svg'))
        .rejects.toThrow('EACCES')
    })
  })

  describe('checkOutputDir()', () => {
    it('returns { exists: true } when directory is accessible', async () => {
      const { promises: fsp } = await import('fs')
      fsp.access.mockResolvedValue(undefined)
      const result = await checkOutputDir('D:\\docs')
      expect(result.exists).toBe(true)
    })

    it('returns { exists: false } when directory is missing', async () => {
      const { promises: fsp } = await import('fs')
      fsp.access.mockRejectedValue(new Error('ENOENT'))
      const result = await checkOutputDir('D:\\nonexistent')
      expect(result.exists).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/saveService.test.js
```

Expected: FAIL — `Cannot find module '../../src/main/saveService.js'`

- [ ] **Step 3: Implement `src/main/saveService.js`**

```js
import fs from 'fs'
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
 * Returns { exists: boolean }.
 */
export async function checkOutputDir(dir) {
  try {
    await fs.promises.access(dir)
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
  await fs.promises.mkdir(outputDir, { recursive: true })
  const fullPath = path.join(outputDir, filename)
  await fs.promises.writeFile(fullPath, svgContent, 'utf8')
  return fullPath
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/saveService.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Run all tests together**

```bash
npm test
```

Expected: All test suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/saveService.js tests/main/saveService.test.js
git commit -m "feat: add SaveService — sequential filenames and disk write"
```

---

## Task 6: TrayManager

**Files:**
- Create: `src/main/tray.js`

No unit tests for tray — it wraps Electron APIs that require a running app.

- [ ] **Step 1: Implement `src/main/tray.js`**

```js
import { Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let tray = null

/**
 * Creates the system tray icon and initial context menu.
 * @param {BrowserWindow} mainWindow
 * @param {ProjectStore} projectStore
 */
export function createTray(mainWindow, projectStore) {
  const iconPath = path.join(__dirname, '../../assets/icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('SchematicClip')
  updateTrayMenu(mainWindow, projectStore)

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  return tray
}

/**
 * Rebuilds the tray context menu from current project state.
 * Call this whenever the active project changes.
 */
export function updateTrayMenu(mainWindow, projectStore) {
  if (!tray) return

  const projects = projectStore.getProjects()
  const activeId = projectStore.getActiveProjectId()

  const projectItems = projects.map((p) => ({
    label: p.name,
    type: 'radio',
    checked: p.id === activeId,
    click: () => {
      projectStore.setActiveProject(p.id)
      updateTrayMenu(mainWindow, projectStore)
      mainWindow.webContents.send('projects-updated', {
        projects: projectStore.getProjects(),
        activeProjectId: p.id,
      })
    },
  }))

  const menu = Menu.buildFromTemplate([
    {
      label: 'SchematicClip',
      enabled: false,
    },
    { type: 'separator' },
    ...projectItems,
    { type: 'separator' },
    {
      label: 'Abrir janela',
      click: () => { mainWindow.show(); mainWindow.focus() },
    },
    {
      label: 'Configurações',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate-to', 'settings')
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        tray.destroy()
        mainWindow.destroy()
      },
    },
  ])

  tray.setContextMenu(menu)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/tray.js
git commit -m "feat: add TrayManager — system tray icon and project switcher"
```

---

## Task 7: Main Process Entry Point + IPC Wiring

**Files:**
- Modify: `src/main/index.js` (replace scaffold content entirely)

- [ ] **Step 1: Replace `src/main/index.js` with full implementation**

```js
import { app, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { ProjectStore } from './projectStore.js'
import { readEMF, hasEMF } from './clipboardService.js'
import { convert, findInkscape, isValidSVG, getSVGMetadata } from './conversionService.js'
import { generateFilename, saveSVG, checkOutputDir } from './saveService.js'
import { createTray, updateTrayMenu } from './tray.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── State ─────────────────────────────────────────────────────────────────

const store = new ProjectStore()
let mainWindow = null
let tray = null
// Holds the last converted SVG waiting for user confirmation
let pendingSVG = null   // { svgContent: string, metadata: object }

// ── Window ────────────────────────────────────────────────────────────────

function createWindow() {
  store.initSession()

  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 760,
    minHeight: 500,
    frame: false,         // We'll add a custom titlebar in React
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#ffffff',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#e6e6e3' : '#37352f',
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow.hide()
  })

  return mainWindow
}

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  mainWindow = createWindow()
  tray = createTray(mainWindow, store)

  // Auto-detect Inkscape if not yet configured
  const settings = store.getSettings()
  if (!settings.inkscapePath) {
    const found = findInkscape()
    if (found) store.updateSettings({ inkscapePath: found })
  }

  // Send initial theme
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('theme-changed', {
      isDark: nativeTheme.shouldUseDarkColors,
    })
    mainWindow.webContents.send('init', {
      projects: store.getProjects(),
      activeProjectId: store.getActiveProjectId(),
      settings: store.getSettings(),
      history: store.getHistory(),
    })
  })
})

app.on('window-all-closed', () => {
  // Keep running in tray — don't quit
})

// Track theme changes from Windows
nativeTheme.on('updated', () => {
  mainWindow?.webContents.send('theme-changed', {
    isDark: nativeTheme.shouldUseDarkColors,
  })
})

// ── IPC Handlers ──────────────────────────────────────────────────────────

// Called when user presses Ctrl+V or clicks the Paste button
ipcMain.handle('paste-schematic', async () => {
  const emfBuffer = readEMF()
  if (!emfBuffer) {
    return { error: 'NO_EMF', message: 'Nenhum esquemático vetorial encontrado no clipboard.' }
  }

  const settings = store.getSettings()
  if (!settings.inkscapePath) {
    return { error: 'INKSCAPE_NOT_FOUND', message: 'Inkscape não encontrado. Configure o caminho nas configurações.' }
  }

  const startTime = Date.now()

  try {
    const svgContent = await convert(emfBuffer, settings.inkscapePath, settings.conversionTimeout)

    if (!isValidSVG(svgContent)) {
      return { error: 'INVALID_SVG', message: 'Conversão incompleta — o SVG gerado está em branco. Verifique o Inkscape.' }
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

// Called when user clicks "Salvar"
ipcMain.handle('save-svg', async (_event, { projectId }) => {
  if (!pendingSVG) return { error: 'NO_PENDING', message: 'Nenhum SVG aguardando confirmação.' }

  const project = store.getProjects().find((p) => p.id === projectId)
  if (!project) return { error: 'PROJECT_NOT_FOUND', message: 'Projeto não encontrado.' }

  const dirCheck = await checkOutputDir(project.outputDir)
  if (!dirCheck.exists) {
    return { error: 'DIR_NOT_FOUND', outputDir: project.outputDir }
  }

  const filename = generateFilename(project.prefix, project.counter + 1)

  try {
    const fullPath = await saveSVG(pendingSVG.svgContent, project.outputDir, filename)
    const newCounter = store.incrementCounter(projectId)

    const entry = {
      id: crypto.randomUUID(),
      filename,
      fullPath,
      projectId,
      timestamp: new Date().toISOString(),
      sizeBytes: pendingSVG.metadata.sizeBytes,
    }
    store.addHistoryEntry(entry)
    pendingSVG = null

    updateTrayMenu(mainWindow, store)
    return { ok: true, filename, fullPath, entry, newCounter }
  } catch (err) {
    if (err.code === 'EACCES') {
      return { error: 'EACCES', message: 'Sem permissão de escrita na pasta de destino.' }
    }
    return { error: 'ERROR', message: err.message }
  }
})

// Called when user clicks "Descartar"
ipcMain.handle('discard-svg', async () => {
  pendingSVG = null
  return { ok: true }
})

// Called when user confirms creating a missing directory
ipcMain.handle('create-output-dir', async (_event, { dir }) => {
  try {
    const { promises: fsp } = await import('fs')
    await fsp.mkdir(dir, { recursive: true })
    return { ok: true }
  } catch (err) {
    return { error: 'ERROR', message: err.message }
  }
})

// Projects
ipcMain.handle('get-projects', () => ({
  projects: store.getProjects(),
  activeProjectId: store.getActiveProjectId(),
}))

ipcMain.handle('set-active-project', (_event, { id }) => {
  store.setActiveProject(id)
  updateTrayMenu(mainWindow, store)
  return { ok: true }
})

ipcMain.handle('add-project', (_event, project) => {
  store.addProject(project)
  updateTrayMenu(mainWindow, store)
  return { projects: store.getProjects() }
})

ipcMain.handle('update-project', (_event, { id, updates }) => {
  store.updateProject(id, updates)
  updateTrayMenu(mainWindow, store)
  return { projects: store.getProjects() }
})

ipcMain.handle('delete-project', (_event, { id }) => {
  store.deleteProject(id)
  updateTrayMenu(mainWindow, store)
  return { projects: store.getProjects(), activeProjectId: store.getActiveProjectId() }
})

// Settings
ipcMain.handle('get-settings', () => store.getSettings())

ipcMain.handle('update-settings', (_event, updates) => {
  store.updateSettings(updates)
  return store.getSettings()
})

// File system helpers
ipcMain.handle('choose-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled) return { canceled: true }
  return { path: result.filePaths[0] }
})

// History
ipcMain.handle('get-history', () => store.getHistory())
```

- [ ] **Step 2: Verify app starts without errors**

```bash
npm run dev
```

Expected: Electron window opens. No errors in the console. Close when done.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.js
git commit -m "feat: wire main process — IPC handlers and app lifecycle"
```

---

## Task 8: Preload Script

**Files:**
- Modify: `src/preload/index.js` (replace scaffold content entirely)

- [ ] **Step 1: Replace `src/preload/index.js`**

```js
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Clipboard / conversion
  pasteSchematic: () => ipcRenderer.invoke('paste-schematic'),
  saveSVG: (data) => ipcRenderer.invoke('save-svg', data),
  discardSVG: () => ipcRenderer.invoke('discard-svg'),
  createOutputDir: (data) => ipcRenderer.invoke('create-output-dir', data),

  // Projects
  getProjects: () => ipcRenderer.invoke('get-projects'),
  setActiveProject: (data) => ipcRenderer.invoke('set-active-project', data),
  addProject: (project) => ipcRenderer.invoke('add-project', project),
  updateProject: (data) => ipcRenderer.invoke('update-project', data),
  deleteProject: (data) => ipcRenderer.invoke('delete-project', data),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (updates) => ipcRenderer.invoke('update-settings', updates),
  chooseDirectory: () => ipcRenderer.invoke('choose-directory'),

  // History
  getHistory: () => ipcRenderer.invoke('get-history'),

  // Event listeners (return cleanup function)
  onInit: (cb) => {
    ipcRenderer.on('init', (_e, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('init')
  },
  onThemeChanged: (cb) => {
    ipcRenderer.on('theme-changed', (_e, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('theme-changed')
  },
  onProjectsUpdated: (cb) => {
    ipcRenderer.on('projects-updated', (_e, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('projects-updated')
  },
  onNavigateTo: (cb) => {
    ipcRenderer.on('navigate-to', (_e, screen) => cb(screen))
    return () => ipcRenderer.removeAllListeners('navigate-to')
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.js
git commit -m "feat: expose secure IPC bridge via contextBridge"
```

---

## Task 9: App Context (State Machine)

**Files:**
- Create: `src/renderer/src/context/AppContext.jsx`

- [ ] **Step 1: Create `src/renderer/src/context/AppContext.jsx`**

```jsx
import { createContext, useContext, useReducer, useEffect } from 'react'

// ── State Shape ────────────────────────────────────────────────────────────
// status: 'idle' | 'converting' | 'preview' | 'saving' | 'error'

const initialState = {
  status: 'idle',
  svgContent: null,
  svgMetadata: null,    // { width, height, sizeBytes, conversionMs }
  error: null,          // { type, message }
  projects: [],
  activeProjectId: null,
  history: [],
  settings: {},
  toast: null,          // { message, type: 'error'|'success' } — auto-clears
}

// ── Reducer ───────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        projects: action.projects,
        activeProjectId: action.activeProjectId,
        settings: action.settings,
        history: action.history,
      }

    case 'PASTE_START':
      return { ...state, status: 'converting', error: null }

    case 'SVG_READY':
      return {
        ...state,
        status: 'preview',
        svgContent: action.svgContent,
        svgMetadata: action.metadata,
      }

    case 'CONVERSION_ERROR':
      return {
        ...state,
        status: action.toastOnly ? 'idle' : 'error',
        error: { type: action.errorType, message: action.message },
        toast: action.toastOnly ? { message: action.message, type: 'error' } : null,
      }

    case 'SAVE_START':
      return { ...state, status: 'saving' }

    case 'SAVE_SUCCESS':
      return {
        ...state,
        status: 'idle',
        svgContent: null,
        svgMetadata: null,
        history: [action.entry, ...state.history],
        projects: state.projects.map((p) =>
          p.id === action.entry.projectId
            ? { ...p, counter: action.newCounter }
            : p
        ),
        toast: { message: `Salvo: ${action.filename}`, type: 'success' },
      }

    case 'DISCARD':
      return {
        ...state,
        status: 'idle',
        svgContent: null,
        svgMetadata: null,
        error: null,
      }

    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.id }

    case 'PROJECTS_UPDATED':
      return {
        ...state,
        projects: action.projects,
        activeProjectId: action.activeProjectId ?? state.activeProjectId,
      }

    case 'SETTINGS_UPDATED':
      return { ...state, settings: action.settings }

    case 'CLEAR_TOAST':
      return { ...state, toast: null }

    case 'CLEAR_ERROR':
      return { ...state, status: 'idle', error: null }

    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // ── IPC event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const cleanups = [
      window.electronAPI.onInit((data) => dispatch({ type: 'INIT', ...data })),
      window.electronAPI.onProjectsUpdated((data) =>
        dispatch({ type: 'PROJECTS_UPDATED', ...data })
      ),
      window.electronAPI.onNavigateTo((screen) => {
        if (screen === 'settings') dispatch({ type: 'NAVIGATE', screen: 'settings' })
      }),
    ]
    return () => cleanups.forEach((fn) => fn?.())
  }, [])

  // ── Auto-clear toast after 3 seconds ────────────────────────────────────
  useEffect(() => {
    if (!state.toast) return
    const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3000)
    return () => clearTimeout(t)
  }, [state.toast])

  // ── Actions ───────────────────────────────────────────────────────────────

  const actions = {
    async paste() {
      dispatch({ type: 'PASTE_START' })
      const result = await window.electronAPI.pasteSchematic()
      if (result.ok) {
        dispatch({ type: 'SVG_READY', svgContent: result.svgContent, metadata: result.metadata })
      } else {
        const toastOnly = result.error === 'NO_EMF'
        dispatch({ type: 'CONVERSION_ERROR', errorType: result.error, message: result.message, toastOnly })
      }
    },

    async save() {
      const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
      if (!activeProject) return
      dispatch({ type: 'SAVE_START' })
      const result = await window.electronAPI.saveSVG({ projectId: state.activeProjectId })
      if (result.ok) {
        dispatch({ type: 'SAVE_SUCCESS', filename: result.filename, entry: result.entry, newCounter: result.newCounter })
      } else if (result.error === 'DIR_NOT_FOUND') {
        // Bubble up for Settings to handle
        dispatch({ type: 'CONVERSION_ERROR', errorType: 'DIR_NOT_FOUND', message: `Pasta não encontrada: ${result.outputDir}`, toastOnly: false })
      } else {
        dispatch({ type: 'CONVERSION_ERROR', errorType: result.error, message: result.message, toastOnly: false })
      }
    },

    async discard() {
      await window.electronAPI.discardSVG()
      dispatch({ type: 'DISCARD' })
    },

    async setActiveProject(id) {
      await window.electronAPI.setActiveProject({ id })
      dispatch({ type: 'SET_ACTIVE_PROJECT', id })
    },

    async addProject(project) {
      const result = await window.electronAPI.addProject(project)
      dispatch({ type: 'PROJECTS_UPDATED', projects: result.projects, activeProjectId: state.activeProjectId })
    },

    async updateProject(id, updates) {
      const result = await window.electronAPI.updateProject({ id, updates })
      dispatch({ type: 'PROJECTS_UPDATED', projects: result.projects })
    },

    async deleteProject(id) {
      const result = await window.electronAPI.deleteProject({ id })
      dispatch({ type: 'PROJECTS_UPDATED', projects: result.projects, activeProjectId: result.activeProjectId })
    },

    async updateSettings(updates) {
      const settings = await window.electronAPI.updateSettings(updates)
      dispatch({ type: 'SETTINGS_UPDATED', settings })
    },

    clearError() {
      dispatch({ type: 'CLEAR_ERROR' })
    },
  }

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/context/AppContext.jsx
git commit -m "feat: add AppContext — useReducer state machine for UI"
```

---

## Task 10: App Shell + Theme

**Files:**
- Modify: `src/renderer/src/main.jsx`
- Modify: `src/renderer/src/App.jsx`

- [ ] **Step 1: Update `src/renderer/src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import './index.css'

// Apply theme class immediately before React renders to avoid flash
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.toggle('dark', isDark)

// Listen for theme changes from main process
window.electronAPI.onThemeChanged(({ isDark }) => {
  document.documentElement.classList.toggle('dark', isDark)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
)
```

- [ ] **Step 2: Replace `src/renderer/src/App.jsx`**

```jsx
import { useState } from 'react'
import { useApp } from './context/AppContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toolbar from './components/Toolbar.jsx'
import ClipboardArea from './components/ClipboardArea.jsx'
import ClipGrid from './components/ClipGrid.jsx'
import StatusBar from './components/StatusBar.jsx'
import Settings from './components/Settings.jsx'
import Toast from './components/Toast.jsx'
import InkscapeBanner from './components/InkscapeBanner.jsx'

export default function App() {
  const { state } = useApp()
  const [screen, setScreen] = useState('main') // 'main' | 'settings'

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#1f1f1f] text-[#37352f] dark:text-[#e6e6e3] select-none overflow-hidden">
      {/* Custom title bar area — electron titleBarOverlay handles the OS controls */}
      <div className="h-10 flex items-center justify-center border-b border-[#e9e9e7] dark:border-[#2e2e2e] app-region-drag shrink-0">
        <span className="text-xs font-medium text-[#9b9a97] dark:text-[#5c5c5c]">SchematicClip</span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar screen={screen} onNavigate={setScreen} />

        <div className="flex flex-col flex-1 overflow-hidden">
          {!state.settings.inkscapePath && <InkscapeBanner onGoToSettings={() => setScreen('settings')} />}

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

      {state.toast && <Toast message={state.toast.message} type={state.toast.type} />}
    </div>
  )
}
```

Add the `app-region-drag` style to `src/renderer/src/index.css`:

```css
.app-region-drag {
  -webkit-app-region: drag;
}
.app-region-no-drag {
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/main.jsx src/renderer/src/App.jsx src/renderer/src/index.css
git commit -m "feat: add App shell with titlebar, layout, theme support"
```

---

## Task 11: Sidebar Component

**Files:**
- Create: `src/renderer/src/components/Sidebar.jsx`

- [ ] **Step 1: Create `src/renderer/src/components/Sidebar.jsx`**

```jsx
import { Settings, Clipboard, FolderOpen, Plus } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

export default function Sidebar({ screen, onNavigate }) {
  const { state, actions } = useApp()

  return (
    <div className="w-[200px] shrink-0 bg-[#fbfbfa] dark:bg-[#191919] border-r border-[#e9e9e7] dark:border-[#2e2e2e] flex flex-col py-2 overflow-hidden">
      {/* Workspace */}
      <SectionLabel>Workspace</SectionLabel>
      <SidebarItem
        icon={<Clipboard size={14} />}
        active={screen === 'main'}
        onClick={() => onNavigate('main')}
        badge={state.history.length || null}
      >
        Clipboard
      </SidebarItem>

      {/* Projects */}
      <SectionLabel className="mt-2">Projetos</SectionLabel>
      {state.projects.map((p) => (
        <SidebarItem
          key={p.id}
          icon={<span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />}
          active={p.id === state.activeProjectId && screen === 'main'}
          onClick={() => {
            actions.setActiveProject(p.id)
            onNavigate('main')
          }}
        >
          {p.name}
        </SidebarItem>
      ))}

      {state.projects.length === 0 && (
        <p className="text-[11px] text-[#9b9a97] px-3 py-1 italic">Nenhum projeto</p>
      )}

      {/* Footer */}
      <div className="mt-auto border-t border-[#e9e9e7] dark:border-[#2e2e2e] pt-2">
        <SidebarItem
          icon={<Settings size={14} />}
          active={screen === 'settings'}
          onClick={() => onNavigate('settings')}
        >
          Configurações
        </SidebarItem>
      </div>
    </div>
  )
}

function SectionLabel({ children, className = '' }) {
  return (
    <p className={`px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#9b9a97] dark:text-[#4c4c4c] mt-2 mb-0.5 ${className}`}>
      {children}
    </p>
  )
}

function SidebarItem({ icon, children, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`app-region-no-drag flex items-center gap-2 mx-1.5 px-2.5 py-1 rounded text-[12.5px] w-[calc(100%-12px)] text-left transition-colors
        ${active
          ? 'bg-[#e9e9e7] dark:bg-[#2a2a2a] font-medium text-[#37352f] dark:text-[#e6e6e3]'
          : 'text-[#37352f] dark:text-[#c7c7c3] hover:bg-[#efefee] dark:hover:bg-[#242424]'
        }`}
    >
      <span className="flex items-center justify-center w-4 shrink-0">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {badge != null && (
        <span className="bg-[#37352f] dark:bg-[#e6e6e3] text-white dark:text-[#1f1f1f] text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
          {badge}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/Sidebar.jsx
git commit -m "feat: add Sidebar — project list and navigation"
```

---

## Task 12: Toolbar + ClipboardArea

**Files:**
- Create: `src/renderer/src/components/Toolbar.jsx`
- Create: `src/renderer/src/components/ClipboardArea.jsx`

- [ ] **Step 1: Create `src/renderer/src/components/Toolbar.jsx`**

```jsx
import { Clipboard, FolderOpen, Save, X } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

export default function Toolbar() {
  const { state, actions } = useApp()
  const isPreview = state.status === 'preview'
  const isSaving = state.status === 'saving'
  const isConverting = state.status === 'converting'

  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)

  // Handle Ctrl+V globally when the window is focused
  // (attached in ClipboardArea, referenced here for paste button)

  return (
    <div className="h-10 shrink-0 border-b border-[#e9e9e7] dark:border-[#2e2e2e] flex items-center px-3.5 gap-2">
      {isPreview ? (
        <>
          <button
            onClick={actions.save}
            disabled={isSaving}
            className="app-region-no-drag h-7 px-3 rounded-md bg-[#2da44e] hover:bg-[#2c974b] text-white text-[11.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={13} />
            {isSaving ? 'Salvando...' : `Salvar ${activeProject ? generateNextName(activeProject) : ''}`}
          </button>
          <button
            onClick={actions.discard}
            disabled={isSaving}
            className="app-region-no-drag h-7 px-3 rounded-md border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[11.5px] font-medium text-[#6b6a68] dark:text-[#9b9a97] hover:bg-[#f7f7f5] dark:hover:bg-[#333] flex items-center gap-1.5 disabled:opacity-50"
          >
            <X size={13} />
            Descartar
          </button>
        </>
      ) : (
        <>
          <button
            onClick={actions.paste}
            disabled={isConverting || state.projects.length === 0}
            className="app-region-no-drag h-7 px-3 rounded-md bg-[#2f81f7] hover:bg-[#2673e0] text-white text-[11.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Clipboard size={13} />
            {isConverting ? 'Convertendo...' : 'Colar'}
            {!isConverting && (
              <span className="opacity-70 text-[10px] font-normal border border-white/30 rounded px-1">Ctrl+V</span>
            )}
          </button>
          <div className="w-px h-5 bg-[#e9e9e7] dark:bg-[#2e2e2e]" />
          <button
            className="app-region-no-drag h-7 px-2.5 rounded-md border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[11.5px] font-medium text-[#37352f] dark:text-[#c7c7c3] hover:bg-[#f7f7f5] dark:hover:bg-[#333] flex items-center gap-1.5"
            onClick={async () => {
              const result = await window.electronAPI.chooseDirectory()
              if (!result.canceled && activeProject) {
                await window.electronAPI.updateProject({ id: activeProject.id, updates: { outputDir: result.path } })
                const updated = await window.electronAPI.getProjects()
                // Projects updated event will refresh state via IPC
              }
            }}
          >
            <FolderOpen size={13} />
            Pasta
          </button>
        </>
      )}

      {/* Output dir display */}
      <div className="ml-auto flex items-center gap-1 text-[11px] text-[#9b9a97] dark:text-[#4c4c4c] truncate max-w-[260px]">
        {activeProject ? (
          <>
            <FolderOpen size={11} />
            <span className="font-medium text-[#37352f] dark:text-[#c7c7c3] truncate">
              {activeProject.outputDir || 'Sem pasta configurada'}
            </span>
          </>
        ) : (
          <span className="italic">Nenhum projeto ativo</span>
        )}
      </div>
    </div>
  )
}

function generateNextName(project) {
  return `${project.prefix}${String(project.counter + 1).padStart(3, '0')}.svg`
}
```

- [ ] **Step 2: Create `src/renderer/src/components/ClipboardArea.jsx`**

```jsx
import { useEffect } from 'react'
import { Paperclip, AlertCircle, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import PreviewArea from './PreviewArea.jsx'

export default function ClipboardArea() {
  const { state, actions } = useApp()

  // Listen for Ctrl+V globally when window is focused
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.ctrlKey && e.key === 'v' && state.status === 'idle') {
        // Don't intercept if user is typing in an input
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return
        e.preventDefault()
        actions.paste()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.status, actions])

  if (state.status === 'converting') {
    return (
      <div className="border-2 border-dashed border-[#d0cfc9] dark:border-[#3a3a3a] rounded-lg bg-[#fafaf8] dark:bg-[#242424] p-7 text-center">
        <Loader2 size={28} className="mx-auto mb-2 text-[#2f81f7] animate-spin" />
        <p className="text-[13.5px] font-medium">Convertendo com Inkscape...</p>
        <p className="text-[11.5px] text-[#9b9a97] mt-1">Aguarde até 15 segundos</p>
      </div>
    )
  }

  if (state.status === 'preview' || state.status === 'saving') {
    return <PreviewArea />
  }

  if (state.status === 'error') {
    return (
      <div className="border-2 border-dashed border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-950/30 p-7 text-center">
        <AlertCircle size={28} className="mx-auto mb-2 text-red-500" />
        <p className="text-[13.5px] font-medium text-red-700 dark:text-red-400">{state.error?.message}</p>
        <button
          onClick={actions.clearError}
          className="mt-3 text-[11.5px] text-red-600 dark:text-red-400 underline"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  // Idle state
  const hasProject = state.projects.length > 0
  return (
    <div className="border-2 border-dashed border-[#d0cfc9] dark:border-[#3a3a3a] rounded-lg bg-[#fafaf8] dark:bg-[#242424] p-7 text-center">
      <Paperclip size={28} className="mx-auto mb-2 text-[#9b9a97]" />
      <p className="text-[13.5px] font-medium">
        {hasProject ? 'Cole o esquemático' : 'Crie um projeto nas configurações'}
      </p>
      {hasProject && (
        <p className="text-[11.5px] text-[#9b9a97] mt-1">
          Copie no Altium Designer →{' '}
          <kbd className="bg-[#f0efec] dark:bg-[#2a2a2a] border border-[#d0cfc9] dark:border-[#3a3a3a] rounded px-1.5 py-0.5 text-[10.5px] font-semibold">Ctrl+V</kbd>
          {' '}aqui
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Toolbar.jsx src/renderer/src/components/ClipboardArea.jsx
git commit -m "feat: add Toolbar and ClipboardArea — idle/converting/error states"
```

---

## Task 13: PreviewArea Component

**Files:**
- Create: `src/renderer/src/components/PreviewArea.jsx`

- [ ] **Step 1: Create `src/renderer/src/components/PreviewArea.jsx`**

```jsx
import { Eye, Clock, FileText, Maximize2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PreviewArea() {
  const { state, actions } = useApp()
  const { svgContent, svgMetadata } = state
  const isSaving = state.status === 'saving'

  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
  const nextFilename = activeProject
    ? `${activeProject.prefix}${String(activeProject.counter + 1).padStart(3, '0')}.svg`
    : 'output.svg'

  if (!svgContent) return null

  // Create a safe data URL for the SVG preview
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`

  return (
    <div className="border-2 border-[#2f81f7] rounded-lg bg-[#f5f9ff] dark:bg-[#1a2535] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#e8f0fe] dark:bg-[#1e2e4a] border-b border-[#c8d9fb] dark:border-[#2a3f5f]">
        <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[#1a56db] dark:text-[#7cb3f5]">
          <Eye size={13} />
          Prévia — {nextFilename}
        </div>
        <div className="flex gap-2">
          <button
            onClick={actions.discard}
            disabled={isSaving}
            className="h-6 px-2.5 rounded border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[11px] font-medium text-[#6b6a68] dark:text-[#9b9a97] hover:bg-[#f7f7f5] disabled:opacity-50"
          >
            Descartar
          </button>
          <button
            onClick={actions.save}
            disabled={isSaving}
            className="h-6 px-2.5 rounded bg-[#2f81f7] hover:bg-[#2673e0] text-white text-[11px] font-semibold disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar →'}
          </button>
        </div>
      </div>

      {/* SVG Preview */}
      <div className="flex items-center justify-center p-4 min-h-[140px] bg-white dark:bg-[#1a1a1a]">
        <img
          src={svgDataUrl}
          alt="Prévia do esquemático"
          className="max-h-48 max-w-full object-contain drop-shadow-sm"
          style={{ imageRendering: 'crisp-edges' }}
        />
      </div>

      {/* Metadata footer */}
      {svgMetadata && (
        <div className="flex items-center gap-5 px-3 py-1.5 bg-[#e8f0fe] dark:bg-[#1e2e4a] border-t border-[#c8d9fb] dark:border-[#2a3f5f] text-[10.5px] text-[#4a6fa8] dark:text-[#7cb3f5]">
          <span className="flex items-center gap-1">
            <Maximize2 size={10} />
            {svgMetadata.width} × {svgMetadata.height}
          </span>
          <span className="flex items-center gap-1">
            <FileText size={10} />
            {formatBytes(svgMetadata.sizeBytes)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {(svgMetadata.conversionMs / 1000).toFixed(1)}s
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/PreviewArea.jsx
git commit -m "feat: add PreviewArea — SVG preview with metadata and save controls"
```

---

## Task 14: ClipGrid + StatusBar

**Files:**
- Create: `src/renderer/src/components/ClipGrid.jsx`
- Create: `src/renderer/src/components/StatusBar.jsx`

- [ ] **Step 1: Create `src/renderer/src/components/ClipGrid.jsx`**

```jsx
import { CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ClipGrid() {
  const { state } = useApp()
  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
  const nextName = activeProject
    ? `${activeProject.prefix}${String(activeProject.counter + 1).padStart(3, '0')}.svg`
    : null

  if (state.history.length === 0 && !nextName) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#9b9a97] dark:text-[#4c4c4c]">
          Recentes
        </p>
        {state.history.length > 0 && (
          <p className="text-[10.5px] text-[#9b9a97] dark:text-[#4c4c4c]">
            {state.history.length} arquivo{state.history.length !== 1 ? 's' : ''} nesta sessão
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {state.history.map((entry) => (
          <ClipCard key={entry.id} entry={entry} />
        ))}

        {/* Placeholder for the next clip */}
        {nextName && (
          <div className="border border-dashed border-[#d0cfc9] dark:border-[#3a3a3a] rounded-md bg-[#fafaf8] dark:bg-[#242424] flex items-center justify-center min-h-[80px]">
            <div className="text-center px-2">
              <p className="text-[10px] text-[#9b9a97] dark:text-[#4c4c4c]">próximo</p>
              <p className="text-[11px] font-semibold text-[#9b9a97] dark:text-[#4c4c4c] truncate">{nextName}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ClipCard({ entry }) {
  return (
    <div className="border border-[#e9e9e7] dark:border-[#2e2e2e] rounded-md overflow-hidden bg-white dark:bg-[#1f1f1f] hover:shadow-md transition-shadow cursor-default">
      {/* Thumbnail area */}
      <div className="h-[60px] bg-[#f7f7f5] dark:bg-[#242424] border-b border-[#e9e9e7] dark:border-[#2e2e2e] flex items-center justify-center relative">
        <div className="w-8 h-8 bg-[#e9e9e7] dark:bg-[#2a2a2a] rounded" />
        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#2f81f7] rounded-full flex items-center justify-center">
          <CheckCircle2 size={10} className="text-white" />
        </div>
      </div>
      {/* Info */}
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-semibold truncate">{entry.filename}</p>
        <p className="text-[10px] text-[#9b9a97] dark:text-[#4c4c4c]">
          {formatTime(entry.timestamp)} · {formatBytes(entry.sizeBytes)}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/renderer/src/components/StatusBar.jsx`**

```jsx
import { useApp } from '../context/AppContext.jsx'

export default function StatusBar() {
  const { state } = useApp()
  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)

  const isConverting = state.status === 'converting'
  const isPreview = state.status === 'preview' || state.status === 'saving'

  const nextName = activeProject
    ? `${activeProject.prefix}${String(activeProject.counter + 1).padStart(3, '0')}.svg`
    : null

  return (
    <div className="h-6 shrink-0 border-t border-[#e9e9e7] dark:border-[#2e2e2e] bg-[#fbfbfa] dark:bg-[#191919] flex items-center px-3.5 gap-3 text-[10px] text-[#9b9a97] dark:text-[#4c4c4c]">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${isConverting ? 'bg-amber-400 animate-pulse' : isPreview ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`}
        />
        <span>
          {isConverting ? 'Convertendo...' : isPreview ? 'Aguardando confirmação' : 'Monitorando'}
        </span>
      </div>

      <span>·</span>
      <span>{state.history.length} SVGs nesta sessão</span>

      {nextName && (
        <>
          <span>·</span>
          <span>Próximo: <span className="font-medium text-[#37352f] dark:text-[#c7c7c3]">{nextName}</span></span>
        </>
      )}

      {activeProject?.outputDir && (
        <>
          <span>·</span>
          <span className="truncate max-w-[200px]">
            📁 <span className="font-medium text-[#37352f] dark:text-[#c7c7c3]">{activeProject.outputDir}</span>
          </span>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/ClipGrid.jsx src/renderer/src/components/StatusBar.jsx
git commit -m "feat: add ClipGrid and StatusBar components"
```

---

## Task 15: Toast + InkscapeBanner

**Files:**
- Create: `src/renderer/src/components/Toast.jsx`
- Create: `src/renderer/src/components/InkscapeBanner.jsx`

- [ ] **Step 1: Create `src/renderer/src/components/Toast.jsx`**

```jsx
import { CheckCircle2, XCircle } from 'lucide-react'

export default function Toast({ message, type }) {
  const isSuccess = type === 'success'

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-[12.5px] font-medium z-50 pointer-events-none
        ${isSuccess
          ? 'bg-emerald-600 text-white'
          : 'bg-red-600 text-white'
        }`}
    >
      {isSuccess ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {message}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/renderer/src/components/InkscapeBanner.jsx`**

```jsx
import { AlertTriangle, ArrowRight } from 'lucide-react'

export default function InkscapeBanner({ onGoToSettings }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-[12px]">
      <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-amber-800 dark:text-amber-300">
        Inkscape não foi encontrado. A conversão EMF→SVG não funcionará.
      </p>
      <button
        onClick={onGoToSettings}
        className="ml-auto flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold hover:underline shrink-0"
      >
        Configurar <ArrowRight size={12} />
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Toast.jsx src/renderer/src/components/InkscapeBanner.jsx
git commit -m "feat: add Toast notification and InkscapeBanner"
```

---

## Task 16: Settings Screen

**Files:**
- Create: `src/renderer/src/components/Settings.jsx`

- [ ] **Step 1: Create `src/renderer/src/components/Settings.jsx`**

```jsx
import { useState } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, CheckCircle2, FolderOpen } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const PROJECT_COLORS = ['#2f81f7', '#27c93f', '#ff9f43', '#e74c3c', '#9b59b6', '#1abc9c']

export default function Settings({ onBack }) {
  const { state, actions } = useApp()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [inkPath, setInkPath] = useState(state.settings.inkscapePath || '')
  const [inkStatus, setInkStatus] = useState(state.settings.inkscapePath ? 'saved' : 'unset')

  // ── Project form ──────────────────────────────────────────────────────────

  function openAdd() {
    setForm({ id: crypto.randomUUID(), name: '', prefix: '', outputDir: '', counter: 1, color: PROJECT_COLORS[0] })
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

  async function saveInkscape() {
    await actions.updateSettings({ inkscapePath: inkPath })
    setInkStatus('saved')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e9e9e7] dark:border-[#2e2e2e]">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-[#9b9a97] hover:text-[#37352f] dark:hover:text-[#e6e6e3]">
          <ArrowLeft size={14} /> Voltar
        </button>
        <h2 className="text-[14px] font-semibold">Configurações</h2>
      </div>

      <div className="p-5 flex flex-col gap-6 max-w-2xl">

        {/* Projects section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#9b9a97] dark:text-[#4c4c4c] mb-3">Projetos</p>

          <div className="flex flex-col gap-2">
            {state.projects.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-md border ${p.id === state.activeProjectId ? 'bg-[#f0f7ff] dark:bg-[#1a2535] border-[#b8d8f8] dark:border-[#2a3f5f]' : 'bg-[#fafaf8] dark:bg-[#242424] border-[#e9e9e7] dark:border-[#2e2e2e]'}`}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium truncate">{p.name}</span>
                    <span className="text-[10px] bg-[#f0efec] dark:bg-[#2a2a2a] rounded px-1.5 py-0.5 text-[#6b6a68] dark:text-[#9b9a97] font-mono">{p.prefix}</span>
                  </div>
                  <p className="text-[10.5px] text-[#9b9a97] truncate">{p.outputDir || 'Sem pasta'}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEdit(p)} className="w-6 h-6 rounded bg-[#f0efec] dark:bg-[#2a2a2a] hover:bg-[#e9e9e7] flex items-center justify-center">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => actions.deleteProject(p.id)} className="w-6 h-6 rounded bg-[#f0efec] dark:bg-[#2a2a2a] hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-red-500">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}

            {/* Add project form */}
            {editingId ? (
              <div className="border border-[#2f81f7] rounded-md p-3 bg-[#f5f9ff] dark:bg-[#1a2535] flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Nome do projeto">
                    <input className={inputClass} placeholder="Motor BLDC" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <Field label="Prefixo">
                    <input className={inputClass} placeholder="BLDC_" value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Pasta de saída">
                  <div className="flex gap-1.5">
                    <input className={`${inputClass} flex-1`} placeholder="D:\Projetos\..." value={form.outputDir} onChange={(e) => setForm((f) => ({ ...f, outputDir: e.target.value }))} />
                    <button onClick={chooseDir} className="h-7 px-2.5 rounded border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[11px] flex items-center gap-1">
                      <FolderOpen size={12} /> Explorar
                    </button>
                  </div>
                </Field>
                <Field label="Cor">
                  <div className="flex gap-2 mt-0.5">
                    {PROJECT_COLORS.map((c) => (
                      <button key={c} onClick={() => setForm((f) => ({ ...f, color: c }))} className="w-5 h-5 rounded-full border-2 transition-all" style={{ background: c, borderColor: form.color === c ? '#37352f' : 'transparent' }} />
                    ))}
                  </div>
                </Field>
                <div className="flex gap-2 pt-1">
                  <button onClick={submitForm} className="h-7 px-3 bg-[#2f81f7] text-white text-[11.5px] font-semibold rounded hover:bg-[#2673e0]">
                    {editingId === 'new' ? 'Adicionar' : 'Salvar'}
                  </button>
                  <button onClick={() => { setEditingId(null); setForm(null) }} className="h-7 px-3 border border-[#e0e0de] dark:border-[#3a3a3a] text-[11.5px] rounded bg-white dark:bg-[#2a2a2a] hover:bg-[#f7f7f5]">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={openAdd} className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#d0cfc9] dark:border-[#3a3a3a] rounded-md text-[12px] text-[#9b9a97] hover:border-[#9b9a97] hover:text-[#37352f] dark:hover:text-[#c7c7c3] transition-colors">
                <Plus size={13} /> Adicionar projeto
              </button>
            )}
          </div>
        </section>

        {/* Inkscape section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#9b9a97] dark:text-[#4c4c4c] mb-3">Inkscape</p>
          <div className="flex gap-2">
            <input
              className={`${inputClass} flex-1 font-mono text-[11px]`}
              placeholder="C:\Program Files\Inkscape\bin\inkscape.exe"
              value={inkPath}
              onChange={(e) => { setInkPath(e.target.value); setInkStatus('dirty') }}
            />
            <button
              onClick={saveInkscape}
              className="h-7 px-3 bg-white dark:bg-[#2a2a2a] border border-[#e0e0de] dark:border-[#3a3a3a] rounded text-[11px] hover:bg-[#f7f7f5] flex items-center gap-1.5"
            >
              Salvar
            </button>
          </div>
          {inkStatus === 'saved' && inkPath && (
            <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={11} /> Inkscape configurado
            </p>
          )}
        </section>

        {/* Appearance section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#9b9a97] dark:text-[#4c4c4c] mb-2">Aparência</p>
          <p className="text-[12px] text-[#6b6a68] dark:text-[#9b9a97]">
            O tema segue automaticamente a configuração do Windows (claro ou escuro). Não é necessário ajustar manualmente.
          </p>
        </section>

      </div>
    </div>
  )
}

const inputClass = 'h-7 px-2.5 rounded border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[12px] text-[#37352f] dark:text-[#c7c7c3] focus:outline-none focus:border-[#2f81f7] w-full'

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] font-medium text-[#6b6a68] dark:text-[#9b9a97]">{label}</label>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/Settings.jsx
git commit -m "feat: add Settings screen — project CRUD and Inkscape config"
```

---

## Task 17: Smoke Test + electron-builder Config

**Files:**
- Create: `electron-builder.yml`
- Create: `.gitignore` update

- [ ] **Step 1: Full smoke test — run the app**

```bash
npm run dev
```

Walk through the full user flow manually:
1. Open the app — verify window appears, titlebar shows "SchematicClip"
2. Navigate to Settings → add a project with name, prefix, and output folder
3. Set the Inkscape path to your installed location
4. Go back to main screen — verify project appears in sidebar
5. Copy any selection in Altium Designer
6. Press Ctrl+V in the app — verify "Convertendo..." state appears
7. Verify SVG preview appears with metadata
8. Click "Salvar" — verify file appears in the chosen folder
9. Verify the ClipGrid shows the saved file
10. Close the window — verify app goes to tray (not quit)
11. Right-click tray icon — verify project menu appears

Fix any issues discovered before continuing.

- [ ] **Step 2: Create `electron-builder.yml`**

```yaml
appId: com.schematicclip.app
productName: SchematicClip
copyright: Copyright © 2026

directories:
  output: dist
  buildResources: assets

files:
  - out/**/*

win:
  target:
    - target: nsis
      arch: [x64]
  icon: assets/icon.png

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: SchematicClip

publish: null
```

- [ ] **Step 3: Update `.gitignore`**

Ensure `.gitignore` contains:

```
node_modules/
dist/
out/
.superpowers/
*.emf
*.log
```

- [ ] **Step 4: Build and verify packaging**

```bash
npm run dist
```

Expected: `dist/SchematicClip Setup x.x.x.exe` is created. Install and verify the app runs correctly from the installer.

- [ ] **Step 5: Final commit**

```bash
git add electron-builder.yml .gitignore
git commit -m "feat: add electron-builder packaging config for Windows NSIS installer"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Clipboard EMF detection and reading → Task 3 (ClipboardService)
- [x] Inkscape CLI conversion with timeout → Task 4 (ConversionService)
- [x] Sequential filename (prefix + counter) → Task 5 (SaveService)
- [x] SVG preview before save → Task 13 (PreviewArea)
- [x] Multiple projects with prefix + output dir → Task 2 (ProjectStore) + Task 16 (Settings)
- [x] System tray with project switching → Task 6 (TrayManager)
- [x] nativeTheme dark/light auto → Task 7 (index.js) + Task 10 (main.jsx)
- [x] History grid (session only) → Task 14 (ClipGrid) + Task 2 (ProjectStore.initSession)
- [x] Error states: NO_EMF, INKSCAPE_NOT_FOUND, TIMEOUT, INVALID_SVG, DIR_NOT_FOUND, EACCES → Tasks 7, 12, 13, 15
- [x] Inkscape banner when not configured → Task 15 (InkscapeBanner)
- [x] Toast notifications → Task 15 (Toast)
- [x] Windows NSIS installer → Task 17

**Placeholder scan:** None found — all steps have concrete code.

**Type consistency:**
- `generateFilename(prefix, counter)` defined in Task 5, used in Task 7 ✓
- `isValidSVG(svgContent)` defined in Task 4, used in Task 7 ✓
- `getSVGMetadata(svgContent, ms)` defined in Task 4, used in Task 7 ✓
- `pendingSVG = { svgContent, metadata }` set in `paste-schematic` handler, consumed in `save-svg` handler ✓
- `ProjectStore` methods used in Task 7 match definitions in Task 2 ✓
- IPC channels in Task 8 (preload) match handlers in Task 7 (index.js) ✓
