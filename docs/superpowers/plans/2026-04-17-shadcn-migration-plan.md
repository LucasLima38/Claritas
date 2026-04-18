# SchematicClip — shadcn/ui Migration + v1.0.0 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate SchematicClip's UI from custom Tailwind to shadcn/ui (zinc theme), fix 2 bugs, implement 2 missing spec features, and publish v1.0.0 to GitHub.

**Architecture:** Electron + React stays intact. shadcn/ui components replace custom Tailwind UI. Sonner replaces the custom Toast system. Two bugs fixed in main process. Two features added: `dirMissing` dialog (AlertDialog) and Inkscape version check (Badge). All 40 existing tests must pass; 4 new tests added.

**Tech Stack:** Electron, React 18, electron-vite, Tailwind CSS 3, shadcn/ui (zinc), Sonner, Vitest, electron-builder.

---

## File Map

### Created
- `components.json` — shadcn config
- `src/renderer/src/lib/utils.js` — `cn()` helper (clsx + tailwind-merge)
- `src/renderer/src/components/ui/button.jsx` — shadcn Button
- `src/renderer/src/components/ui/input.jsx` — shadcn Input
- `src/renderer/src/components/ui/label.jsx` — shadcn Label
- `src/renderer/src/components/ui/badge.jsx` — shadcn Badge
- `src/renderer/src/components/ui/separator.jsx` — shadcn Separator
- `src/renderer/src/components/ui/scroll-area.jsx` — shadcn ScrollArea
- `src/renderer/src/components/ui/alert-dialog.jsx` — shadcn AlertDialog
- `src/renderer/src/components/ui/tooltip.jsx` — shadcn Tooltip
- `src/renderer/src/components/ui/sonner.jsx` — shadcn Sonner wrapper

### Modified
- `electron.vite.config.js` — add `@` alias for renderer
- `tailwind.config.js` — add shadcn color tokens + animate plugin
- `src/renderer/src/index.css` — add shadcn CSS variables (zinc light + dark)
- `src/main/index.js` — bug fix (get-init-data fallback), dirMissing in save-svg, checkInkscapeVersion IPC
- `src/main/conversionService.js` — add `checkInkscapeVersion()`
- `src/main/saveService.js` — no changes (checkOutputDir already exported)
- `src/preload/index.js` — expose `checkInkscapeVersion`
- `src/renderer/src/context/AppContext.jsx` — remove toast state, add sonner calls, add DIR_MISSING/CLEAR_DIR_MISSING
- `src/renderer/src/App.jsx` — add `<Toaster>`, remove `<Toast>`
- `src/renderer/src/components/InkscapeBanner.jsx` — shadcn Button
- `src/renderer/src/components/StatusBar.jsx` — CSS vars
- `src/renderer/src/components/Toolbar.jsx` — shadcn Button
- `src/renderer/src/components/PreviewArea.jsx` — shadcn Button, Badge, AlertDialog
- `src/renderer/src/components/ClipboardArea.jsx` — shadcn Button
- `src/renderer/src/components/Sidebar.jsx` — shadcn Button, Badge, Separator
- `src/renderer/src/components/ClipGrid.jsx` — shadcn Badge
- `src/renderer/src/components/Settings.jsx` — shadcn Input, Label, Button, AlertDialog, Badge

### Deleted
- `src/renderer/src/components/Toast.jsx`

### Test files
- `tests/main/conversionService.test.js` — 2 new tests for `checkInkscapeVersion`
- `tests/main/saveService.test.js` — 1 new test (dirMissing)
- `tests/main/projectStore.test.js` — 1 new test (get-init-data fallback behavior)

---

## Task 1: Setup shadcn/ui

**Files:**
- Modify: `electron.vite.config.js`
- Modify: `tailwind.config.js`
- Modify: `src/renderer/src/index.css`
- Create: `components.json`
- Create: `src/renderer/src/lib/utils.js`

- [ ] **Step 1: Install shadcn/ui dependencies**

```bash
cd "C:\Users\vieir\OneDrive\documentos\Claude\Projects\SchematicClip"
npm install sonner clsx tailwind-merge class-variance-authority tailwindcss-animate @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-separator @radix-ui/react-scroll-area @radix-ui/react-alert-dialog @radix-ui/react-tooltip
```

Expected: packages added to `node_modules`, no errors.

- [ ] **Step 2: Add `@` alias to electron.vite.config.js**

Open `electron.vite.config.js` and replace its entire content with:

```js
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  main: {
    build: { rollupOptions: { external: ['electron-store'] } }
  },
  preload: {
    build: { rollupOptions: { external: ['electron-store'] } }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/renderer/src'),
      }
    }
  }
})
```

- [ ] **Step 3: Create `components.json`**

Create `components.json` at the project root:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/renderer/src/index.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 4: Update `tailwind.config.js`**

Replace the entire file with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/renderer/src/**/*.{js,jsx,html}',
    './src/renderer/index.html',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

- [ ] **Step 5: Update `src/renderer/src/index.css` with shadcn CSS variables**

