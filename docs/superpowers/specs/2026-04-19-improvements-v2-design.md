# SchematicClip v2 — Improvements Design

## Goal

Seven quality-of-life improvements delivered together: SVGO compression, cold-start indicator, interactive preview, clipboard auto-monitoring, multi-format export, configurable global shortcut, and auto-update.

## Architecture

Five new/changed boundaries:

| Boundary | Change |
|---|---|
| `clipboardMonitor.js` | **New** — 1-second polling loop; fires callback when new EMF detected |
| `updateService.js` | **New** — wraps `electron-updater`; emits `update-available` IPC event |
| `conversionService.js` | **Extended** — adds SVGO post-processing and `exportToFormat()` for non-SVG output |
| `inkscapeShell.js` | **Extended** — adds generic `execute(actions)` method used by format export |
| `AppContext.jsx` | **Extended** — adds `shellStatus`, `updateInfo`, `exportFormat` to state |

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/main/clipboardMonitor.js` | **Create** | `ClipboardMonitor` class: 1-second poll, SHA-256 dedup, fires callback on new EMF |
| `src/main/updateService.js` | **Create** | `electron-updater` wrapper: check on startup + hourly, emit IPC events |
| `src/main/inkscapeShell.js` | **Modify** | Add `execute(actions, timeout)` method; `convert()` delegates to it |
| `src/main/conversionService.js` | **Modify** | Add SVGO `optimizeSvg()` call after conversion; add `exportToFormat()` for PNG/JPG/PDF |
| `src/main/saveService.js` | **Modify** | Add `generateFilenameWithExt(prefix, counter, ext)` overload |
| `src/main/projectStore.js` | **Modify** | Add `globalShortcut` (string, default `''`) to `SETTINGS_DEFAULTS` and `getSettings()` |
| `src/main/index.js` | **Modify** | Wire clipboard monitor, update service, shell-status IPC, global shortcut, preview-ready push; update `save-svg` handler to accept `format` |
| `src/preload/index.js` | **Modify** | Expose new IPC channels: `onShellStatus`, `onPreviewReady`, `onUpdateAvailable`, `installUpdate`, `saveExport` |
| `src/renderer/src/context/AppContext.jsx` | **Modify** | Add `shellStatus`, `updateInfo`, `exportFormat` state; add `setExportFormat`, `installUpdate` actions; handle new IPC push events |
| `src/renderer/src/components/StatusBar.jsx` | **Modify** | Show "Iniciando Inkscape…" when `shellStatus === 'starting'` |
| `src/renderer/src/components/ClipboardArea.jsx` | **Modify** | Disable Colar button when `shellStatus !== 'ready'` |
| `src/renderer/src/components/PreviewArea.jsx` | **Modify** | Replace `<img>` with `react-zoom-pan-pinch` canvas on `#f5f4ef` background; add format dropdown next to Salvar |
| `src/renderer/src/components/Sidebar.jsx` | **Modify** | Add update button (Download icon + `¹` badge) at the very top, above WORKSPACE label |
| `src/renderer/src/components/Settings.jsx` | **Modify** | Add "Atalho global" section with keyboard shortcut recorder input |
| `package.json` | **Modify** | Add `svgo`, `react-zoom-pan-pinch`, `electron-updater` |
| `electron-builder.yml` | **Modify** | Add `publish` block pointing to GitHub repo for `electron-updater` |

---

## Feature Designs

### ③ Cold-start indicator

**IPC flow:**
1. `index.js`: before calling `inkscapeShell.start()`, send `shell-status` push event with `{ status: 'starting' }`
2. When `start()` resolves: send `{ status: 'ready' }`
3. If `start()` rejects: send `{ status: 'error', message }`

**Renderer state:**
- Add `shellStatus: 'starting' | 'ready' | 'error'` to `initialState` (default `'starting'`)
- `AppContext` listens to `onShellStatus` IPC event → dispatches `SHELL_STATUS` action

**UI changes:**
- `StatusBar.jsx`: when `shellStatus === 'starting'`, first dot is amber pulsing and text reads "Iniciando Inkscape…"
- `ClipboardArea.jsx`: Colar button gets `disabled={state.shellStatus !== 'ready'}` + `title="Aguardando Inkscape iniciar…"`

---

### ④ SVGO optimization

**In `conversionService.js`:**

```js
import { optimize } from 'svgo'

function optimizeSvg(svgContent) {
  const result = optimize(svgContent, {
    plugins: [{
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false,
          cleanupIds: false,
        }
      }
    }]
  })
  return result.data
}
```

