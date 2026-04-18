# Inkscape Bundle + Shell Mode Design

## Goal

Eliminate the external Inkscape install requirement by bundling Inkscape 1.4 Portable inside the app and replacing the per-conversion `spawn()` with a persistent `--shell` process. Users install only SchematicClip; conversions run in ~200 ms after a single cold-start.

## Architecture

Three layers change: a new `InkscapeShell` service manages the persistent process; `conversionService.js` becomes a thin wrapper; `index.js` manages the shell lifecycle. The renderer and Settings UI lose the Inkscape configuration section entirely.

**Approach:** `InkscapeShell` as an isolated class in its own file — clean boundaries, independently testable, no growth in `index.js` or `conversionService.js`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/main/inkscapeShell.js` | **Create** | `InkscapeShell` class: spawn, stdin/stdout protocol, crash detection, auto-restart |
| `scripts/setup-inkscape.js` | **Create** | Download Inkscape 1.4 Portable, verify SHA-256, extract to `resources/inkscape/` |
| `src/main/conversionService.js` | **Modify** | Remove `findInkscape()`, `checkInkscapeVersion()`. Keep `isValidSVG()`, `getSVGMetadata()`. `convert()` delegates to shell instance. |
| `src/main/index.js` | **Modify** | Start/stop shell on app lifecycle. Remove Inkscape auto-detect, `inkscapePath` check, `check-inkscape-version` IPC handler. |
| `src/main/projectStore.js` | **Modify** | Remove `inkscapePath` and `conversionTimeout` from `SETTINGS_DEFAULTS` and `getSettings()`. |
| `src/preload/index.js` | **Modify** | Remove `checkInkscapeVersion` bridge. |
| `src/renderer/src/components/Settings.jsx` | **Modify** | Remove "Inkscape" section (path input + Save/Verify buttons). |
| `src/renderer/src/components/InkscapeBanner.jsx` | **Delete** | No longer needed — Inkscape is always bundled. |
| `electron-builder.yml` | **Modify** | Add `extraResources` to copy `resources/inkscape/` into production package. |
| `package.json` | **Modify** | Add `"setup-inkscape": "node scripts/setup-inkscape.js"`. |
| `.gitignore` | **Modify** | Add `resources/inkscape/`. |
| `tests/main/inkscapeShell.test.js` | **Create** | Unit tests for `InkscapeShell` with mocked child process. |
| `tests/main/projectStore.test.js` | **Modify** | Remove `inkscapePath` assertions; confirm it is absent from `getSettings()`. |

---

## InkscapeShell Class

### Protocol

Inkscape `--shell` accepts commands on stdin and emits `> ` on stdout when ready for the next command:

```
stdin  →  "input.emf --export-filename=output.svg --export-area-drawing\n"
stdout ←  (silent processing)
stdout ←  "> "    ← completion signal
```

### Interface

```js
class InkscapeShell {
  constructor(executablePath)

  async start()
  // Spawns inkscape --shell, waits for first "> " prompt.
  // Resolves when ready. Rejects if executable not found or times out.

  stop()
  // Kills the process (called on app before-quit).

  async convert(emfPath, svgPath, timeout = 15000)
  // Writes command to stdin, waits for "> " on stdout.
  // Resolves on success, rejects with Error('TIMEOUT') or Error(message) on failure.

  get busy()
  // true while a convert() call is in progress
}
```

### Internal state

```js
_proc = null          // ChildProcess | null
_ready = false        // true after first "> " received
_buffer = ''          // stdout accumulation buffer
_pendingResolve = null  // resolve fn for the active convert() call
_pendingReject = null   // reject fn for the active convert() call
```

### Auto-restart on crash

When `proc.on('exit')` fires unexpectedly (not triggered by `stop()`):

1. If a conversion was in progress → call `_pendingReject(new Error('PROCESS_CRASHED'))` immediately
2. Set `_ready = false`, `_proc = null`
3. Call `this.start()` in background (no await — fire and forget)

The `paste-schematic` handler receives the rejected promise and returns `{ error: 'ERROR', message: '...' }` to the renderer.

### Executable path resolution

```js
import { is } from '@electron-toolkit/utils'
import path from 'path'

const inkExe = is.dev
  ? path.join(process.cwd(), 'resources/inkscape/bin/inkscape.exe')
  : path.join(process.resourcesPath, 'inkscape/bin/inkscape.exe')