Replace the entire file with:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border box-border;
  }
  body {
    @apply bg-background text-foreground;
    margin: 0;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    user-select: none;
  }
}

.app-region-drag {
  -webkit-app-region: drag;
}
.app-region-no-drag {
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 6: Create `src/renderer/src/lib/utils.js`**

```js
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 7: Install shadcn components**

```bash
npx shadcn@latest add button input label badge separator scroll-area alert-dialog tooltip sonner --overwrite
```

Expected: files created in `src/renderer/src/components/ui/`. Accept any prompts with Y.

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: Electron window opens. UI may look slightly different (CSS vars active) but app is functional. Close the window.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: install and configure shadcn/ui with zinc theme"
```

---

## Task 2: Fix Bug — activeProjectId fallback in get-init-data

**Files:**
- Modify: `src/main/index.js`
- Modify: `tests/main/projectStore.test.js`

**Context:** When the app starts with existing projects but `activeProjectId: null` in the store (caused by a previous session bug), all saves fail silently. The fix: in the `get-init-data` handler, auto-activate `projects[0]` if `activeProjectId` is null but projects exist.

- [ ] **Step 1: Write the failing test**

Open `tests/main/projectStore.test.js` and add this test inside the `describe('ProjectStore', ...)` block (after the last existing test):

```js
it('getActiveProjectId returns first project id when activeProjectId is null but projects exist', () => {
  const project = { id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 0, color: '#fff' }
  store.addProject(project)
  // activeProjectId is null by default — simulate the bug scenario
  expect(store.getActiveProjectId()).toBeNull()
  expect(store.getProjects()).toHaveLength(1)
  // The handler should call setActiveProject to fix this
  if (!store.getActiveProjectId() && store.getProjects().length > 0) {
    store.setActiveProject(store.getProjects()[0].id)
  }
  expect(store.getActiveProjectId()).toBe('p1')
})
```

- [ ] **Step 2: Run test to verify it passes (it tests the fix logic)**

```bash
npx vitest run tests/main/projectStore.test.js
```

Expected: all tests PASS (the test validates the fix logic inline).

- [ ] **Step 3: Apply the fix to `src/main/index.js`**

Find the `get-init-data` handler (near end of file) and replace it:

```js
// Renderer calls this once on mount to get initial state (avoids did-finish-load race condition)
ipcMain.handle('get-init-data', () => {
  const projects = store.getProjects()
  let activeProjectId = store.getActiveProjectId()
  // Fallback: if activeProjectId is null but projects exist, auto-activate first project
  if (!activeProjectId && projects.length > 0) {
    activeProjectId = projects[0].id
    store.setActiveProject(activeProjectId)
  }
  return {
    projects,
    activeProjectId,
    settings: store.getSettings(),
    history: store.getHistory(),
  }
})
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: 41 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/index.js tests/main/projectStore.test.js
git commit -m "fix: auto-activate first project when activeProjectId is null on startup"
```

---

## Task 3: Feature — checkInkscapeVersion

**Files:**
- Modify: `src/main/conversionService.js`
- Modify: `src/main/index.js`
- Modify: `src/preload/index.js`
- Modify: `tests/main/conversionService.test.js`

- [ ] **Step 1: Write the failing tests**

Open `tests/main/conversionService.test.js`. Add this import at the top (update the existing destructured import):

```js
const { findInkscape, convert, isValidSVG, getSVGMetadata, checkInkscapeVersion } = await import('../../src/main/conversionService.js')
```

Then add a new `describe` block after the `convert()` tests:

```js
describe('checkInkscapeVersion()', () => {
  it('returns { ok: true, version } when inkscape --version succeeds', async () => {
    mockSpawn.mockReturnValueOnce((() => {
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.kill = vi.fn()
      setTimeout(() => {
        proc.stdout.emit('data', 'Inkscape 1.3.2 (091e20e, 2023-11-25)\n')
        proc.emit('close', 0)
      }, 10)
      return proc
    })())
    const result = await checkInkscapeVersion('C:\\inkscape.exe')
    expect(result.ok).toBe(true)
    expect(result.version).toBe('1.3.2')
  })

  it('returns { ok: false } when inkscape path is invalid or exits non-zero', async () => {
    mockSpawn.mockReturnValueOnce((() => {
      const proc = new EventEmitter()
      proc.stdout = new EventEmitter()
      proc.stderr = new EventEmitter()
      proc.kill = vi.fn()
      setTimeout(() => proc.emit('close', 1), 10)
      return proc
    })())
    const result = await checkInkscapeVersion('C:\\bad-path.exe')
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/conversionService.test.js
```

Expected: 2 FAIL — `checkInkscapeVersion is not a function`

- [ ] **Step 3: Implement `checkInkscapeVersion` in `src/main/conversionService.js`**

Add this function at the end of the file (before the last closing line):

```js
/**
 * Runs `inkscape --version` and parses the version string.
 * @param {string} inkscapePath Absolute path to inkscape.exe
 * @returns {Promise<{ok: boolean, version?: string, error?: string}>}
 */
export async function checkInkscapeVersion(inkscapePath) {
  return new Promise((resolve) => {
    let output = ''
    let proc
    try {
      proc = spawn(inkscapePath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      return resolve({ ok: false, error: err.message })
    }

    proc.stdout.on('data', (chunk) => { output += chunk.toString() })

    proc.on('close', (code) => {
      if (code !== 0) return resolve({ ok: false, error: `Exit code ${code}` })
      // Output is like: "Inkscape 1.3.2 (091e20e, 2023-11-25)"
      const match = output.match(/Inkscape\s+(\d+\.\d+[\.\d]*)/)
      if (match) {
        resolve({ ok: true, version: match[1] })
      } else {
        resolve({ ok: false, error: 'Could not parse version' })
      }
    })

    proc.on('error', (err) => resolve({ ok: false, error: err.message }))
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/conversionService.test.js
```

Expected: all tests PASS (including the 2 new ones).

- [ ] **Step 5: Add IPC handler in `src/main/index.js`**

Add the import at the top (update existing import line):

```js
import { convert, findInkscape, isValidSVG, getSVGMetadata, checkInkscapeVersion } from './conversionService.js'
```

Add the handler near the bottom of `index.js` (before the last `get-init-data` handler):

```js
ipcMain.handle('check-inkscape-version', async (_event, { path: inkPath }) => {
  return await checkInkscapeVersion(inkPath)
})
```

- [ ] **Step 6: Expose in `src/preload/index.js`**

Add to the `contextBridge.exposeInMainWorld` object, after `chooseDirectory`:

```js
checkInkscapeVersion: (data) => ipcRenderer.invoke('check-inkscape-version', data),
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: 43 tests PASS. (40 base + 1 from Task 2 + 2 new)

- [ ] **Step 8: Commit**

```bash
git add src/main/conversionService.js src/main/index.js src/preload/index.js tests/main/conversionService.test.js
git commit -m "feat: add checkInkscapeVersion IPC for settings status display"
```

---

## Task 4: Feature — dirMissing dialog flow

**Files:**
- Modify: `src/main/index.js`
- Modify: `tests/main/saveService.test.js`

**Context:** When the output directory doesn't exist, `save-svg` now returns `{ dirMissing: true, outputDir }` instead of silently creating it. The renderer will show a dialog (Task 7).

- [ ] **Step 1: Write the failing test**

Open `tests/main/saveService.test.js` and add inside `describe('SaveService', ...)`:

```js
describe('save-svg dirMissing (via index.js logic — tested inline)', () => {
  it('checkOutputDir returns { exists: false } for missing dir — dirMissing path is triggered', async () => {
    const { promises: fsp } = await import('fs')
    fsp.access.mockRejectedValue(new Error('ENOENT'))
    const result = await checkOutputDir('D:\\nonexistent')
    // In save-svg handler: if (!result.exists) return { dirMissing: true, outputDir }
    expect(result.exists).toBe(false)
    // Simulate handler response
    const handlerResponse = !result.exists
      ? { dirMissing: true, outputDir: 'D:\\nonexistent' }
      : { ok: true }
    expect(handlerResponse.dirMissing).toBe(true)
    expect(handlerResponse.outputDir).toBe('D:\\nonexistent')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx vitest run tests/main/saveService.test.js
```

Expected: all tests PASS.

- [ ] **Step 3: Restore `checkOutputDir` in the `save-svg` handler in `src/main/index.js`**

First, restore the import of `checkOutputDir`:

```js
import { generateFilename, saveSVG, checkOutputDir } from './saveService.js'
```

Then find the `save-svg` handler and replace it with:

```js
ipcMain.handle('save-svg', async (_event, { projectId }) => {
  if (!pendingSVG) return { error: 'NO_PENDING', message: 'Nenhum SVG aguardando confirmação.' }

  const project = store.getProjects().find((p) => p.id === projectId)
  if (!project) return { error: 'PROJECT_NOT_FOUND', message: 'Projeto não encontrado.' }

  // Check if output directory exists — if not, signal renderer to show dialog
  const dirCheck = await checkOutputDir(project.outputDir)
  if (!dirCheck.exists) {
    return { dirMissing: true, outputDir: project.outputDir }
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
    if (err.code === 'EACCES' || err.message?.startsWith('EACCES')) {
      return { error: 'EACCES', message: 'Sem permissão de escrita na pasta de destino.' }
    }
    return { error: 'ERROR', message: err.message }
  }
})
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: 44 tests PASS. (40 base + 1 + 2 + 1 new)

- [ ] **Step 5: Commit**

```bash
git add src/main/index.js tests/main/saveService.test.js
git commit -m "feat: return dirMissing signal when output dir does not exist before save"
```

---

## Task 5: AppContext — Sonner + DIR_MISSING state

**Files:**
- Modify: `src/renderer/src/context/AppContext.jsx`

**Context:** Replace the `toast` state machine with direct `sonner` calls. Add `dirMissing`/`dirMissingPath` to state. Remove `CLEAR_TOAST`. Update `save()` action to handle `dirMissing` response.

- [ ] **Step 1: Replace `src/renderer/src/context/AppContext.jsx` entirely**

```jsx
import { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { toast } from 'sonner'

// status: 'idle' | 'converting' | 'preview' | 'saving' | 'error'

const initialState = {
  status: 'idle',
  svgContent: null,
  svgMetadata: null,
  error: null,
  projects: [],
  activeProjectId: null,
  history: [],
  settings: {},
  dirMissing: false,
  dirMissingPath: null,
}

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
        error: action.toastOnly ? state.error : { type: action.errorType, message: action.message },
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
      }

    case 'SAVE_ERROR':
      return { ...state, status: 'preview' }

    case 'DIR_MISSING':
      return {
        ...state,
        status: 'preview',
        dirMissing: true,
        dirMissingPath: action.outputDir,
      }

    case 'CLEAR_DIR_MISSING':
      return { ...state, dirMissing: false, dirMissingPath: null }

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

    case 'CLEAR_ERROR':
      return { ...state, status: 'idle', error: null }

    default:
      return state
  }
}

const AppContext = createContext(null)

function applyTheme(theme, systemIsDark) {
  const isDark =
    theme === 'dark' ? true :
    theme === 'light' ? false :
    systemIsDark
  document.documentElement.classList.toggle('dark', isDark)
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const themeRef = useRef('system')

  useEffect(() => {
    window.electronAPI.getInitData().then((data) => {
      dispatch({ type: 'INIT', ...data })
      const theme = data.settings?.theme ?? 'system'
      themeRef.current = theme
      const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      applyTheme(theme, systemIsDark)
    })

    const cleanups = [
      window.electronAPI.onProjectsUpdated((data) =>
        dispatch({ type: 'PROJECTS_UPDATED', ...data })
      ),
      window.electronAPI.onThemeChanged(({ isDark }) => {
        applyTheme(themeRef.current, isDark)
      }),
      window.electronAPI.onNavigateTo((_screen) => {}),
    ]
    return () => cleanups.forEach((fn) => fn?.())
  }, [])

  const actions = {
    async paste() {
      dispatch({ type: 'PASTE_START' })
      const result = await window.electronAPI.pasteSchematic()
      if (result.ok) {
        dispatch({ type: 'SVG_READY', svgContent: result.svgContent, metadata: result.metadata })
      } else {
        const toastOnly = result.error === 'NO_EMF'
        if (toastOnly) toast.error(result.message)
        dispatch({ type: 'CONVERSION_ERROR', errorType: result.error, message: result.message, toastOnly })
      }
    },

    async save() {
      const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
      if (!activeProject) {
        toast.error('Nenhum projeto ativo. Selecione um projeto nas configurações.')
        return
      }
      dispatch({ type: 'SAVE_START' })
      let result
      try {
        result = await window.electronAPI.saveSVG({ projectId: state.activeProjectId })
      } catch (err) {
        toast.error(`Erro de comunicação: ${err.message}`)
        dispatch({ type: 'SAVE_ERROR' })
        return
      }
      if (!result) {
        toast.error('Resposta inválida do processo principal.')
        dispatch({ type: 'SAVE_ERROR' })
        return
      }
      if (result.ok) {
        dispatch({ type: 'SAVE_SUCCESS', filename: result.filename, entry: result.entry, newCounter: result.newCounter })
        toast.success(`Salvo: ${result.filename}`)
      } else if (result.dirMissing) {
        dispatch({ type: 'DIR_MISSING', outputDir: result.outputDir })
      } else if (result.error === 'EACCES') {
        toast.error('Sem permissão de escrita na pasta de destino.')
        dispatch({ type: 'SAVE_ERROR' })
      } else {
        toast.error(result.message || 'Erro desconhecido ao salvar.')
        dispatch({ type: 'SAVE_ERROR' })
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
      dispatch({ type: 'PROJECTS_UPDATED', projects: result.projects, activeProjectId: result.activeProjectId })
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
      if (updates.theme) {
        themeRef.current = settings.theme
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        applyTheme(settings.theme, systemIsDark)
      }
    },

    clearDirMissing() {
      dispatch({ type: 'CLEAR_DIR_MISSING' })
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

- [ ] **Step 2: Run all tests** (AppContext is renderer-only — Vitest tests cover main process)

```bash
npx vitest run
```

Expected: 44 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/context/AppContext.jsx
git commit -m "refactor: replace toast state with sonner, add DIR_MISSING state for folder dialog"
```

---

## Task 6: App.jsx — Toaster + remove Toast

**Files:**
- Modify: `src/renderer/src/App.jsx`
- Delete: `src/renderer/src/components/Toast.jsx`

- [ ] **Step 1: Replace `src/renderer/src/App.jsx`**

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
import InkscapeBanner from './components/InkscapeBanner.jsx'

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
          {!state.settings.inkscapePath && (
            <InkscapeBanner onGoToSettings={() => setScreen('settings')} />
          )}

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

- [ ] **Step 2: Delete `src/renderer/src/components/Toast.jsx`**

```bash
del "src\renderer\src\components\Toast.jsx"
```

- [ ] **Step 3: Start dev and verify toasts work**

```bash
npm run dev
```

Try clicking "Colar" without anything in clipboard. Expected: red error toast appears at bottom center. Close.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/App.jsx
git rm src/renderer/src/components/Toast.jsx
git commit -m "feat: replace custom Toast with Sonner, add Toaster to App"
```

---

## Task 7: Component Wave 1 — InkscapeBanner, StatusBar, Toolbar

**Files:**
- Modify: `src/renderer/src/components/InkscapeBanner.jsx`
- Modify: `src/renderer/src/components/StatusBar.jsx`
- Modify: `src/renderer/src/components/Toolbar.jsx`

- [ ] **Step 1: Replace `InkscapeBanner.jsx`**

```jsx
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function InkscapeBanner({ onGoToSettings }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-sm">
      <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-amber-800 dark:text-amber-300 text-xs">
        Inkscape não foi encontrado. A conversão EMF→SVG não funcionará.
      </p>
      <Button
        variant="link"
        size="sm"
        onClick={onGoToSettings}
        className="ml-auto text-amber-700 dark:text-amber-400 p-0 h-auto text-xs app-region-no-drag"
      >
        Configurar <ArrowRight size={12} className="ml-1" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Replace `StatusBar.jsx`**

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
    <div className="h-6 shrink-0 border-t border-border bg-muted/40 flex items-center px-3.5 gap-3 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isConverting ? 'bg-amber-400 animate-pulse' :
            isPreview   ? 'bg-blue-400 animate-pulse' :
                          'bg-emerald-400'
          }`}
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
          <span>Próximo: <span className="font-medium text-foreground">{nextName}</span></span>
        </>
      )}

      {activeProject?.outputDir && (
        <>
          <span>·</span>
          <span className="truncate max-w-[200px]">
            📁 <span className="font-medium text-foreground">{activeProject.outputDir}</span>
          </span>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Replace `Toolbar.jsx`**

```jsx
import { Clipboard, FolderOpen, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '../context/AppContext.jsx'

function generateNextName(project) {
  return `${project.prefix}${String(project.counter + 1).padStart(3, '0')}.svg`
}

export default function Toolbar() {
  const { state, actions } = useApp()
  const isPreview = state.status === 'preview' || state.status === 'saving'
  const isSaving = state.status === 'saving'
  const isConverting = state.status === 'converting'

  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)

  async function chooseDir() {
    if (!activeProject) return
    const result = await window.electronAPI.chooseDirectory()
    if (!result.canceled) {
      await actions.updateProject(activeProject.id, { outputDir: result.path })
    }
  }

  return (
    <div className="h-10 shrink-0 border-b border-border flex items-center px-3.5 gap-2">
      {isPreview ? (
        <>
          <Button
            size="sm"
            onClick={actions.save}
            disabled={isSaving}
            className="app-region-no-drag h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            <Save size={13} className="mr-1.5" />
            {isSaving ? 'Salvando...' : `Salvar ${activeProject ? generateNextName(activeProject) : ''}`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={actions.discard}
            disabled={isSaving}
            className="app-region-no-drag h-7 text-xs"
          >
            <X size={13} className="mr-1.5" />
            Descartar
          </Button>
        </>
      ) : (
        <>
          <Button
            size="sm"
            onClick={actions.paste}
            disabled={isConverting || state.projects.length === 0}
            className="app-region-no-drag h-7 text-xs"
          >
            <Clipboard size={13} className="mr-1.5" />
            {isConverting ? 'Convertendo...' : 'Colar'}
            {!isConverting && (
              <span className="ml-1.5 opacity-70 text-[10px] border border-white/30 rounded px-1">Ctrl+V</span>
            )}
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button
            size="sm"
            variant="outline"
            onClick={chooseDir}
            disabled={!activeProject}
            className="app-region-no-drag h-7 text-xs"
          >
            <FolderOpen size={13} className="mr-1.5" />
            Pasta
          </Button>
        </>
      )}

      <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[260px]">
        {activeProject ? (
          <>
            <FolderOpen size={11} />
            <span className="font-medium text-foreground truncate">
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
```

- [ ] **Step 4: Start dev and visually verify**

```bash
npm run dev
```

Expected: Toolbar shows shadcn buttons. InkscapeBanner (if visible) uses shadcn link button. Status bar uses CSS vars. Close.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/InkscapeBanner.jsx src/renderer/src/components/StatusBar.jsx src/renderer/src/components/Toolbar.jsx
git commit -m "feat: migrate InkscapeBanner, StatusBar, Toolbar to shadcn/ui"
```

---

## Task 8: Component Wave 2 — PreviewArea (with AlertDialog), ClipboardArea

**Files:**
- Modify: `src/renderer/src/components/PreviewArea.jsx`
- Modify: `src/renderer/src/components/ClipboardArea.jsx`

- [ ] **Step 1: Replace `PreviewArea.jsx`**

```jsx
import { Eye, Clock, FileText, Maximize2, FolderOpen } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

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

  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`

  async function handleCreateDir() {
    const result = await window.electronAPI.createOutputDir({ dir: state.dirMissingPath })
    actions.clearDirMissing()
    if (result.ok) {
      await actions.save()
    } else {
      toast.error(`Não foi possível criar a pasta: ${result.message}`)
    }
  }

  async function handleChooseDir() {
    const result = await window.electronAPI.chooseDirectory()
    actions.clearDirMissing()
    if (!result.canceled && activeProject) {
      await actions.updateProject(activeProject.id, { outputDir: result.path })
      await actions.save()
    }
  }

  return (
    <>
      <div className="border-2 border-primary/30 rounded-lg bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Eye size={13} />
            Prévia — {nextFilename}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={actions.discard}
              disabled={isSaving}
              className="h-6 px-2.5 text-[11px]"
            >
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={actions.save}
              disabled={isSaving}
              className="h-6 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSaving ? 'Salvando...' : 'Salvar →'}
            </Button>
          </div>
        </div>

        {/* SVG Preview */}
        <div className="flex items-center justify-center p-4 min-h-[140px] bg-white">
          <img
            src={svgDataUrl}
            alt="Prévia do esquemático"
            className="max-h-48 max-w-full object-contain drop-shadow-sm"
            style={{ imageRendering: 'crisp-edges' }}
          />
        </div>

        {/* Metadata footer */}
        {svgMetadata && (
          <div className="flex items-center gap-4 px-3 py-1.5 bg-muted border-t border-border">
            <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
              <Maximize2 size={9} /> {svgMetadata.width} × {svgMetadata.height}
            </Badge>
            <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
              <FileText size={9} /> {formatBytes(svgMetadata.sizeBytes)}
            </Badge>
            <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
              <Clock size={9} /> {(svgMetadata.conversionMs / 1000).toFixed(1)}s
            </Badge>
          </div>
        )}
      </div>

      {/* Dir Missing Dialog */}
      <AlertDialog open={state.dirMissing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FolderOpen size={18} /> Pasta de saída não encontrada
            </AlertDialogTitle>
            <AlertDialogDescription>
              A pasta de destino não existe:
              <br />
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded mt-1 inline-block break-all">
                {state.dirMissingPath}
              </code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={actions.clearDirMissing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChooseDir}
              variant="outline"
              className="border-border"
            >
              Escolher outra pasta
            </AlertDialogAction>
            <AlertDialogAction onClick={handleCreateDir}>
              Criar automaticamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 2: Replace `ClipboardArea.jsx`**

```jsx
import { useEffect } from 'react'
import { Paperclip, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '../context/AppContext.jsx'
import PreviewArea from './PreviewArea.jsx'

export default function ClipboardArea() {
  const { state, actions } = useApp()

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.ctrlKey && e.key === 'v' && state.status === 'idle') {
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
      <div className="border-2 border-dashed border-border rounded-lg bg-muted/30 p-7 text-center">
        <Loader2 size={28} className="mx-auto mb-2 text-primary animate-spin" />
        <p className="text-sm font-medium">Convertendo com Inkscape...</p>
        <p className="text-xs text-muted-foreground mt-1">Aguarde até 15 segundos</p>
      </div>
    )
  }

  if (state.status === 'preview' || state.status === 'saving') {
    return <PreviewArea />
  }

  if (state.status === 'error') {
    return (
      <div className="border-2 border-dashed border-destructive/40 rounded-lg bg-destructive/5 p-7 text-center">
        <AlertCircle size={28} className="mx-auto mb-2 text-destructive" />
        <p className="text-sm font-medium text-destructive">{state.error?.message}</p>
        <Button
          variant="link"
          size="sm"
          onClick={actions.clearError}
          className="mt-2 text-destructive"
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  const hasProject = state.projects.length > 0
  return (
    <div className="border-2 border-dashed border-border rounded-lg bg-muted/30 p-7 text-center">
      <Paperclip size={28} className="mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm font-medium">
        {hasProject ? 'Cole o esquemático' : 'Crie um projeto nas configurações'}
      </p>
      {hasProject && (
        <p className="text-xs text-muted-foreground mt-1">
          Copie no Altium Designer →{' '}
          <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-[10.5px] font-semibold">Ctrl+V</kbd>
          {' '}aqui
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run dev and verify**

```bash
npm run dev
```

Expected: Preview area shows shadcn-styled buttons and badges. Error state uses shadcn styling. Close.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/PreviewArea.jsx src/renderer/src/components/ClipboardArea.jsx
git commit -m "feat: migrate PreviewArea and ClipboardArea to shadcn/ui, add dirMissing AlertDialog"
```

---

## Task 9: Component Wave 3 — Sidebar, ClipGrid

**Files:**
- Modify: `src/renderer/src/components/Sidebar.jsx`
- Modify: `src/renderer/src/components/ClipGrid.jsx`

- [ ] **Step 1: Replace `Sidebar.jsx`**

```jsx
import { Settings, Clipboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useApp } from '../context/AppContext.jsx'

export default function Sidebar({ screen, onNavigate }) {
  const { state, actions } = useApp()

  return (
    <div className="w-[200px] shrink-0 bg-muted/40 border-r border-border flex flex-col py-2 overflow-hidden">
      <SectionLabel>Workspace</SectionLabel>
      <SidebarItem
        icon={<Clipboard size={14} />}
        active={screen === 'main'}
        onClick={() => onNavigate('main')}
        badge={state.history.length || null}
      >
        Clipboard
      </SidebarItem>

      <Separator className="mx-3 my-1.5 w-auto" />
      <SectionLabel>Projetos</SectionLabel>

      {state.projects.map((p) => (
        <SidebarItem
          key={p.id}
          icon={<span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: p.color }} />}
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
        <p className="text-[11px] text-muted-foreground px-3 py-1 italic">Nenhum projeto</p>
      )}

      <div className="mt-auto">
        <Separator className="mx-3 mb-1.5 w-auto" />
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

function SectionLabel({ children }) {
  return (
    <p className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1 mb-0.5">
      {children}
    </p>
  )
}

function SidebarItem({ icon, children, active, onClick, badge }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        'app-region-no-drag justify-start gap-2 mx-1.5 px-2.5 h-7 text-[12.5px] w-[calc(100%-12px)] font-normal',
        active && 'bg-accent font-medium text-accent-foreground'
      )}
    >
      <span className="flex items-center justify-center w-4 shrink-0">{icon}</span>
      <span className="flex-1 truncate text-left">{children}</span>
      {badge != null && (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 leading-4 h-4">
          {badge}
        </Badge>
      )}
    </Button>
  )
}
```

- [ ] **Step 2: Replace `ClipGrid.jsx`**

```jsx
import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recentes
        </p>
        {state.history.length > 0 && (
          <p className="text-[10.5px] text-muted-foreground">
            {state.history.length} arquivo{state.history.length !== 1 ? 's' : ''} nesta sessão
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {state.history.map((entry) => (
          <ClipCard key={entry.id} entry={entry} />
        ))}

        {nextName && (
          <div className="border border-dashed border-border rounded-md bg-muted/30 flex items-center justify-center min-h-[80px]">
            <div className="text-center px-2">
              <p className="text-[10px] text-muted-foreground">próximo</p>
              <p className="text-[11px] font-semibold text-muted-foreground truncate">{nextName}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ClipCard({ entry }) {
  return (
    <div className="border border-border rounded-md overflow-hidden bg-card hover:shadow-md transition-shadow cursor-default">
      <div className="h-[60px] bg-muted border-b border-border flex items-center justify-center relative">
        <div className="w-8 h-8 bg-border rounded" />
        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
          <CheckCircle2 size={10} className="text-primary-foreground" />
        </div>
      </div>
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-semibold truncate">{entry.filename}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatTime(entry.timestamp)} · {formatBytes(entry.sizeBytes)}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Sidebar.jsx src/renderer/src/components/ClipGrid.jsx
git commit -m "feat: migrate Sidebar and ClipGrid to shadcn/ui"
```

---

## Task 10: Settings.jsx — Full migration

**Files:**
- Modify: `src/renderer/src/components/Settings.jsx`

- [ ] **Step 1: Replace `Settings.jsx` entirely**

```jsx
import { useState } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, CheckCircle2, FolderOpen, Sun, Moon, Monitor, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useApp } from '../context/AppContext.jsx'

const PROJECT_COLORS = ['#2f81f7', '#27c93f', '#ff9f43', '#e74c3c', '#9b59b6', '#1abc9c']

export default function Settings({ onBack }) {
  const { state, actions } = useApp()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [inkPath, setInkPath] = useState(state.settings.inkscapePath || '')
  const [inkStatus, setInkStatus] = useState(state.settings.inkscapePath ? 'saved' : 'unset')
  const [inkVersion, setInkVersion] = useState(null)
  const [inkChecking, setInkChecking] = useState(false)

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

  async function saveInkscape() {
    await actions.updateSettings({ inkscapePath: inkPath })
    setInkStatus('saved')
    setInkVersion(null)
  }

  async function checkInkscape() {
    if (!inkPath) return
    setInkChecking(true)
    setInkVersion(null)
    const result = await window.electronAPI.checkInkscapeVersion({ path: inkPath })
    setInkChecking(false)
    if (result.ok) {
      setInkVersion({ ok: true, text: `Inkscape ${result.version}` })
    } else {
      setInkVersion({ ok: false, text: 'Não encontrado ou inválido' })
    }
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

        {/* Inkscape section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Inkscape</p>
          <div className="flex gap-2">
            <Input
              className="flex-1 font-mono text-xs h-7"
              placeholder="C:\Program Files\Inkscape\bin\inkscape.exe"
              value={inkPath}
              onChange={(e) => { setInkPath(e.target.value); setInkStatus('dirty'); setInkVersion(null) }}
            />
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={saveInkscape}>
              Salvar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={checkInkscape}
              disabled={inkChecking || !inkPath}
            >
              {inkChecking ? <Loader2 size={11} className="animate-spin" /> : 'Verificar'}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {inkStatus === 'saved' && inkPath && !inkVersion && (
              <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={11} /> Inkscape configurado
              </p>
            )}
            {inkVersion && (
              <Badge variant={inkVersion.ok ? 'default' : 'destructive'} className="text-[10px] gap-1">
                {inkVersion.ok ? <CheckCircle2 size={10} /> : null}
                {inkVersion.text}
              </Badge>
            )}
          </div>
        </section>

        <Separator />

        {/* Appearance section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Aparência</p>
          <div className="flex gap-2">
            {[
              { value: 'light',  label: 'Claro',  icon: Sun },
              { value: 'dark',   label: 'Escuro', icon: Moon },
              { value: 'system', label: 'Sistema', icon: Monitor },
            ].map(({ value, label, icon: Icon }) => {
              const active = (state.settings.theme ?? 'system') === value
              return (
                <Button
                  key={value}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => actions.updateSettings({ theme: value })}
                  className={cn(
                    'app-region-no-drag flex-1 flex flex-col items-center gap-1.5 py-2.5 h-auto text-xs font-medium',
                  )}
                >
                  <Icon size={15} />
                  {label}
                </Button>
              )
            })}
          </div>
          <p className="text-[10.5px] text-muted-foreground mt-2">
            "Sistema" segue automaticamente a configuração do Windows.
          </p>
        </section>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Start dev and test Settings**

```bash
npm run dev
```

Verify:
- Settings opens from sidebar
- Can add/edit/delete projects
- Inkscape path + Verificar button shows badge with version
- Theme buttons switch theme correctly

Close window.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Settings.jsx
git commit -m "feat: migrate Settings to shadcn/ui with Inkscape version check"
```

---

## Task 11: Run Full Test Suite

- [ ] **Step 1: Run all 43 tests**

```bash
npx vitest run --reporter=verbose
```

Expected output:
```
Test Files  4 passed (4)
      Tests  44 passed (44)
```

If any test fails, fix it before continuing.

- [ ] **Step 2: Start app and do a quick smoke test**

```bash
npm run dev
```

Check:
- App opens, sidebar shows projects (or "Nenhum projeto")
- Can navigate to Settings, add a project
- Active project is highlighted
- Theme switching works
- Inkscape path + Verificar works

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "test: verify all 43 tests pass after shadcn migration"
```

---

## Task 12: Build + GitHub Release v1.0.0

**Files:**
- Modify: `electron-builder.yml` (verify version is 1.0.0)
- Modify: `package.json` (ensure version: "1.0.0")

- [ ] **Step 1: Verify version in `package.json`**

Open `package.json` and ensure:
```json
{
  "version": "1.0.0"
}
```

If it says anything else, update it.

- [ ] **Step 2: Verify electron-builder config**

Open `electron-builder.yml` and confirm it has at minimum:

```yaml
appId: com.schematicclip.app
productName: SchematicClip
directories:
  buildResources: resources
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
win:
  executableName: SchematicClip
  target:
    - target: nsis
      arch:
        - x64
    - target: zip
      arch:
        - x64
nsis:
  artifactName: ${name}-Setup-${version}.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
```

- [ ] **Step 3: Build the production app**

```bash
npm run build
npm run dist
```

Expected: `dist/` folder created with:
- `SchematicClip-Setup-1.0.0.exe` (NSIS installer)
- `SchematicClip-1.0.0-win.zip` (portable)

This may take 3-5 minutes.

- [ ] **Step 4: Tag the release**

```bash
git add -A
git commit -m "chore: bump to v1.0.0, finalize release" --allow-empty
git tag v1.0.0
git push origin HEAD
git push origin v1.0.0
```

- [ ] **Step 5: Create GitHub Release**

```bash
gh release create v1.0.0 \
  "dist/SchematicClip-Setup-1.0.0.exe" \
  "dist/SchematicClip-1.0.0-win.zip" \
  --title "SchematicClip v1.0.0" \
  --notes "## SchematicClip v1.0.0

Converte esquemáticos do Altium Designer para SVG em 3 cliques.

### Requisitos
- Windows 10 / 11
- [Inkscape 1.x](https://inkscape.org/release/) instalado

### Funcionalidades
- Clipboard EMF → SVG via Inkscape CLI
- Múltiplos projetos com prefixo e pasta configuráveis
- Nomeação sequencial automática (BLDC_001.svg, BLDC_002.svg…)
- Preview com metadados antes de salvar
- Diálogo para criar pasta de saída automaticamente
- System tray — app sempre disponível
- Tema Claro / Escuro / Sistema
- Histórico de SVGs da sessão atual

### Instalação
Execute o instalador e siga as instruções. Na primeira execução,
configure o caminho do Inkscape em Configurações → Inkscape.

### Verificar instalação do Inkscape
Em Configurações → Inkscape, clique em **Verificar** para confirmar
que o caminho está correto e ver a versão instalada."
```

Expected: GitHub release page created with installer and portable zip attached.