Called immediately after `fsp.readFile(svgPath)` in `convert()`, before returning:
```js
let svgContent = await fsp.readFile(svgPath, 'utf8')
svgContent = optimizeSvg(svgContent)
return svgContent
```

`isValidSVG()` and `getSVGMetadata()` are unchanged — SVGO preserves `<svg>`, `width`, `height`, `viewBox`.

---

### ⑥ Interactive SVG preview (zoom + pan)

**Package:** `react-zoom-pan-pinch` v3

**Background:** The SVG canvas area always uses `background: #f5f4ef` (warm paper white) — independent of the active theme. This ensures dark-line schematics are legible in all themes including Blue Moon.

**`PreviewArea.jsx` image section replacement:**

```jsx
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch'

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls()
  return (
    <div className="absolute bottom-2 right-2 flex gap-1 z-10">
      <button onClick={() => zoomIn()} className="...">+</button>
      <button onClick={() => zoomOut()} className="...">−</button>
      <button onClick={() => resetTransform()} className="...">⟲</button>
    </div>
  )
}

// Replace the current <div className="... bg-card"> block:
<div className="relative overflow-hidden min-h-[160px]" style={{ background: '#f5f4ef' }}>
  <TransformWrapper minScale={0.3} maxScale={8} doubleClick={{ mode: 'reset' }}>
    <ZoomControls />
    <TransformComponent
      wrapperStyle={{ width: '100%', minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <img
        src={svgDataUrl}
        alt="Prévia do esquemático"
        className="max-h-56 max-w-full object-contain"
        style={{ imageRendering: 'crisp-edges' }}
        draggable={false}
      />
    </TransformComponent>
  </TransformWrapper>
</div>
```

Mouse wheel → zoom. Click + drag → pan. Double-click → reset. Buttons: `+`, `−`, `⟲`.

---

### ② Export format selector

**Supported formats:** SVG · PNG (300 DPI) · JPG (300 DPI, 95% quality) · PDF

**SVG is always the intermediate:** Inkscape converts EMF→SVG first (for preview and SVGO). When a non-SVG format is selected at save time, a second Inkscape action chain converts the optimized SVG to the final format.

**`inkscapeShell.js` — new `execute()` method:**

```js
async execute(actions, timeout = 30_000) {
  if (!this._ready) throw new Error('SHELL_NOT_READY')
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      this._pendingResolve = null
      this._pendingReject = null
      this._ready = false
      this._proc?.kill()
      reject(new Error('TIMEOUT'))
    }, timeout)
    this._pendingResolve = () => { clearTimeout(timer); resolve() }
    this._pendingReject = (err) => { clearTimeout(timer); reject(err) }
    this._proc.stdin.write(actions + '\n')
  })
}
```

`convert()` refactored to call `execute()` internally:
```js
async convert(emfPath, svgPath, timeout = 15_000) {
  if (!this._ready) throw new Error('SHELL_NOT_READY')
  const actions = `file-open:${emfPath}; export-type:svg; export-filename:${svgPath}; export-do; file-close`
  return this.execute(actions, timeout)
}
```

**`conversionService.js` — new `exportToFormat()` function:**

```js
export async function exportToFormat(svgContent, format, outputPath, timeout = 30_000) {
  if (format === 'svg') {
    await fsp.writeFile(outputPath, svgContent, 'utf8')
    return
  }
  const tmpSvg = path.join(os.tmpdir(), `schclip_exp_${randomUUID()}.svg`)
  await fsp.writeFile(tmpSvg, svgContent, 'utf8')
  try {
    const inkFormat = format === 'jpg' ? 'jpeg' : format  // Inkscape uses 'jpeg' not 'jpg'
    const dpiPart = format !== 'pdf' ? 'export-dpi:300; ' : ''
    const qualityPart = format === 'jpg' ? 'export-jpeg-quality:95; ' : ''
    const actions = `file-open:${tmpSvg}; export-type:${inkFormat}; ${dpiPart}${qualityPart}export-filename:${outputPath}; export-do; file-close`
    await _shell.execute(actions, timeout)
  } finally {
    await fsp.unlink(tmpSvg).catch(() => {})
  }
}
```

**`saveService.js` — `generateFilenameWithExt()`:**

```js
export function generateFilenameWithExt(prefix, counter, ext) {
  const padded = String(counter).padStart(3, '0')
  return `${prefix}${padded}.${ext}`
}
```

**`index.js` — updated `save-svg` handler:**

