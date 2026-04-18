# Settings — Behavior Options & Theme System Design

## Goal

Add four behavior toggles and a full theme selector to the Settings panel, and introduce four new named themes (Snnabb, Charcoal, Black Moon, Blue Moon) alongside the existing light/dark/system options.

## Architecture

Three layers are affected: the main process (OS integration, store), the preload bridge, and the renderer (Settings UI, theme application).

**Approach:** `launchOnStartup` reads/writes directly via Electron's `app.getLoginItemSettings()` / `app.setLoginItemSettings()` — the OS is the source of truth. `startMinimized` and `closeHides` are stored in the `ProjectStore` settings store alongside `theme`.

---

## Data Model

### `ProjectStore` — `SETTINGS_DEFAULTS` additions

```js
const SETTINGS_DEFAULTS = {
  inkscapePath: null,
  conversionTimeout: 15000,
  theme: 'system',
  startMinimized: false,  // already exists — no change needed
  closeHides: true,       // NEW — default matches current hardcoded behaviour
}
```

`getSettings()` must also return `closeHides`:

```js
getSettings() {
  return {
    inkscapePath: this._settings.get('inkscapePath', null),
    conversionTimeout: this._settings.get('conversionTimeout', 15000),
    theme: this._settings.get('theme', 'system'),
    startMinimized: this._settings.get('startMinimized', false),
    closeHides: this._settings.get('closeHides', true),
  }
}
```

`launchOnStartup` is **not** stored in the settings store — the OS registry is the source of truth.

---

## Main Process (`src/main/index.js`)

### 1. BrowserWindow — `show: false`

Add `show: false` to `BrowserWindow` options so the window does not flash before `whenReady` decides whether to show it.

### 2. Startup — conditional show

```js
app.whenReady().then(() => {
  mainWindow = createWindow()
  tray = createTray(mainWindow, store)
  // ...
  if (!store.getSettings().startMinimized) {
    mainWindow.show()
  }
})
```

### 3. Close handler — conditional hide

Replace hardcoded hide with:

```js
mainWindow.on('close', (e) => {
  if (store.getSettings().closeHides) {
    e.preventDefault()
    mainWindow.hide()
  }
  // closeHides = false → window closes; app remains in tray
})
```

### 4. New IPC handlers

```js
ipcMain.handle('get-login-item-settings', () => ({
  openAtLogin: app.getLoginItemSettings().openAtLogin,
}))

ipcMain.handle('set-login-item-settings', (_e, { openAtLogin }) => {
  app.setLoginItemSettings({ openAtLogin })
  return { ok: true }
})
```

---

## Preload (`src/preload/index.js`)

Add two new entries to `electronAPI`:

```js
getLoginItemSettings: () =>
  ipcRenderer.invoke('get-login-item-settings'),
setLoginItemSettings: (data) =>
  ipcRenderer.invoke('set-login-item-settings', data),
```

---

## Theme System

### Theme identifiers

| Selector on `<html>` | Display name | Character |
|---|---|---|
| *(none)* | Sistema (padrão) | Follows OS |
| *(none)* | Claro | Light zinc |
| `.dark` | Escuro | Dark zinc |
| `.theme-snnabb` | Snnabb | Warm cream light |
| `.theme-charcoal` | Charcoal | Very dark charcoal, blue accent |
| `.theme-black-moon` | Black Moon | Dark neutral, no accent |
| `.theme-blue-moon` | Blue Moon | Dark + amber/golden accent |

### `applyTheme(theme, systemIsDark)` — updated logic

```js
function applyTheme(theme, systemIsDark) {
  const root = document.documentElement
  // Remove all theme classes
  root.classList.remove('dark', 'theme-snnabb', 'theme-charcoal', 'theme-black-moon', 'theme-blue-moon')

  if (theme === 'dark')             root.classList.add('dark')
  else if (theme === 'light')       { /* no class — :root light vars */ }
  else if (theme === 'system')      { if (systemIsDark) root.classList.add('dark') }
  else if (theme === 'snnabb')      root.classList.add('theme-snnabb')
  else if (theme === 'charcoal')    root.classList.add('theme-charcoal')
  else if (theme === 'black-moon')  root.classList.add('theme-black-moon')
  else if (theme === 'blue-moon')   root.classList.add('theme-blue-moon')
}
```

### `updateTitleBarOverlay` — extended

The four named themes are dark-based (charcoal, black-moon, blue-moon) or light-based (snnabb). The effective `isDark` for the titleBar:

```js
function effectiveIsDark(theme, systemIsDark) {
  if (theme === 'dark')       return true
  if (theme === 'light')      return false
  if (theme === 'system')     return systemIsDark
  if (theme === 'snnabb')     return false   // light theme
  // charcoal, black-moon, blue-moon are dark
  return true
}
```

### CSS vars (`src/renderer/src/index.css`)

Four new theme blocks appended after `.dark { }`:

```css
/* ── Snnabb ──────────────────────────────── warm cream light */
.theme-snnabb {
  --background: 40 30% 96%;
  --foreground: 30 15% 15%;
  --card: 40 30% 96%;
  --card-foreground: 30 15% 15%;
  --popover: 40 30% 96%;
  --popover-foreground: 30 15% 15%;
  --primary: 25 90% 55%;
  --primary-foreground: 0 0% 100%;
  --secondary: 40 20% 88%;
  --secondary-foreground: 30 15% 20%;
  --muted: 40 20% 90%;
  --muted-foreground: 30 10% 45%;
  --accent: 40 20% 88%;
  --accent-foreground: 30 15% 20%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 98%;
  --border: 40 15% 82%;
  --input: 40 15% 82%;
  --ring: 25 90% 55%;
}

/* ── Charcoal ────────────────────────────── very dark, blue accent */
.theme-charcoal {
  --background: 0 0% 10%;
  --foreground: 0 0% 90%;
  --card: 0 0% 14%;
  --card-foreground: 0 0% 90%;
  --popover: 0 0% 14%;
  --popover-foreground: 0 0% 90%;
  --primary: 213 80% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary: 0 0% 18%;
  --secondary-foreground: 0 0% 85%;
  --muted: 0 0% 18%;
  --muted-foreground: 0 0% 55%;
  --accent: 0 0% 18%;
  --accent-foreground: 0 0% 90%;
  --destructive: 0 62% 40%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 20%;
  --input: 0 0% 20%;
  --ring: 213 80% 60%;
}

/* ── Black Moon ───────────────────────────── dark neutral, no accent */
.theme-black-moon {
  --background: 220 10% 8%;
  --foreground: 220 5% 90%;
  --card: 220 10% 12%;
  --card-foreground: 220 5% 90%;
  --popover: 220 10% 12%;
  --popover-foreground: 220 5% 90%;
  --primary: 220 5% 80%;
  --primary-foreground: 220 10% 8%;
  --secondary: 220 8% 16%;
  --secondary-foreground: 220 5% 85%;
  --muted: 220 8% 16%;
  --muted-foreground: 220 5% 50%;
  --accent: 220 8% 20%;
  --accent-foreground: 220 5% 90%;
  --destructive: 0 62% 40%;
  --destructive-foreground: 0 0% 98%;
  --border: 220 8% 18%;
  --input: 220 8% 18%;
  --ring: 220 5% 60%;
}

/* ── Blue Moon ────────────────────────────── dark + amber/golden accent */
.theme-blue-moon {
  --background: 220 12% 10%;
  --foreground: 220 5% 90%;
  --card: 220 12% 14%;
  --card-foreground: 220 5% 90%;
  --popover: 220 12% 14%;
  --popover-foreground: 220 5% 90%;
  --primary: 35 90% 55%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 10% 18%;
  --secondary-foreground: 220 5% 85%;
  --muted: 220 10% 18%;
  --muted-foreground: 220 5% 52%;
  --accent: 220 10% 20%;
  --accent-foreground: 220 5% 90%;
  --destructive: 0 62% 40%;
  --destructive-foreground: 0 0% 98%;
  --border: 220 10% 20%;
  --input: 220 10% 20%;
  --ring: 35 90% 55%;
}
```

---

## Settings UI (`src/renderer/src/components/Settings.jsx`)

### New "Comportamento" section

Inserted between "Projetos" and "Inkscape". Uses a new `Switch` shadcn component.

Each row layout:
```
<div class="flex items-center justify-between py-2">
  <div>
    <p class="text-[12.5px] font-medium">Label</p>
    <p class="text-[10.5px] text-muted-foreground">Description</p>
  </div>
  <Switch checked={value} onCheckedChange={handler} />
</div>
```

Three items:
1. **Iniciar com o Windows** / "Inicia automaticamente ao fazer login" — state from `getLoginItemSettings()` IPC on mount; writes via `setLoginItemSettings()`
2. **Iniciar minimizado** / "Abre sem exibir a janela (apenas bandeja)" — `state.settings.startMinimized`; writes via `actions.updateSettings({ startMinimized })`
3. **Botão fechar oculta o app** / "× mantém o app rodando na bandeja" — `state.settings.closeHides`; writes via `actions.updateSettings({ closeHides })`

### Updated "Aparência" section

Replace the three `Button` elements with a single `<Select>`:

```jsx
<Select
  value={state.settings.theme ?? 'system'}
  onValueChange={(value) => actions.updateSettings({ theme: value })}
>
  <SelectTrigger className="h-7 text-xs">
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
```

---

## New shadcn Components Required

Run before implementation:
```bash
npx shadcn@latest add switch
npx shadcn@latest add select
```

---

## Error Handling

- `getLoginItemSettings()` can throw on sandboxed environments — wrap in try/catch, default to `false`
- `setLoginItemSettings()` failure is non-critical — log and show no error to user
- Theme CSS vars failures are silent (browser falls back to `:root`) — no special handling needed

---

## Testing

- `projectStore.test.js`: assert `closeHides` returns `true` by default; assert `getSettings()` includes all five keys
- `index.js` IPC handlers: assert `get-login-item-settings` returns `{ openAtLogin: boolean }`
- Manual: toggle each switch and verify behaviour (startup, close, theme)
- Manual: cycle through all 7 themes and verify titleBarOverlay colour updates

---

## Out of Scope

- Per-theme titleBar background matching exact screenshot pixels (approximate colours used)
- macOS `openAsHidden` support (Windows only for now)
- Tray icon colour adaptation per theme
