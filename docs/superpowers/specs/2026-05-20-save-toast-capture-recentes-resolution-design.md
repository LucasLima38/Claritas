# Save Toast, Capture Recentes & Resolution Picker — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

---

## Overview

Three independent UI improvements to the Claritas Electron app:

1. **Save Toast** — Visual feedback when saving in Clipboard or Capture mode (replaces silent dead time during Drive uploads)
2. **Capture Recentes Panel** — "Recentes" panel in Capture mode showing only capture history entries, with the same card/lightbox/context-menu behavior as the existing Clipboard panel
3. **Resolution Picker** — Per-capture resolution selector ("Baixa / Normal / Alta") in the ImageEditor controls bar

All three reuse existing patterns and components. No new IPC channels required for features 1 and 2. Feature 3 adds a `resolution` parameter to the existing `save-image` IPC handler.

---

## Feature 1: Save Toast

### Behavior

When the user clicks "Salvar" in either Clipboard mode or Capture mode, a toast notification appears in the bottom-right corner of the app window:

- **Saving state** (`type: 'saving'`): dark background, animated spinner, text "Salvando…". If the active project has Drive enabled, a sub-text "Enviando para o Drive" is shown.
- **Success state** (`type: 'success'`): green background, checkmark (✓), text "Salvo!". Visible for 2 seconds, then fades out.
- **Error state** (`type: 'error'`): red background, error message text. Visible for 4 seconds, then fades out.

The toast does not block interaction. It overlays the UI in the bottom-right corner with a fade+slide-up entrance animation.

### State

A new field is added to the global `AppContext` state:

```js
saveToast: null  // null | { message: string, subMessage?: string, type: 'saving' | 'success' | 'error' }
```

Two new dispatch actions:
- `SHOW_SAVE_TOAST` — sets `saveToast` to the provided payload
- `HIDE_SAVE_TOAST` — sets `saveToast` to `null`

### Component: `SaveToast`

New file: `src/renderer/src/components/SaveToast.jsx`

- Uses `useApp()` to read `state.saveToast`
- Rendered once in the app root (e.g. `App.jsx`), outside any tab
- Handles its own auto-dismiss timer via `useEffect`:
  - On `success`: calls `HIDE_SAVE_TOAST` after 2000 ms
  - On `error`: calls `HIDE_SAVE_TOAST` after 4000 ms
  - On `saving`: no auto-dismiss (waits for the action to resolve)

### Integration in existing actions

**`actions.save` (Clipboard)** in `AppContext.jsx`:
1. Dispatch `SHOW_SAVE_TOAST { message: 'Salvando…', subMessage: driveEnabled ? 'Enviando para o Drive' : undefined, type: 'saving' }`
2. Call `window.electronAPI.saveSVG(...)` as today
3. On success → dispatch `SHOW_SAVE_TOAST { message: 'Salvo!', type: 'success' }`
4. On error → dispatch `SHOW_SAVE_TOAST { message: errorMessage, type: 'error' }`

**`actions.saveCapture`** in `AppContext.jsx`:
Same pattern as above, triggered when the user clicks "Capturar" in `ImageEditor`.

---

## Feature 2: Capture Recentes Panel

### Behavior

The "Recentes" section in Capture mode shows only the history entries from capture (image files), with:
- Thumbnail cards (same `ClipCard` component)
- Click to open lightbox viewer (`LightboxModal`)
- Right-click context menu: "Copiar arquivo", "Ir para a pasta", "Abrir no Drive", "Deletar arquivo", "Compartilhar"
- Same delete behavior as Clipboard (local file + Drive file if applicable)

The panel does **not** show SVG/PDF entries from Clipboard mode.

The "próximo arquivo previsto" placeholder card is **not** shown in Capture mode (it depends on `activeProject.prefix` and `counter`, which are Clipboard-specific).

### Changes to `ClipGrid`

Add an optional prop `filter?: 'clipboard' | 'capture'`:

```js
const entries = filter
  ? state.history.filter(e =>
      filter === 'capture'
        ? /\.(png|jpe?g|webp)$/i.test(e.filename)
        : /\.(svg|pdf)$/i.test(e.filename)
    )
  : state.history
```

When `filter` is set, the "próximo arquivo previsto" card is suppressed (since `nextName` is only meaningful for Clipboard projects).

Guard condition updated:
```js
if (entries.length === 0 && (filter === 'capture' || !nextName)) return null
```

### Integration in `CaptureTab`

`CaptureTab.jsx` renders `<ClipGrid filter="capture" />` below the `ImageEditor` (or below `CaptureControls` when in idle/countdown state), mirroring how `ClipboardArea.jsx` renders `<ClipGrid />` at the bottom.

---

## Feature 3: Resolution Picker

### Behavior

In the ImageEditor controls bar (bottom of the capture editor), a pill-style button group appears to the left of the "Capturar" button:

```
Resolução  [ Baixa ]  [ Normal ]  [ Alta ]     [Cancelar]  [📷 Capturar]
```

- Default selection: **Normal**
- State is local to the ImageEditor session — resets to Normal on each new capture
- Labels and scale factors:
  - **Baixa** → 0.5×
  - **Normal** → 1× (current behavior, no pixel manipulation)
  - **Alta** → 2×

### Data flow

1. `ImageEditor` maintains `const [resolution, setResolution] = useState('normal')`
2. On save: `actions.saveCapture({ dataURL, format: captureFormat, resolution })`
3. `AppContext.saveCapture` passes `resolution` through to `window.electronAPI.saveImage({ ..., resolution })`
4. In `index.js`, handler `save-image` applies scaling before saving:
   - `normal`: no change (existing behavior preserved exactly)
   - `low` / `high`: use `sharp` to resize the image buffer by the scale factor before writing to disk and/or uploading to Drive

### `sharp` usage in `index.js`

`sharp` is already available in the Electron main process. The resize logic:

```js
async function applyResolution(buffer, mimeType, resolution) {
  if (resolution === 'normal' || !resolution) return buffer
  const factor = resolution === 'high' ? 2 : 0.5
  const metadata = await sharp(buffer).metadata()
  return sharp(buffer)
    .resize(Math.round(metadata.width * factor), Math.round(metadata.height * factor))
    .toBuffer()
}
```

Called after reading the image buffer, before `fs.writeFile` and before Drive upload.

---

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/src/components/SaveToast.jsx` | **New** — toast component |
| `src/renderer/src/App.jsx` | Render `<SaveToast />` in root |
| `src/renderer/src/context/AppContext.jsx` | Add `saveToast` state, `SHOW/HIDE_SAVE_TOAST` dispatches, update `save` and `saveCapture` actions |
| `src/renderer/src/components/ClipGrid.jsx` | Add `filter` prop + filtered entries logic |
| `src/renderer/src/components/CaptureTab.jsx` | Render `<ClipGrid filter="capture" />` |
| `src/renderer/src/components/ImageEditor.jsx` | Add `resolution` state + pill selector UI |
| `src/main/index.js` | Update `save-image` handler to accept and apply `resolution` via `sharp` |

---

## Out of Scope

- Persisting resolution preference between sessions (always resets to Normal)
- Toast stacking (multiple simultaneous toasts)
- Resolution picker in Clipboard mode (SVG resolution is vector-based, not pixel-based)
- Retroactive `resolution` field on existing history entries