```js
ipcMain.handle('save-svg', async (_event, { projectId, format = 'svg' }) => {
  if (!pendingSVG) return { error: 'NO_PENDING', message: '...' }
  const project = store.getProjects().find((p) => p.id === projectId)
  if (!project) return { error: 'PROJECT_NOT_FOUND', message: '...' }

  const dirCheck = await checkOutputDir(project.outputDir)
  if (!dirCheck.exists) return { dirMissing: true, outputDir: project.outputDir }

  const ext = format  // 'svg' | 'png' | 'jpg' | 'pdf'
  const filename = generateFilenameWithExt(project.prefix, project.counter + 1, ext)
  const fullPath = path.join(project.outputDir, filename)

  try {
    await exportToFormat(pendingSVG.svgContent, format, fullPath)
    const newCounter = store.incrementCounter(projectId)
    const entry = { id: crypto.randomUUID(), filename, fullPath, projectId, timestamp: new Date().toISOString(), sizeBytes: pendingSVG.metadata.sizeBytes }
    store.addHistoryEntry(entry)
    pendingSVG = null
    updateTrayMenu(mainWindow, store)
    return { ok: true, filename, fullPath, entry, newCounter }
  } catch (err) {
    return { error: 'ERROR', message: err.message }
  }
})
```

**`PreviewArea.jsx` — format dropdown:**

```jsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// In the header div, replace the Salvar button with:
<div className="flex gap-1.5 items-center">
  <Button variant="outline" size="sm" onClick={actions.discard} disabled={isSaving} className="h-6 px-2.5 text-[11px]">
    Descartar
  </Button>
  <Select value={state.exportFormat} onValueChange={actions.setExportFormat}>
    <SelectTrigger className="h-6 w-[60px] text-[11px] px-2 app-region-no-drag">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="svg">SVG</SelectItem>
      <SelectItem value="png">PNG</SelectItem>
      <SelectItem value="jpg">JPG</SelectItem>
      <SelectItem value="pdf">PDF</SelectItem>
    </SelectContent>
  </Select>
  <Button size="sm" onClick={actions.save} disabled={isSaving} className="h-6 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white">
    {isSaving ? 'Salvando...' : 'Salvar →'}
  </Button>
</div>
```

**`AppContext.jsx`:**
- Add `exportFormat: 'svg'` to `initialState`
- Add `SET_EXPORT_FORMAT` reducer case
- Add `setExportFormat(format)` action
- Update `save()` action to pass `format: state.exportFormat` to `saveSVG` IPC call
- Update `StatusBar` next-filename display to use the active `exportFormat` extension

---

### ⑦ Clipboard auto-monitoring

**`clipboardMonitor.js`:**

```js
import { createHash } from 'crypto'
import { readEMF } from './clipboardService.js'

export class ClipboardMonitor {
  constructor(onNewEMF) {
    this._onNewEMF = onNewEMF
    this._lastHash = null
    this._interval = null
    this._checking = false
  }

  start() {
    this._interval = setInterval(() => this._check(), 1000)
  }

  stop() {
    clearInterval(this._interval)
    this._interval = null
  }

  async _check() {
    if (this._checking) return
    this._checking = true
    try {
      const buffer = await readEMF()
      if (!buffer) return
      const hash = createHash('sha256').update(buffer).digest('hex')
      if (hash === this._lastHash) return
      this._lastHash = hash
      await this._onNewEMF(buffer)
    } catch {
      // silently ignore transient clipboard errors
    } finally {
      this._checking = false
    }
  }
}
```

**`index.js` — callback wired to existing paste logic:**

```js
const clipboardMonitor = new ClipboardMonitor(async (emfBuffer) => {
  // Only auto-convert if shell is ready and not already converting
  if (!inkscapeShell.ready || inkscapeShell.busy) return

  try {
    const svgContent = await convert(emfBuffer)
    if (!isValidSVG(svgContent)) return
    const metadata = getSVGMetadata(svgContent, 0)
    pendingSVG = { svgContent, metadata }

    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      // Window already visible → push preview immediately
      mainWindow.webContents.send('preview-ready', { svgContent, metadata })
    } else {
      // Window hidden → blink tray to notify user
      startTrayBlink()
    }
  } catch {
    // silently ignore auto-conversion errors
  }
})
```

**Tray blink:**
```js
let _blinkInterval = null

function startTrayBlink() {
  if (_blinkInterval) return   // already blinking
  let visible = true
  _blinkInterval = setInterval(() => {
    tray.setImage(visible ? alertIcon : normalIcon)
    visible = !visible
  }, 500)
}

function stopTrayBlink() {
  if (_blinkInterval) { clearInterval(_blinkInterval); _blinkInterval = null }
  tray.setImage(normalIcon)
}
```

