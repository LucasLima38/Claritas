# Google Auth + Drive Sync + Sharing Design

## Overview

Add Google account integration to Claritas: OAuth 2.0 login via system browser (PKCE), project sync via Google Drive `appDataFolder`, and file sharing via Drive `drive.file` scope. The "Conta" sidebar menu item (currently disabled) becomes fully functional.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  RENDERER                                               │
│  AccountPanel.jsx  →  IPC  →  Main Process              │
│  (login, status, sync status, share dialog)             │
└─────────────────────────────────────────────────────────┘
                          │ IPC
┌─────────────────────────────────────────────────────────┐
│  MAIN PROCESS                                           │
│                                                         │
│  authService.js     PKCE flow, tokens, safeStorage      │
│  driveService.js    Upload, share, list files           │
│  syncService.js     Push/pull projects.json             │
└─────────────────────────────────────────────────────────┘
                          │ googleapis npm
┌─────────────────────────────────────────────────────────┐
│  GOOGLE APIs                                            │
│  OAuth 2.0  │  Drive appDataFolder  │  Drive files      │
└─────────────────────────────────────────────────────────┘
```

### New Files (main)

| File | Responsibility |
|------|---------------|
| `src/main/authService.js` | PKCE flow, loopback HTTP server, `safeStorage` encryption, token refresh |
| `src/main/driveService.js` | Upload, share, list files via `googleapis` |
| `src/main/syncService.js` | Pull/push `projects.json` in `appDataFolder` |

### New Files (renderer)

| File | Responsibility |
|------|---------------|
| `src/renderer/src/components/AccountPanel.jsx` | Login UI, account status, sync button, share dialog trigger |

### Modified Files

| File | Change |
|------|--------|
| `src/main/index.js` | New IPC handlers: `google-login`, `google-logout`, `sync-projects`, `share-file` |
| `src/preload/index.js` | Expose new IPC methods via `contextBridge` |
| `src/renderer/src/context/AppContext.jsx` | Add `account: null` to initial state; reducer cases `SET_ACCOUNT`, `SET_SYNCING`, `SET_SYNC_ERROR` |
| `src/renderer/src/components/Sidebar.jsx` | Enable "Conta" `DropdownMenuItem`, pass `onOpenAccount` prop |
| `src/renderer/src/App.jsx` | Add `accountOpen` state, render `<AccountPanel>` |

---

## Auth Flow

### Login

1. Renderer calls `window.electronAPI.googleLogin()`
2. Main generates `code_verifier` + `code_challenge` (PKCE SHA-256)
3. Main opens a temporary HTTP server on a random free `localhost:PORT`
4. Main opens system browser with Google authorization URL
   - Scopes: `openid email profile https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file`
   - Redirect URI: `http://localhost:PORT/callback`
5. User completes login in browser → Google redirects to `http://localhost:PORT/callback?code=...`
6. Server captures `code`, exchanges for `access_token` + `refresh_token` via `googleapis`
7. Tokens saved with `electron.safeStorage.encryptString()` in `electron-store` under key `googleTokens`
8. HTTP server closed
9. Main emits push event `account-changed` to renderer with `{ email, name, photo }`

### Persistent Session

- On app start, `authService` loads tokens from store; if valid (or refreshed), emits `account-changed` automatically
- `googleapis` refreshes `access_token` automatically when expired

### Logout

1. Revoke token via Google API
2. Clear `googleTokens` and `googleUser` from store
3. Emit `account-changed` with `null`

### Stored Data

```js
// electron-store
{
  googleTokens: "<safeStorage encrypted string>",  // JSON with access + refresh token
  googleUser: { email, name, photo }               // plain, not sensitive
}
```

---

## Sync Flow