```

---

## Setup Script (`scripts/setup-inkscape.js`)

Pinned version: **Inkscape 1.4** (Windows x64 Portable ZIP).

Behaviour:

1. If `resources/inkscape/bin/inkscape.exe` already exists → print "Inkscape already set up." and exit 0 (idempotent)
2. Download ZIP to a temp file
3. Verify SHA-256 against the pinned checksum constant; abort with exit 1 on mismatch
4. Extract full ZIP contents into `resources/inkscape/`
5. Delete the temp ZIP
6. Print "Inkscape Portable extracted to resources/inkscape/"

Constants at the top of the file (easy to bump on version upgrade):

```js
const INKSCAPE_URL = 'https://media.inkscape.org/dl/resources/file/inkscape-1.4_2024-09-16_x86_64.zip'
const INKSCAPE_SHA256 = '<sha256-of-the-zip>'
const DEST_DIR = path.join(process.cwd(), 'resources', 'inkscape')
```

Dependencies: only Node built-ins (`https`, `fs`, `crypto`) for download and checksum. Extraction uses PowerShell `Expand-Archive` via `child_process.execSync` — no new npm dependency required.

---

## `conversionService.js` — updated `convert()`

```js
// inkscapeShell instance injected from index.js
let _shell = null
export function setShell(shell) { _shell = shell }

export async function convert(emfBuffer, timeout = 15000) {
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

`isValidSVG()` and `getSVGMetadata()` are unchanged.

---

## `index.js` — lifecycle changes

```js
import { InkscapeShell } from './inkscapeShell.js'
import { convert, setShell, isValidSVG, getSVGMetadata } from './conversionService.js'

const inkscapeShell = new InkscapeShell(resolveInkExe())

app.whenReady().then(async () => {
  mainWindow = createWindow()
  tray = createTray(mainWindow, store)
  await inkscapeShell.start()         // non-blocking for window show
  setShell(inkscapeShell)
  if (!store.getSettings().startMinimized) mainWindow.show()
  // ...
})

app.on('before-quit', () => {
  inkscapeShell.stop()
})
```

`paste-schematic` handler:

```js
ipcMain.handle('paste-schematic', async () => {
  const emfBuffer = await readEMF()
  if (!emfBuffer) return { error: 'NO_EMF', message: '...' }
  if (inkscapeShell.busy) return { error: 'BUSY' }

  const startTime = Date.now()
  try {
    const svgContent = await convert(emfBuffer)
    if (!isValidSVG(svgContent)) return { error: 'INVALID_SVG', message: '...' }
    const metadata = getSVGMetadata(svgContent, Date.now() - startTime)
    pendingSVG = { svgContent, metadata }
    return { ok: true, svgContent, metadata }
  } catch (err) {
    pendingSVG = null
    if (err.message === 'TIMEOUT') return { error: 'TIMEOUT', message: '...' }
    return { error: 'ERROR', message: `Erro de conversão: ${err.message}` }
  }
})
```

Removed IPC handler: `check-inkscape-version`.

---

## `electron-builder.yml` — extraResources

```yaml
extraResources:
  - from: resources/inkscape
    to: inkscape
```

Copies `resources/inkscape/` (developer's local setup) into `{output}/win-unpacked/resources/inkscape/`, accessible at `process.resourcesPath + '/inkscape'` in production.

---

## `projectStore.js` — settings cleanup

Remove from `SETTINGS_DEFAULTS`:
- `inkscapePath`
- `conversionTimeout` (becomes internal constant `CONVERSION_TIMEOUT = 15000` in `inkscapeShell.js`)

Remove from `getSettings()` return value: `inkscapePath`, `conversionTimeout`.

---

## Error Codes

| Code | Trigger | Renderer message |
|---|---|---|
| `NO_EMF` | Clipboard has no EMF | "Nenhum esquemático vetorial encontrado no clipboard." |
| `BUSY` | Shell already converting | Button disabled — no toast shown |
| `TIMEOUT` | No `> ` within 15 s | "O Inkscape demorou mais de 15s. Tente novamente." |
| `INVALID_SVG` | Output SVG is blank | "Conversão incompleta — o SVG gerado está em branco." |
| `ERROR` | Any other exception | "Erro de conversão: \<message\>" |

`INKSCAPE_NOT_FOUND` is removed — the bundled executable is always present.

---

## Testing

### `tests/main/inkscapeShell.test.js` (new)

- `convert()` resolves when stdout emits `> ` after the command
- `convert()` rejects with `Error('TIMEOUT')` if `> ` does not arrive within the timeout
- Process crash during conversion rejects the active promise immediately
- `busy` is `true` during convert, `false` after resolution

### `tests/main/projectStore.test.js` (update)

- Remove assertions on `inkscapePath`
- Assert `getSettings()` does not include `inkscapePath` key

### Manual verification

1. `npm run setup-inkscape` — downloads, verifies checksum, extracts to `resources/inkscape/`
2. Running twice is idempotent (prints "already set up", no re-download)
3. `npm run dev` — app starts, shell boots in background, no visible Inkscape window
4. Paste a KiCad schematic — converts in ~200 ms
5. `npm run build:unpack` — `dist/win-unpacked/resources/inkscape/` exists
6. Launch built app — conversion works without any system Inkscape installed

---

## Out of Scope

- macOS / Linux support (Windows only)
- Inkscape version upgrade automation (manual: update URL + SHA256 constants)
- Progress indicator during the cold-start shell boot (~1–2 s on first launch)
- Bundling a stripped-down Inkscape (full portable required for EMF+ support)