Two icon files needed: `resources/icon.png` (existing) and `resources/icon-alert.png` (same icon with a small green dot overlay — created as a static asset).

**When tray clicked OR window shown (via global shortcut):**
```js
// In the 'click' handler on tray and in the globalShortcut callback:
stopTrayBlink()
mainWindow.show()
mainWindow.focus()
if (pendingSVG) {
  mainWindow.webContents.send('preview-ready', pendingSVG)
}
```

**Renderer — `AppContext.jsx`:**
```js
window.electronAPI.onPreviewReady(({ svgContent, metadata }) => {
  dispatch({ type: 'SVG_READY', svgContent, metadata })
})
```

Clipboard monitor started in `app.whenReady()` after shell init. Stopped in `before-quit`.

---

### ① Global keyboard shortcut (configurable)

**`projectStore.js`:**
```js
const SETTINGS_DEFAULTS = {
  startMinimized: false,
  closeHides: true,
  theme: 'system',
  globalShortcut: '',       // ← new; empty = no shortcut registered
}
```

**`index.js` — registration helper:**

```js
import { globalShortcut } from 'electron'

let _registeredShortcut = ''

function applyGlobalShortcut(shortcut) {
  if (_registeredShortcut) {
    globalShortcut.unregister(_registeredShortcut)
    _registeredShortcut = ''
  }
  if (!shortcut) return
  const ok = globalShortcut.register(shortcut, () => {
    stopTrayBlink()
    mainWindow.show()
    mainWindow.focus()
    if (pendingSVG) mainWindow.webContents.send('preview-ready', pendingSVG)
  })
  if (ok) _registeredShortcut = shortcut
  else console.warn('Could not register global shortcut:', shortcut)
}
```

Called once in `app.whenReady()` with `store.getSettings().globalShortcut`, and again inside `update-settings` handler when `updates.globalShortcut !== undefined`.

Unregistered in `before-quit`.

**`Settings.jsx` — shortcut recorder:**

New section "Atalho global" below Comportamento, above Aparência:

```jsx
function ShortcutRecorder({ value, onChange }) {
  const [recording, setRecording] = useState(false)

  function handleKeyDown(e) {
    e.preventDefault()
    if (e.key === 'Escape') { setRecording(false); return }
    const mods = []
    if (e.ctrlKey)  mods.push('Ctrl')
    if (e.altKey)   mods.push('Alt')
    if (e.shiftKey) mods.push('Shift')
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
    if (['Control','Alt','Shift','Meta'].includes(key)) return  // modifier alone — wait
    if (mods.length === 0) return  // no modifier — invalid
    const combo = [...mods, key].join('+')
    onChange(combo)
    setRecording(false)
  }

  return (
    <div className="flex gap-2 items-center">
      <div
        tabIndex={0}
        onFocus={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={recording ? handleKeyDown : undefined}
        className="h-7 px-2.5 rounded-md border border-border text-xs flex items-center min-w-[140px] cursor-pointer bg-background focus:ring-1 focus:ring-primary"
      >
        {recording ? 'Pressione as teclas…' : (value || <span className="text-muted-foreground">Nenhum</span>)}
      </div>
      {value && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => onChange('')}>
          Limpar
        </Button>
      )}
    </div>
  )
}
```

Used in the Settings section:
```jsx
<section>
  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Atalho global</p>
  <div className="flex flex-col gap-1">
    <Label className="text-[10.5px]">Abrir preview (funciona mesmo com o app minimizado)</Label>
    <ShortcutRecorder
      value={state.settings.globalShortcut ?? ''}
      onChange={(v) => actions.updateSettings({ globalShortcut: v })}
    />
    <p className="text-[10.5px] text-muted-foreground mt-1">Ex: Ctrl+Shift+S · Requer pelo menos um modificador (Ctrl, Alt, Shift)</p>
  </div>
</section>
```

---

### ⑤ Auto-update

**Prerequisites (setup once in GitHub):**
- Create a GitHub release with tag matching `package.json` `version` (e.g. `v1.0.0`)
- Release must contain the installer built by `npm run dist`
- The `electron-builder.yml` `publish` block must point to the correct GitHub owner/repo

**`electron-builder.yml`:**
```yaml
publish:
  provider: github
  owner: <github-username>
  repo: SchematicClip
```

**`updateService.js`:**
```js
import { autoUpdater } from 'electron-updater'
import { ipcMain } from 'electron'

export function initAutoUpdater(mainWindow) {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message)
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // Check now and every hour
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000)
}
```

**`Sidebar.jsx` — update button:**

Added at the very top of the sidebar div, before the `<SectionLabel>Workspace</SectionLabel>`:

```jsx
{state.updateInfo && (
  <div className="px-1.5 pb-1">
    <Button
      variant="ghost"
      onClick={() => setUpdateDialogOpen(true)}
      className="app-region-no-drag w-full justify-start gap-2 mx-0 px-2.5 h-7 text-[12.5px] font-normal text-amber-500 hover:text-amber-400"
    >
      <span className="relative flex items-center justify-center w-4 shrink-0">
        <Download size={14} />
        <sup className="absolute -top-1 -right-1.5 text-[8px] font-bold">1</sup>
      </span>
      <span className="flex-1 truncate text-left">Atualização</span>
    </Button>
  </div>
)}
```

When no update: button is hidden entirely.

**Update dialog (inline in Sidebar or as separate component):**
```jsx
<AlertDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Atualização disponível</AlertDialogTitle>
      <AlertDialogDescription>
        Versão {state.updateInfo?.version} está pronta para instalar.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Depois</AlertDialogCancel>
      <AlertDialogAction onClick={() => window.electronAPI.installUpdate()}>
        Agora (reiniciar)
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**`AppContext.jsx`:**
- Add `updateInfo: null` to initialState
- Add `UPDATE_AVAILABLE` reducer case → sets `updateInfo: { version, releaseDate }`
- Listen to `onUpdateAvailable` IPC push → dispatch `UPDATE_AVAILABLE`
- Add `installUpdate()` action → calls `window.electronAPI.installUpdate()`

---

## New IPC Channels Summary

| Channel | Direction | Payload | Description |
|---|---|---|---|
| `shell-status` | main → renderer | `{ status: 'starting'\|'ready'\|'error' }` | Shell lifecycle events |
| `preview-ready` | main → renderer | `{ svgContent, metadata }` | Auto-monitor conversion done |
| `update-available` | main → renderer | `{ version, releaseDate }` | New version found |
| `install-update` | renderer → main | — | User confirms update install |
| `save-svg` | renderer → main | `{ projectId, format }` | Extended with `format` field |

---

## `projectStore.js` — updated `getSettings()`

```js
getSettings() {
  return {
    startMinimized: this._settings.get('startMinimized', false),
    closeHides: this._settings.get('closeHides', true),
    theme: this._settings.get('theme', 'system'),
    globalShortcut: this._settings.get('globalShortcut', ''),
  }
}
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| SVGO throws | Catch, log, return original SVG unchanged |
| `exportToFormat` Inkscape timeout | Return `{ error: 'TIMEOUT' }` — same as existing |
| Auto-monitor conversion error | Silent — do not show any UI, just stop blinking |
| Global shortcut already taken | Log warning, do not crash — setting stays saved |
| `electron-updater` network error | Logged silently, no UI impact |
| Shortcut with no modifier | Rejected in recorder UI before reaching main process |

---

## Testing

### New unit tests

**`tests/main/inkscapeShell.test.js`** (extend):
- `execute()` resolves when stdout emits `> `
- `execute()` rejects with TIMEOUT when no prompt arrives

**`tests/main/conversionService.test.js`** (extend):
- `exportToFormat('svg', ...)` writes content directly, no shell call
- `exportToFormat('png', ...)` calls `_shell.execute()` with correct action string
- SVGO optimization runs: output is shorter than input and still valid SVG

**`tests/main/clipboardMonitor.test.js`** (new):
- Callback fires when EMF hash changes
- Callback does NOT fire for same EMF twice
- Does not fire when no EMF on clipboard

**`tests/main/projectStore.test.js`** (extend):
- `getSettings()` includes `globalShortcut`
- `globalShortcut` defaults to `''`

### Manual verification checklist

1. `npm run dev` → StatusBar shows "Iniciando Inkscape…" for ~1-2s, then "Monitorando"
2. Colar button disabled during startup, enabled after
3. Copy schematic in KiCad → within 1s, tray blinks → click tray → preview appears automatically
4. Preview supports mouse-wheel zoom and click-drag pan; double-click resets; `+`/`−`/`⟲` buttons work
5. Preview background is `#f5f4ef` (cream white) in all 7 themes including Blue Moon
6. Format dropdown in preview: switch to PNG → click Salvar → file saved as `.png` (not `.svg`)
7. Settings → Atalho global → click field → press Ctrl+Shift+S → field shows "Ctrl+Shift+S" → pressing it globally brings app to front
8. Settings → empty shortcut with "Limpar" → shortcut no longer works globally
9. SVG files are smaller after SVGO (compare raw vs saved)
10. GitHub release created → update button appears in sidebar with `¹` → clicking installs