**Strategy:** `projects.json` in Drive `appDataFolder` (hidden from user's Drive UI). Last-write-wins with `updatedAt` timestamp.

### Push (local → Drive)

- Triggered automatically after `addProject`, `updateProject`, `deleteProject`, `reorderProjects` — only if user is logged in
- Main serializes current `projects` array + `updatedAt: Date.now()` and upserts `projects.json` in `appDataFolder`

### Pull (Drive → local)

- Triggered once on login
- Main downloads `projects.json` from Drive
- Compares `updatedAt` from Drive with local
- If Drive is newer: replaces local projects, emits `projects-updated` to renderer
- If local is newer (or Drive has no file): pushes local state immediately

### `projects.json` Structure (in Drive)

```json
{
  "updatedAt": 1715000000000,
  "projects": [
    { "id": "...", "name": "...", "color": "...", "outputDir": "...", "counter": 0 }
  ]
}
```

### `outputDir` Conflict

Paths are Windows-specific. On pull:
- If project `id` already exists locally: keep local `outputDir`
- If project `id` is new: set `outputDir: ""` and add an `info` notification: *"Projeto '<name>' sincronizado — configure a pasta de saída."*

### IPC

| Channel | Direction | Description |
|---------|-----------|-------------|
| `sync-projects` | renderer → main | Manual pull (button in AccountPanel) |

Push is internal to main (no extra IPC).

---

## Sharing Flow

1. User clicks "Compartilhar" on a history entry in `ClipGrid`
2. A small inline dialog opens asking for the recipient's email address
3. Renderer calls `window.electronAPI.shareFile({ fullPath, email })`
4. Main reads the file from disk (`fullPath`)
5. Uploads to user's Drive (`drive.file` scope, visible root folder) with the original filename
6. Creates read permission for the provided `email` via Drive API
7. Returns `{ webViewLink }` to renderer
8. Renderer shows toast: *"Compartilhado com `<email>`"* + "Copiar link" button

### Details

- Permission: `role: "reader"`, `type: "user"`, `emailAddress: email`
- Google sends the default Drive share email notification to the recipient
- Shared files remain in the user's Drive; the app does not manage deletion
- "Compartilhar" button is only visible in `ClipGrid` when the user is logged in
- Share dialog is an inline component inside `ClipGrid.jsx` (no new file)

### IPC

| Channel | Direction | Payload |
|---------|-----------|---------|
| `share-file` | renderer → main | `{ fullPath: string, email: string }` → `{ ok: bool, webViewLink?: string, error?: string }` |

---

## State Shape

Added to `AppContext` initial state:

```js
account: null
// or when logged in:
account: {
  email: string,
  name: string,
  photo: string,
  syncing: boolean,     // true during push/pull
  syncError: string | null
}
```

New reducer cases:
- `SET_ACCOUNT` — sets `account` (null on logout, object on login)
- `SET_SYNCING` — updates `account.syncing`
- `SET_SYNC_ERROR` — updates `account.syncError`

New IPC push events (renderer listens via `onAccountChanged`):
- `account-changed` — payload: `null` or `{ email, name, photo }`

---

## IPC Summary

| Channel | Direction | Payload |
|---------|-----------|---------|
| `google-login` | renderer → main | — → `{ ok, error? }` |
| `google-logout` | renderer → main | — → `{ ok }` |
| `sync-projects` | renderer → main | — → `{ ok, error? }` |
| `share-file` | renderer → main | `{ fullPath, email }` → `{ ok, webViewLink?, error? }` |
| `account-changed` | main → renderer | `null` or `{ email, name, photo }` |

---

## Error Handling

### Auth

| Scenario | Behavior |
|----------|----------|
| Browser closed before completing login | Loopback server times out after 5 min, rejects with `"Login cancelado"` |
| Token refresh fails (revoked by user) | Auto-logout + `info` notification: *"Sessão Google expirada. Faça login novamente."* |
| `localhost` port in use | Tries up to 10 random ports before failing |

### Sync

| Scenario | Behavior |
|----------|----------|
| No internet connection | Push fails silently (does not block app); pull shows error in AccountPanel |
| Drive returns 401 | Attempts token refresh; if that fails, auto-logout |
| Corrupted `projects.json` in Drive | Treated as empty Drive; pushes local state |

### Share

| Scenario | Behavior |
|----------|----------|
| File not found on disk | Immediate error: *"Arquivo não encontrado"* |
| Invalid email | Drive API returns 400 → toast: *"E-mail inválido"* |
| File > 100 MB | Warning dialog shown before upload |
| Upload fails due to Drive quota | Toast with error message from Drive API |

---

## Dependencies

Add to `package.json` dependencies:
```json
"googleapis": "^144.0.0"
```

No new dev dependencies needed.

---

## Out of Scope

- Apple Sign-In
- Syncing settings, history, or capture files
- Per-file sharing management (list/revoke shared files)
- Shared file deletion from Drive
- Offline queue for failed pushes
- Multi-account support
- Notification sounds or OS-level toasts for sync events
