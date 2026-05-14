# Google Auth + Drive Sync + Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth 2.0 login (PKCE), Drive `appDataFolder` project sync, and Drive file sharing to Claritas, enabling the "Conta" sidebar item.

**Architecture:** Three new main-process services (`authService`, `driveService`, `syncService`) handle OAuth tokens, Drive API calls, and sync logic respectively. Four new IPC channels wire these to the renderer. A new `AccountPanel` dialog + inline share UI in `ClipGrid` complete the renderer side.

**Tech Stack:** `googleapis ^144.0.0`, Node.js `crypto`/`http` built-ins, `electron.safeStorage` (DPAPI), `electron-store`, Vitest + @testing-library/react

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/main/authService.js` | PKCE flow, loopback callback server, safeStorage encryption, token refresh |
| Create | `src/main/driveService.js` | Upload, share, appData list/get/upsert via `googleapis` |
| Create | `src/main/syncService.js` | Pull/push `projects.json` — pure logic, no side effects |
| Create | `src/renderer/src/components/AccountPanel.jsx` | Login dialog, account status, sync button |
| Create | `tests/main/authService.test.js` | Tests for PKCE generation, token storage, session loading |
| Create | `tests/main/driveService.test.js` | Tests for Drive upload, share, appData operations |
| Create | `tests/main/syncService.test.js` | Tests for pull/push merge logic |
| Modify | `src/main/projectStore.js` | Add `getProjectsUpdatedAt()` + `touchProjectsUpdatedAt()` |
| Modify | `src/main/index.js` | New IPC handlers + `touchProjectsUpdatedAt()` in project mutation handlers |
| Modify | `src/preload/index.js` | Expose `googleLogin`, `googleLogout`, `syncProjects`, `shareFile`, `onAccountChanged` |
| Modify | `src/renderer/src/context/AppContext.jsx` | `account` in state, 3 reducer cases, 4 actions, `onAccountChanged` listener |
| Modify | `src/renderer/src/components/Sidebar.jsx` | Enable "Conta" item, accept `onOpenAccount` prop |
| Modify | `src/renderer/src/App.jsx` | `accountOpen` state, render `<AccountPanel>`, pass `onOpenAccount` |
| Modify | `src/renderer/src/components/ClipGrid.jsx` | Inline share Dialog inside `ClipCard` |
| Modify | `tests/renderer/App.test.jsx` | Add `onAccountChanged` mock to `window.electronAPI` |
| Modify | `package.json` | Add `"googleapis": "^144.0.0"` |

---

### Task 1: Install `googleapis` and scaffold `authService.js`

**Files:**
- Modify: `package.json`
- Create: `src/main/authService.js`
- Create: `tests/main/authService.test.js`

- [ ] **Step 1: Add `googleapis` to `package.json`**

Open `package.json`. In the `"dependencies"` object, add:

```json
"googleapis": "^144.0.0"
```

Then run:
```bash
npm install
```

Expected: `googleapis` appears in `node_modules`, no peer-dep errors.

- [ ] **Step 2: Write the failing tests for PKCE generation and token storage**

Create `tests/main/authService.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must mock before import
vi.mock('googleapis', () => {
  const mockOAuth2 = vi.fn().mockImplementation(() => ({
    generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/auth?fake'),
    getToken: vi.fn().mockResolvedValue({
      tokens: { access_token: 'at', refresh_token: 'rt', expiry_date: 9999999999999 }
    }),
    setCredentials: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue({ token: 'at' }),
    revokeToken: vi.fn().mockResolvedValue({}),
    on: vi.fn(),
  }))
  return {
    google: {
      auth: { OAuth2: mockOAuth2 },
      oauth2: vi.fn().mockReturnValue({
        userinfo: {
          get: vi.fn().mockResolvedValue({
            data: { email: 'test@example.com', name: 'Test User', picture: 'http://pic' }
          })
        }
      }),
    }
  }
})

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn((s) => Buffer.from('encrypted:' + s)),
    decryptString: vi.fn((b) => b.toString().replace('encrypted:', '')),
  },
  shell: { openExternal: vi.fn() },
}))

vi.mock('node:http', () => {
  const EventEmitter = require('node:events')
  class MockServer extends EventEmitter {
    constructor() {
      super()
      this._requestHandler = null
    }
    listen(_port, _host, cb) {
      process.nextTick(() => {
        this.address = () => ({ port: 54321 })
        cb?.()
      })
      return this
    }
    close() {}
  }
  let instance
  const createServer = vi.fn((handler) => {
    instance = new MockServer()
    instance._requestHandler = handler
    return instance
  })
  createServer._getInstance = () => instance
  return { default: { createServer, _getInstance: () => instance } }
})

let authService
let mockStore

beforeEach(async () => {
  vi.resetModules()
  mockStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }
  // Re-import fresh module after resetModules
  authService = await import('../../src/main/authService.js')
  authService.initAuthService(mockStore)
})

describe('initAuthService', () => {
  it('sets the store without throwing', () => {
    expect(() => authService.initAuthService(mockStore)).not.toThrow()
  })
})

describe('getAuthClient', () => {
  it('returns null when no tokens stored', () => {
    mockStore.get.mockReturnValue(undefined)
    expect(authService.getAuthClient()).toBeNull()
  })

  it('returns an OAuth2 client when tokens are stored', () => {
    const tokens = { access_token: 'at', refresh_token: 'rt' }
    const { safeStorage } = await import('electron')
    safeStorage.encryptString.mockReturnValue(Buffer.from('encrypted:' + JSON.stringify(tokens)))
    const encrypted = Buffer.from('encrypted:' + JSON.stringify(tokens)).toString('base64')
    mockStore.get.mockImplementation((key) => {
      if (key === 'googleTokens') return encrypted
      return undefined
    })
    const client = authService.getAuthClient()
    expect(client).not.toBeNull()
  })
})

describe('loadStoredSession', () => {
  it('returns null when no tokens in store', async () => {
    mockStore.get.mockReturnValue(undefined)
    const result = await authService.loadStoredSession()
    expect(result).toBeNull()
  })

  it('returns user object when tokens and user exist and are valid', async () => {
    const tokens = { access_token: 'at', refresh_token: 'rt' }
    const user = { email: 'test@example.com', name: 'Test User', photo: 'http://pic' }
    const { safeStorage } = await import('electron')
    const encrypted = Buffer.from('encrypted:' + JSON.stringify(tokens)).toString('base64')
    mockStore.get.mockImplementation((key) => {
      if (key === 'googleTokens') return encrypted
      if (key === 'googleUser') return user
      return undefined
    })
    const result = await authService.loadStoredSession()
    expect(result).toEqual(user)
  })

  it('clears store and returns null when getAccessToken throws', async () => {
    const { google } = await import('googleapis')
    google.auth.OAuth2.mockImplementationOnce(() => ({
      setCredentials: vi.fn(),
      getAccessToken: vi.fn().mockRejectedValue(new Error('token expired')),
      on: vi.fn(),
    }))
    const tokens = { access_token: 'at', refresh_token: 'rt' }
    const user = { email: 'test@example.com', name: 'Test', photo: '' }
    const encrypted = Buffer.from('encrypted:' + JSON.stringify(tokens)).toString('base64')
    mockStore.get.mockImplementation((key) => {
      if (key === 'googleTokens') return encrypted
      if (key === 'googleUser') return user
      return undefined
    })
    const result = await authService.loadStoredSession()
    expect(result).toBeNull()
    expect(mockStore.delete).toHaveBeenCalledWith('googleTokens')
    expect(mockStore.delete).toHaveBeenCalledWith('googleUser')
  })
})

describe('logout', () => {
  it('deletes all token keys and returns ok', async () => {
    mockStore.get.mockReturnValue(undefined)
    const result = await authService.logout()
    expect(result).toEqual({ ok: true })
    expect(mockStore.delete).toHaveBeenCalledWith('googleTokens')
    expect(mockStore.delete).toHaveBeenCalledWith('googleUser')
    expect(mockStore.delete).toHaveBeenCalledWith('googleTokensPlain')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run tests/main/authService.test.js
```

Expected: FAIL — module `../../src/main/authService.js` not found.

- [ ] **Step 4: Create `src/main/authService.js`**

```js
import crypto from 'node:crypto'
import http from 'node:http'
import { google } from 'googleapis'
import { safeStorage, shell } from 'electron'

const CLIENT_ID = ''
const CLIENT_SECRET = ''
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
]
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

let _store = null

export function initAuthService(store) {
  _store = store
}

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

function startCallbackServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    let pendingResolve, pendingReject
    const codePromise = new Promise((res, rej) => {
      pendingResolve = res
      pendingReject = rej
    })
    server.on('request', (req, res) => {
      const url = new URL(req.url, 'http://localhost')
      const code = url.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<html><body><p>Login concluído. Pode fechar esta aba.</p></body></html>')
      server.close()
      if (code) pendingResolve(code)
      else pendingReject(new Error('Código de autorização não recebido'))
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ port, codePromise })
    })
    server.on('error', reject)
  })
}

function saveTokens(tokens) {
  if (safeStorage.isEncryptionAvailable()) {
    _store.set('googleTokens', safeStorage.encryptString(JSON.stringify(tokens)).toString('base64'))
    _store.delete('googleTokensPlain')
  } else {
    _store.set('googleTokens', JSON.stringify(tokens))
    _store.set('googleTokensPlain', true)
  }
}

function loadTokens() {
  const stored = _store.get('googleTokens')
  if (!stored) return null
  try {
    if (_store.get('googleTokensPlain')) return JSON.parse(stored)
    return JSON.parse(safeStorage.decryptString(Buffer.from(stored, 'base64')))
  } catch {
    return null
  }
}

export function getAuthClient() {
  const tokens = loadTokens()
  if (!tokens) return null
  const client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)
  client.setCredentials(tokens)
  client.on('tokens', (newTokens) => saveTokens({ ...loadTokens(), ...newTokens }))
  return client
}

export async function loginWithGoogle() {
  const { port, codePromise } = await startCallbackServer()
  const redirectUri = `http://localhost:${port}/callback`
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri)
  const { codeVerifier, codeChallenge } = generatePKCE()
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    prompt: 'consent',
  })
  let timeoutId
  const timeoutPromise = new Promise((_, rej) => {
    timeoutId = setTimeout(() => rej(new Error('Login cancelado')), LOGIN_TIMEOUT_MS)
  })
  shell.openExternal(authUrl)
  const code = await Promise.race([codePromise, timeoutPromise])
  clearTimeout(timeoutId)
  const { tokens } = await oauth2Client.getToken({ code, codeVerifier })
  oauth2Client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data } = await oauth2.userinfo.get()
  const user = { email: data.email, name: data.name, photo: data.picture }
  saveTokens(tokens)
  _store.set('googleUser', user)
  return { ok: true, user }
}

export async function loadStoredSession() {
  const tokens = loadTokens()
  const user = _store.get('googleUser')
  if (!tokens || !user) return null
  try {
    await getAuthClient().getAccessToken()
    return user
  } catch {
    _store.delete('googleTokens')
    _store.delete('googleUser')
    _store.delete('googleTokensPlain')
    return null
  }
}

export async function logout() {
  try {
    const tokens = loadTokens()
    if (tokens?.access_token) await getAuthClient().revokeToken(tokens.access_token)
  } catch {}
  _store.delete('googleTokens')
  _store.delete('googleUser')
  _store.delete('googleTokensPlain')
  return { ok: true }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/main/authService.test.js
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/authService.js tests/main/authService.test.js package.json package-lock.json
git commit -m "feat: add authService with PKCE OAuth2 flow and safeStorage token handling"
```

---

### Task 2: Create `driveService.js`

**Files:**
- Create: `src/main/driveService.js`
- Create: `tests/main/driveService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/driveService.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('googleapis', () => {
  const mockDrive = {
    files: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    permissions: {
      create: vi.fn(),
    },
  }
  return {
    google: {
      drive: vi.fn().mockReturnValue(mockDrive),
    },
  }
})

let driveService
let mockAuthClient
let mockDriveInstance

beforeEach(async () => {
  vi.resetModules()
  mockAuthClient = {}
  const { google } = await import('googleapis')
  mockDriveInstance = google.drive()
  driveService = await import('../../src/main/driveService.js')
})

describe('getAppDataFile', () => {
  it('returns null when file does not exist in appDataFolder', async () => {
    mockDriveInstance.files.list.mockResolvedValue({ data: { files: [] } })
    const result = await driveService.getAppDataFile(mockAuthClient, 'projects.json')
    expect(result).toBeNull()
  })

  it('returns file content string when file exists', async () => {
    const fileId = 'file-id-123'
    mockDriveInstance.files.list.mockResolvedValue({ data: { files: [{ id: fileId }] } })
    mockDriveInstance.files.get.mockResolvedValue({ data: '{"updatedAt":1,"projects":[]}' })
    const result = await driveService.getAppDataFile(mockAuthClient, 'projects.json')
    expect(result).toBe('{"updatedAt":1,"projects":[]}')
  })
})

describe('upsertAppDataFile', () => {
  it('creates a new file when it does not exist', async () => {
    mockDriveInstance.files.list.mockResolvedValue({ data: { files: [] } })
    mockDriveInstance.files.create.mockResolvedValue({ data: { id: 'new-id' } })
    const result = await driveService.upsertAppDataFile(mockAuthClient, 'projects.json', '{"ok":true}')
    expect(result).toEqual({ ok: true })
    expect(mockDriveInstance.files.create).toHaveBeenCalledTimes(1)
  })

  it('updates existing file when it already exists', async () => {
    mockDriveInstance.files.list.mockResolvedValue({ data: { files: [{ id: 'existing-id' }] } })
    mockDriveInstance.files.update.mockResolvedValue({ data: { id: 'existing-id' } })
    const result = await driveService.upsertAppDataFile(mockAuthClient, 'projects.json', '{"ok":true}')
    expect(result).toEqual({ ok: true })
    expect(mockDriveInstance.files.update).toHaveBeenCalledTimes(1)
    expect(mockDriveInstance.files.create).not.toHaveBeenCalled()
  })
})

describe('uploadFile', () => {
  it('uploads file and returns fileId and webViewLink', async () => {
    const { Readable } = await import('node:stream')
    vi.mock('node:fs', () => ({
      default: { createReadStream: vi.fn(() => new Readable({ read() {} })) },
      createReadStream: vi.fn(() => new Readable({ read() {} })),
    }))
    mockDriveInstance.files.create.mockResolvedValue({
      data: { id: 'uploaded-id', webViewLink: 'https://drive.google.com/file/d/uploaded-id/view' }
    })
    const result = await driveService.uploadFile(mockAuthClient, 'C:\\test\\file.svg', 'file.svg', 'image/svg+xml')
    expect(result).toEqual({
      ok: true,
      fileId: 'uploaded-id',
      webViewLink: 'https://drive.google.com/file/d/uploaded-id/view',
    })
  })
})

describe('shareFileWithEmail', () => {
  it('creates reader permission for specified email', async () => {
    mockDriveInstance.permissions.create.mockResolvedValue({ data: { id: 'perm-id' } })
    const result = await driveService.shareFileWithEmail(mockAuthClient, 'file-id', 'user@example.com')
    expect(result).toEqual({ ok: true })
    expect(mockDriveInstance.permissions.create).toHaveBeenCalledWith({
      fileId: 'file-id',
      sendNotificationEmail: true,
      requestBody: { role: 'reader', type: 'user', emailAddress: 'user@example.com' },
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/main/driveService.test.js
```

Expected: FAIL — module `../../src/main/driveService.js` not found.

- [ ] **Step 3: Create `src/main/driveService.js`**

```js
import fs from 'node:fs'
import { google } from 'googleapis'

function getDrive(authClient) {
  return google.drive({ version: 'v3', auth: authClient })
}

async function findAppDataFile(authClient, filename) {
  const drive = getDrive(authClient)
  const res = await drive.files.list({
    spaces: 'appDataFolder',
    q: `name = '${filename}'`,
    fields: 'files(id)',
    pageSize: 1,
  })
  return res.data.files?.[0]?.id ?? null
}

export async function getAppDataFile(authClient, filename) {
  const fileId = await findAppDataFile(authClient, filename)
  if (!fileId) return null
  const drive = getDrive(authClient)
  const res = await drive.files.get({ fileId, alt: 'media' })
  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
}

export async function upsertAppDataFile(authClient, filename, content) {
  const drive = getDrive(authClient)
  const media = { mimeType: 'application/json', body: content }
  const existingId = await findAppDataFile(authClient, filename)
  if (existingId) {
    await drive.files.update({ fileId: existingId, media })
  } else {
    await drive.files.create({
      requestBody: { name: filename, parents: ['appDataFolder'] },
      media,
    })
  }
  return { ok: true }
}

export async function uploadFile(authClient, fullPath, filename, mimeType) {
  const drive = getDrive(authClient)
  const res = await drive.files.create({
    requestBody: { name: filename },
    media: { mimeType, body: fs.createReadStream(fullPath) },
    fields: 'id,webViewLink',
  })
  return { ok: true, fileId: res.data.id, webViewLink: res.data.webViewLink }
}

export async function shareFileWithEmail(authClient, fileId, email) {
  const drive = getDrive(authClient)
  await drive.permissions.create({
    fileId,
    sendNotificationEmail: true,
    requestBody: { role: 'reader', type: 'user', emailAddress: email },
  })
  return { ok: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/driveService.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/driveService.js tests/main/driveService.test.js
git commit -m "feat: add driveService for Drive appData and file sharing operations"
```

---

### Task 3: Create `syncService.js`

**Files:**
- Create: `src/main/syncService.js`
- Create: `tests/main/syncService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/syncService.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/main/driveService.js', () => ({
  getAppDataFile: vi.fn(),
  upsertAppDataFile: vi.fn().mockResolvedValue({ ok: true }),
}))

let syncService
let driveService

beforeEach(async () => {
  vi.resetModules()
  driveService = await import('../../src/main/driveService.js')
  syncService = await import('../../src/main/syncService.js')
})

describe('pullProjects', () => {
  it('returns action none when Drive file does not exist', async () => {
    driveService.getAppDataFile.mockResolvedValue(null)
    const local = { updatedAt: 0, projects: [] }
    const result = await syncService.pullProjects({}, local)
    expect(result).toEqual({ ok: true, action: 'none', projects: null })
  })

  it('returns action none when Drive data is not newer than local', async () => {
    const driveData = { updatedAt: 100, projects: [{ id: '1', name: 'P1', color: '#fff', outputDir: 'C:\\out', counter: 0 }] }
    driveService.getAppDataFile.mockResolvedValue(JSON.stringify(driveData))
    const local = { updatedAt: 200, projects: [{ id: '1', name: 'P1', color: '#fff', outputDir: 'C:\\out', counter: 0 }] }
    const result = await syncService.pullProjects({}, local)
    expect(result).toEqual({ ok: true, action: 'none', projects: null })
  })

  it('returns pull action when Drive is newer', async () => {
    const driveData = { updatedAt: 500, projects: [{ id: '1', name: 'P1', color: '#aaa', outputDir: 'C:\\out', counter: 3 }] }
    driveService.getAppDataFile.mockResolvedValue(JSON.stringify(driveData))
    const local = { updatedAt: 100, projects: [{ id: '1', name: 'P1', color: '#aaa', outputDir: 'C:\\local', counter: 1 }] }
    const result = await syncService.pullProjects({}, local)
    expect(result.ok).toBe(true)
    expect(result.action).toBe('pull')
    expect(result.projects[0].outputDir).toBe('C:\\local')
    expect(result.newProjectNames).toEqual([])
  })

  it('keeps local outputDir for existing project ids', async () => {
    const driveData = { updatedAt: 999, projects: [{ id: 'abc', name: 'Alpha', color: '#f00', outputDir: 'D:\\drive', counter: 2 }] }
    driveService.getAppDataFile.mockResolvedValue(JSON.stringify(driveData))
    const local = { updatedAt: 1, projects: [{ id: 'abc', name: 'Alpha', color: '#f00', outputDir: 'C:\\local\\alpha', counter: 2 }] }
    const result = await syncService.pullProjects({}, local)
    expect(result.projects[0].outputDir).toBe('C:\\local\\alpha')
  })

  it('sets outputDir to empty string for new projects from Drive', async () => {
    const driveData = { updatedAt: 999, projects: [{ id: 'new-id', name: 'Beta', color: '#00f', outputDir: 'D:\\other', counter: 0 }] }
    driveService.getAppDataFile.mockResolvedValue(JSON.stringify(driveData))
    const local = { updatedAt: 1, projects: [] }
    const result = await syncService.pullProjects({}, local)
    expect(result.projects[0].outputDir).toBe('')
    expect(result.newProjectNames).toEqual(['Beta'])
  })

  it('returns action none when Drive JSON is corrupted', async () => {
    driveService.getAppDataFile.mockResolvedValue('not valid json{{')
    const local = { updatedAt: 0, projects: [] }
    const result = await syncService.pullProjects({}, local)
    expect(result).toEqual({ ok: true, action: 'none', projects: null })
  })
})

describe('pushProjects', () => {
  it('calls upsertAppDataFile with serialized project data', async () => {
    const projects = [{ id: '1', name: 'P1', color: '#fff', outputDir: 'C:\\out', counter: 2, prefix: 'P' }]
    await syncService.pushProjects({}, projects)
    expect(driveService.upsertAppDataFile).toHaveBeenCalledTimes(1)
    const [, filename, content] = driveService.upsertAppDataFile.mock.calls[0]
    expect(filename).toBe('projects.json')
    const parsed = JSON.parse(content)
    expect(parsed.projects[0].id).toBe('1')
    expect(typeof parsed.updatedAt).toBe('number')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/main/syncService.test.js
```

Expected: FAIL — module `../../src/main/syncService.js` not found.

- [ ] **Step 3: Create `src/main/syncService.js`**

```js
import { getAppDataFile, upsertAppDataFile } from './driveService.js'

export async function pullProjects(authClient, localState) {
  const content = await getAppDataFile(authClient, 'projects.json')
  if (!content) return { ok: true, action: 'none', projects: null }
  let driveData
  try {
    driveData = JSON.parse(content)
  } catch {
    return { ok: true, action: 'none', projects: null }
  }
  if (driveData.updatedAt <= (localState.updatedAt ?? 0)) {
    return { ok: true, action: 'none', projects: null }
  }
  const merged = driveData.projects.map((dp) => {
    const lp = localState.projects.find((p) => p.id === dp.id)
    return lp ? { ...dp, outputDir: lp.outputDir } : { ...dp, outputDir: '' }
  })
  const newProjects = driveData.projects.filter(
    (dp) => !localState.projects.find((lp) => lp.id === dp.id)
  )
  return {
    ok: true,
    action: 'pull',
    projects: merged,
    newProjectNames: newProjects.map((p) => p.name),
  }
}

export async function pushProjects(authClient, projects) {
  const content = JSON.stringify({
    updatedAt: Date.now(),
    projects: projects.map(({ id, name, color, outputDir, counter, prefix }) => ({
      id, name, color, outputDir, counter, prefix,
    })),
  })
  return upsertAppDataFile(authClient, 'projects.json', content)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/syncService.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/syncService.js tests/main/syncService.test.js
git commit -m "feat: add syncService for Drive appDataFolder project pull/push logic"
```

---

### Task 4: Extend `projectStore.js` with timestamp methods

**Files:**
- Modify: `src/main/projectStore.js`
- Modify: `tests/main/projectStore.test.js`

- [ ] **Step 1: Write failing tests**

Open `tests/main/projectStore.test.js`. At the end of the file (after the last `describe` block, before the final closing), add:

```js
describe('ProjectStore – timestamp methods', () => {
  it('getProjectsUpdatedAt returns 0 when never set', async () => {
    const { ProjectStore } = await import('../../src/main/projectStore.js')
    const store = new ProjectStore()
    expect(store.getProjectsUpdatedAt()).toBe(0)
  })

  it('touchProjectsUpdatedAt stores a timestamp close to now', async () => {
    const before = Date.now()
    const { ProjectStore } = await import('../../src/main/projectStore.js')
    const store = new ProjectStore()
    store.touchProjectsUpdatedAt()
    const after = Date.now()
    const ts = store.getProjectsUpdatedAt()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/main/projectStore.test.js
```

Expected: The two new tests FAIL — `getProjectsUpdatedAt is not a function`.

- [ ] **Step 3: Add methods to `src/main/projectStore.js`**

Open `src/main/projectStore.js`. Find the `ProjectStore` class and add these two methods after `reorderProjects`:

```js
  getProjectsUpdatedAt() {
    return this._projects.get('projectsUpdatedAt', 0)
  }

  touchProjectsUpdatedAt() {
    this._projects.set('projectsUpdatedAt', Date.now())
  }
```

- [ ] **Step 4: Run all projectStore tests to verify they pass**

```bash
npx vitest run tests/main/projectStore.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/projectStore.js tests/main/projectStore.test.js
git commit -m "feat: add getProjectsUpdatedAt and touchProjectsUpdatedAt to ProjectStore"
```

---

### Task 5: Wire IPC in `src/main/index.js`

**Files:**
- Modify: `src/main/index.js`

This task has no unit test (IPC handlers are integration-level). Manual verification is in Task 9.

- [ ] **Step 1: Import new services at top of `src/main/index.js`**

Open `src/main/index.js`. Find the existing import block at the top. After the last `import` line, add:

```js
import { initAuthService, loginWithGoogle, loadStoredSession, logout, getAuthClient } from './authService.js'
import { uploadFile, shareFileWithEmail } from './driveService.js'
import { pullProjects, pushProjects } from './syncService.js'
```

- [ ] **Step 2: Initialize authService after store is created**

In `src/main/index.js`, find the line where `store` is instantiated (typically `const store = new ProjectStore()`). Directly after it, add:

```js
initAuthService(store)
```

- [ ] **Step 3: Add `touchProjectsUpdatedAt()` to every project mutation handler**

Find the four project mutation handlers. Add `store.touchProjectsUpdatedAt()` as the first statement in each handler body and a `pushProjects` call (fire-and-forget) after the tray update. The updated handlers should look like:

```js
ipcMain.handle('add-project', async (_event, project) => {
  store.touchProjectsUpdatedAt()
  store.addProject(project)
  if (!store.getActiveProjectId()) store.setActiveProject(project.id)
  updateTrayMenu(mainWindow, store)
  const authClient = getAuthClient()
  if (authClient) pushProjects(authClient, store.getProjects()).catch(() => {})
  return { projects: store.getProjects(), activeProjectId: store.getActiveProjectId() }
})

ipcMain.handle('update-project', async (_event, { id, updates }) => {
  store.touchProjectsUpdatedAt()
  store.updateProject(id, updates)
  updateTrayMenu(mainWindow, store)
  const authClient = getAuthClient()
  if (authClient) pushProjects(authClient, store.getProjects()).catch(() => {})
  return { projects: store.getProjects() }
})

ipcMain.handle('delete-project', async (_event, { id }) => {
  store.touchProjectsUpdatedAt()
  store.deleteProject(id)
  updateTrayMenu(mainWindow, store)
  const authClient = getAuthClient()
  if (authClient) pushProjects(authClient, store.getProjects()).catch(() => {})
  return { projects: store.getProjects(), activeProjectId: store.getActiveProjectId() }
})

ipcMain.handle('reorder-projects', async (_event, { ids }) => {
  store.touchProjectsUpdatedAt()
  store.reorderProjects(ids)
  updateTrayMenu(mainWindow, store)
  const authClient = getAuthClient()
  if (authClient) pushProjects(authClient, store.getProjects()).catch(() => {})
  return { projects: store.getProjects() }
})
```

- [ ] **Step 4: Add auto-session restore on app ready**

Inside the `app.whenReady()` callback (or where `mainWindow` is first created and shown), after `mainWindow` is initialized, add the session-restore block. Find the section where the app emits init data or finishes setup, and add:

```js
// Restore Google session on startup
loadStoredSession().then((user) => {
  if (!user) return
  const localState = {
    updatedAt: store.getProjectsUpdatedAt(),
    projects: store.getProjects(),
  }
  const authClient = getAuthClient()
  pullProjects(authClient, localState).then((result) => {
    if (result.action === 'pull' && result.projects) {
      store.setProjects(result.projects)
      store.touchProjectsUpdatedAt()
      mainWindow?.webContents.send('projects-updated', {
        projects: store.getProjects(),
        activeProjectId: store.getActiveProjectId(),
      })
      result.newProjectNames?.forEach((name) => {
        mainWindow?.webContents.send('notification', {
          id: `sync-${Date.now()}`,
          type: 'info',
          message: `Projeto '${name}' sincronizado — configure a pasta de saída.`,
          read: false,
          timestamp: Date.now(),
        })
      })
    }
    mainWindow?.webContents.send('account-changed', user)
  }).catch(() => {
    mainWindow?.webContents.send('account-changed', user)
  })
}).catch(() => {})
```

- [ ] **Step 5: Add the four new IPC handlers at the end of `src/main/index.js`** (before the final closing brace or after `save-image`)

```js
ipcMain.handle('google-login', async () => {
  try {
    const result = await loginWithGoogle()
    if (!result.ok) return { ok: false, error: 'Login falhou' }
    const localState = {
      updatedAt: store.getProjectsUpdatedAt(),
      projects: store.getProjects(),
    }
    const authClient = getAuthClient()
    const syncResult = await pullProjects(authClient, localState).catch(() => ({ action: 'none' }))
    if (syncResult.action === 'pull' && syncResult.projects) {
      store.setProjects(syncResult.projects)
      store.touchProjectsUpdatedAt()
      mainWindow?.webContents.send('projects-updated', {
        projects: store.getProjects(),
        activeProjectId: store.getActiveProjectId(),
      })
      syncResult.newProjectNames?.forEach((name) => {
        mainWindow?.webContents.send('notification', {
          id: `sync-${Date.now()}`,
          type: 'info',
          message: `Projeto '${name}' sincronizado — configure a pasta de saída.`,
          read: false,
          timestamp: Date.now(),
        })
      })
    } else {
      await pushProjects(authClient, store.getProjects()).catch(() => {})
    }
    mainWindow?.webContents.send('account-changed', result.user)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('google-logout', async () => {
  const result = await logout()
  mainWindow?.webContents.send('account-changed', null)
  return result
})

ipcMain.handle('sync-projects', async () => {
  try {
    const authClient = getAuthClient()
    if (!authClient) return { ok: false, error: 'Não autenticado' }
    const localState = {
      updatedAt: store.getProjectsUpdatedAt(),
      projects: store.getProjects(),
    }
    const result = await pullProjects(authClient, localState)
    if (result.action === 'pull' && result.projects) {
      store.setProjects(result.projects)
      store.touchProjectsUpdatedAt()
      mainWindow?.webContents.send('projects-updated', {
        projects: store.getProjects(),
        activeProjectId: store.getActiveProjectId(),
      })
      result.newProjectNames?.forEach((name) => {
        mainWindow?.webContents.send('notification', {
          id: `sync-${Date.now()}`,
          type: 'info',
          message: `Projeto '${name}' sincronizado — configure a pasta de saída.`,
          read: false,
          timestamp: Date.now(),
        })
      })
    } else {
      await pushProjects(authClient, store.getProjects())
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('share-file', async (_event, { fullPath, email }) => {
  try {
    const authClient = getAuthClient()
    if (!authClient) return { ok: false, error: 'Não autenticado' }
    const path = await import('node:path')
    const fs = await import('node:fs')
    if (!fs.default.existsSync(fullPath)) return { ok: false, error: 'Arquivo não encontrado' }
    const filename = path.default.basename(fullPath)
    const ext = path.default.extname(filename).toLowerCase()
    const mimeTypes = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' }
    const mimeType = mimeTypes[ext] ?? 'application/octet-stream'
    const uploadResult = await uploadFile(authClient, fullPath, filename, mimeType)
    if (!uploadResult.ok) return { ok: false, error: 'Falha no upload' }
    await shareFileWithEmail(authClient, uploadResult.fileId, email)
    return { ok: true, webViewLink: uploadResult.webViewLink }
  } catch (err) {
    if (err.code === 400) return { ok: false, error: 'E-mail inválido' }
    return { ok: false, error: err.message }
  }
})
```

- [ ] **Step 6: Add `setProjects` to `projectStore.js`** (needed by the sync handlers above)

Open `src/main/projectStore.js`. Add after `reorderProjects`:

```js
  setProjects(projects) {
    this._projects.set('projects', projects)
  }
```

- [ ] **Step 7: Run full test suite to make sure nothing broke**

```bash
npm test
```

Expected: All existing tests still PASS (new handlers are not unit-tested here).

- [ ] **Step 8: Commit**

```bash
git add src/main/index.js src/main/projectStore.js
git commit -m "feat: wire google-login, google-logout, sync-projects, share-file IPC handlers"
```

---

### Task 6: Extend `src/preload/index.js`

**Files:**
- Modify: `src/preload/index.js`

- [ ] **Step 1: Add new methods to the `contextBridge` exposure**

Open `src/preload/index.js`. Find the `contextBridge.exposeInMainWorld('electronAPI', { ... })` call.

Inside the exposed object, add the following entries (after the existing `onProjectsUpdated` listener and before the closing `}`):

```js
    googleLogin: () => ipcRenderer.invoke('google-login'),
    googleLogout: () => ipcRenderer.invoke('google-logout'),
    syncProjects: () => ipcRenderer.invoke('sync-projects'),
    shareFile: (payload) => ipcRenderer.invoke('share-file', payload),
    onAccountChanged: (cb) => {
      const handler = (_e, data) => cb(data)
      ipcRenderer.on('account-changed', handler)
      return () => ipcRenderer.removeListener('account-changed', handler)
    },
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.js
git commit -m "feat: expose googleLogin, googleLogout, syncProjects, shareFile, onAccountChanged in preload"
```

---

### Task 7: Extend `AppContext.jsx` with account state and actions

**Files:**
- Modify: `src/renderer/src/context/AppContext.jsx`
- Modify: `tests/renderer/App.test.jsx`

- [ ] **Step 1: Add failing test for account reducer cases**

Open `tests/renderer/App.test.jsx`. Find the `beforeEach` block where `globalThis.window.electronAPI` is defined. Add `onAccountChanged` to the mock object:

```js
    onAccountChanged: vi.fn(() => () => {}),
```

The full `electronAPI` mock should now include:
```js
  globalThis.window.electronAPI = {
    getInitData: vi.fn().mockResolvedValue({}),
    checkForUpdates: vi.fn(),
    onUpdateNotAvailable:      vi.fn((cb) => { notAvailableCb = cb; return () => {} }),
    onUpdateAvailable:         vi.fn((cb) => { updateAvailableCb = cb; return () => {} }),
    onNavigateTo:              vi.fn((cb) => { navigateCb = cb; return () => {} }),
    onUpdateDownloading:       vi.fn((cb) => { updateDownloadingCb = cb; return () => {} }),
    onUpdateDownloadProgress:  vi.fn((cb) => { updateDownloadProgressCb = cb; return () => {} }),
    saveNotifications:         vi.fn(),
    onShellStatus:             vi.fn(() => () => {}),
    onProjectsUpdated:         vi.fn(() => () => {}),
    onThemeChanged:            vi.fn(() => () => {}),
    onAccountChanged:          vi.fn(() => () => {}),
    installUpdate:             vi.fn(),
  }
```

- [ ] **Step 2: Add a dedicated reducer unit test file**

Create `tests/renderer/appContextReducer.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { reducer } from '../../src/renderer/src/context/AppContext.jsx'

const baseState = {
  account: null,
  status: 'idle',
  notifications: [],
}

describe('SET_ACCOUNT', () => {
  it('sets account to provided object', () => {
    const user = { email: 'a@b.com', name: 'A', photo: '', syncing: false, syncError: null }
    const next = reducer(baseState, { type: 'SET_ACCOUNT', account: user })
    expect(next.account).toEqual(user)
  })

  it('sets account to null on logout', () => {
    const state = { ...baseState, account: { email: 'a@b.com', name: 'A', photo: '', syncing: false, syncError: null } }
    const next = reducer(state, { type: 'SET_ACCOUNT', account: null })
    expect(next.account).toBeNull()
  })
})

describe('SET_SYNCING', () => {
  it('updates account.syncing when account exists', () => {
    const state = { ...baseState, account: { email: 'a@b.com', name: 'A', photo: '', syncing: false, syncError: null } }
    const next = reducer(state, { type: 'SET_SYNCING', syncing: true })
    expect(next.account.syncing).toBe(true)
  })

  it('leaves account null if account is null', () => {
    const next = reducer(baseState, { type: 'SET_SYNCING', syncing: true })
    expect(next.account).toBeNull()
  })
})

describe('SET_SYNC_ERROR', () => {
  it('updates account.syncError when account exists', () => {
    const state = { ...baseState, account: { email: 'a@b.com', name: 'A', photo: '', syncing: false, syncError: null } }
    const next = reducer(state, { type: 'SET_SYNC_ERROR', error: 'Network error' })
    expect(next.account.syncError).toBe('Network error')
  })
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx vitest run tests/renderer/appContextReducer.test.js
```

Expected: FAIL — `SET_ACCOUNT` case missing from reducer.

- [ ] **Step 4: Update `src/renderer/src/context/AppContext.jsx`**

**4a. Add `account: null` to `initialState`:**

Find the `initialState` object and add `account: null` as the last property before the closing `}`:

```js
  account: null,
```

**4b. Add three new reducer cases** inside the `switch` statement, before the `default` case:

```js
    case 'SET_ACCOUNT':
      return { ...state, account: action.account }

    case 'SET_SYNCING':
      return {
        ...state,
        account: state.account ? { ...state.account, syncing: action.syncing } : state.account,
      }

    case 'SET_SYNC_ERROR':
      return {
        ...state,
        account: state.account ? { ...state.account, syncError: action.error } : state.account,
      }
```

**4c. Add `onAccountChanged` listener in `AppProvider` `useEffect`:**

Inside the `cleanups` array (in `AppProvider`), add:

```js
      window.electronAPI.onAccountChanged((user) => {
        dispatch({
          type: 'SET_ACCOUNT',
          account: user ? { ...user, syncing: false, syncError: null } : null,
        })
      }),
```

**4d. Add four new actions** inside the `actions` object (after `clearNotifications`):

```js
    async googleLogin() {
      const result = await window.electronAPI.googleLogin()
      if (!result.ok) {
        toast.error(result.error ?? 'Erro ao fazer login')
      }
      return result
    },

    async googleLogout() {
      await window.electronAPI.googleLogout()
    },

    async syncProjects() {
      dispatch({ type: 'SET_SYNCING', syncing: true })
      dispatch({ type: 'SET_SYNC_ERROR', error: null })
      const result = await window.electronAPI.syncProjects()
      dispatch({ type: 'SET_SYNCING', syncing: false })
      if (!result.ok) {
        dispatch({ type: 'SET_SYNC_ERROR', error: result.error ?? 'Erro de sincronização' })
        toast.error(result.error ?? 'Erro de sincronização')
      }
    },

    async shareFile({ fullPath, email }) {
      const result = await window.electronAPI.shareFile({ fullPath, email })
      if (result.ok) {
        toast.success(`Compartilhado com ${email}`, {
          action: result.webViewLink
            ? { label: 'Copiar link', onClick: () => navigator.clipboard.writeText(result.webViewLink) }
            : undefined,
        })
      } else {
        toast.error(result.error ?? 'Erro ao compartilhar')
      }
      return result
    },
```

- [ ] **Step 5: Run the reducer tests**

```bash
npx vitest run tests/renderer/appContextReducer.test.js
```

Expected: All PASS.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/context/AppContext.jsx tests/renderer/App.test.jsx tests/renderer/appContextReducer.test.js
git commit -m "feat: add account state, reducer cases, and google actions to AppContext"
```

---

### Task 8: Create `AccountPanel.jsx`

**Files:**
- Create: `src/renderer/src/components/AccountPanel.jsx`
- Create: `tests/renderer/AccountPanel.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `tests/renderer/AccountPanel.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => ({
  User: () => <span data-testid="icon-user" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  LogOut: () => <span data-testid="icon-logout" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}))

const mockActions = {
  googleLogin: vi.fn().mockResolvedValue({ ok: true }),
  googleLogout: vi.fn(),
  syncProjects: vi.fn(),
}

vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: () => ({
    state: { account: null },
    actions: mockActions,
  }),
}))

import AccountPanel from '../../src/renderer/src/components/AccountPanel'

describe('AccountPanel – logged out', () => {
  it('shows login button when account is null', () => {
    render(<AccountPanel open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/Entrar com Google/i)).toBeInTheDocument()
  })

  it('calls googleLogin when button is clicked', async () => {
    const onOpenChange = vi.fn()
    render(<AccountPanel open={true} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByText(/Entrar com Google/i))
    expect(mockActions.googleLogin).toHaveBeenCalled()
  })
})

describe('AccountPanel – logged in', () => {
  beforeEach(() => {
    vi.mocked(require('../../src/renderer/src/context/AppContext').useApp).mockReturnValue({
      state: {
        account: { email: 'user@test.com', name: 'Test User', photo: '', syncing: false, syncError: null },
      },
      actions: mockActions,
    })
  })
})
```

> Note: This test is intentionally lightweight — the component is a straightforward dialog UI.

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/renderer/AccountPanel.test.jsx
```

Expected: FAIL — `../../src/renderer/src/components/AccountPanel` not found.

- [ ] **Step 3: Create `src/renderer/src/components/AccountPanel.jsx`**

```jsx
import { RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApp } from '../context/AppContext.jsx'

export default function AccountPanel({ open, onOpenChange }) {
  const { state, actions } = useApp()
  const { account } = state

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-72">
        <DialogHeader>
          <DialogTitle className="text-sm">Conta Google</DialogTitle>
        </DialogHeader>

        {!account ? (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground text-center">
              Faça login para sincronizar projetos e compartilhar arquivos.
            </p>
            <Button
              className="w-full gap-2"
              onClick={async () => {
                const r = await actions.googleLogin()
                if (r?.ok) onOpenChange(false)
              }}
            >
              Entrar com Google
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {account.photo ? (
                <img
                  src={account.photo}
                  alt={account.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {account.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{account.name}</p>
                <p className="text-xs text-muted-foreground truncate">{account.email}</p>
              </div>
            </div>

            {account.syncError && (
              <p className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded">
                {account.syncError}
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={account.syncing}
              onClick={() => actions.syncProjects()}
            >
              <RefreshCw size={13} className={account.syncing ? 'animate-spin' : ''} />
              {account.syncing ? 'Sincronizando…' : 'Sincronizar agora'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-muted-foreground"
              onClick={() => actions.googleLogout()}
            >
              <LogOut size={13} /> Sair
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/renderer/AccountPanel.test.jsx
```

Expected: All PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/AccountPanel.jsx tests/renderer/AccountPanel.test.jsx
git commit -m "feat: add AccountPanel dialog component for Google account management"
```

---

### Task 9: Enable "Conta" in `Sidebar.jsx` and wire `AccountPanel` in `App.jsx`

**Files:**
- Modify: `src/renderer/src/components/Sidebar.jsx`
- Modify: `src/renderer/src/App.jsx`
- Modify: `tests/renderer/App.test.jsx`

- [ ] **Step 1: Write failing test for AccountPanel mock and onOpenAccount prop**

Open `tests/renderer/App.test.jsx`. At the top of the `vi.mock` section, add a mock for `AccountPanel`:

```js
vi.mock('../../src/renderer/src/components/AccountPanel', () => ({
  default: ({ open }) => open ? <div data-testid="account-panel" /> : null,
}))
```

Then add a new test inside the existing `describe('Update check button', ...)` or as a new top-level describe:

```js
describe('AccountPanel integration', () => {
  it('does not render AccountPanel by default', () => {
    render(<App />)
    expect(screen.queryByTestId('account-panel')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/renderer/App.test.jsx
```

Expected: FAIL — `AccountPanel` module not found (or panel test assertion fails).

- [ ] **Step 3: Update `src/renderer/src/components/Sidebar.jsx`**

**3a.** Find the function signature:

```js
export default function Sidebar({ screen, onNavigate, open, width, updateStatus, downloadPercent, onCheckUpdate, onOpenAbout, onOpenNotifications, unreadCount }) {
```

Add `onOpenAccount` to the destructured props:

```js
export default function Sidebar({ screen, onNavigate, open, width, updateStatus, downloadPercent, onCheckUpdate, onOpenAbout, onOpenNotifications, unreadCount, onOpenAccount }) {
```

**3b.** Find the "Conta" `DropdownMenuItem`:

```jsx
              <DropdownMenuItem disabled>
                <User size={13} />
                Conta
              </DropdownMenuItem>
```

Replace it with:

```jsx
              <DropdownMenuItem onClick={onOpenAccount}>
                <User size={13} />
                Conta
              </DropdownMenuItem>
```

- [ ] **Step 4: Update `src/renderer/src/App.jsx`**

**4a.** Import `AccountPanel` at the top:

```js
import AccountPanel from './components/AccountPanel.jsx'
```

**4b.** Add `accountOpen` state alongside the other state declarations:

```js
  const [accountOpen, setAccountOpen] = useState(false)
```

**4c.** Pass `onOpenAccount` prop to `<Sidebar>`:

```jsx
          onOpenAccount={() => setAccountOpen(true)}
```

Add it to the existing `<Sidebar ...>` JSX.

**4d.** Render `<AccountPanel>` after `<About>` and before `<Toaster>`:

```jsx
      <AccountPanel open={accountOpen} onOpenChange={setAccountOpen} />
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/Sidebar.jsx src/renderer/src/App.jsx tests/renderer/App.test.jsx
git commit -m "feat: enable Conta sidebar item and render AccountPanel in App"
```

---

### Task 10: Add inline share dialog to `ClipGrid.jsx`

**Files:**
- Modify: `src/renderer/src/components/ClipGrid.jsx`

- [ ] **Step 1: Write a failing test**

Create `tests/renderer/ClipGridShare.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => ({
  Share2: () => <span data-testid="icon-share2" />,
  Clipboard: () => <span />,
  FolderOpen: () => <span />,
  Trash2: () => <span />,
  FileImage: () => <span />,
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }) => <div>{children}</div>,
  ContextMenuContent: ({ children }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
  ContextMenuSeparator: () => <hr />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => open ? <div data-testid="share-dialog">{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogFooter: ({ children }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

const mockShareFile = vi.fn().mockResolvedValue({ ok: true, webViewLink: 'https://link' })
const mockAccount = { email: 'u@t.com', name: 'U', photo: '', syncing: false, syncError: null }

vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: vi.fn(),
}))

import { useApp } from '../../src/renderer/src/context/AppContext'
import ClipGrid from '../../src/renderer/src/components/ClipGrid'

describe('ClipGrid share feature', () => {
  it('does not show Compartilhar item when not logged in', () => {
    useApp.mockReturnValue({
      state: { account: null, history: [{ id: '1', filename: 'f.svg', fullPath: 'C:\\f.svg', projectId: 'p1', thumbPath: null }], projects: [{ id: 'p1', name: 'P1', color: '#f00' }] },
      actions: { shareFile: mockShareFile, deleteHistoryEntry: vi.fn(), syncHistory: vi.fn() },
    })
    render(<ClipGrid />)
    expect(screen.queryByText(/Compartilhar/i)).not.toBeInTheDocument()
  })

  it('shows Compartilhar item when logged in', () => {
    useApp.mockReturnValue({
      state: { account: mockAccount, history: [{ id: '1', filename: 'f.svg', fullPath: 'C:\\f.svg', projectId: 'p1', thumbPath: null }], projects: [{ id: 'p1', name: 'P1', color: '#f00' }] },
      actions: { shareFile: mockShareFile, deleteHistoryEntry: vi.fn(), syncHistory: vi.fn() },
    })
    render(<ClipGrid />)
    expect(screen.getByText(/Compartilhar/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/renderer/ClipGridShare.test.jsx
```

Expected: FAIL — `Compartilhar` assertion fails.

- [ ] **Step 3: Update `src/renderer/src/components/ClipGrid.jsx`**

Open `src/renderer/src/components/ClipGrid.jsx`.

**3a.** Add imports at the top (after existing imports):

```js
import { useState } from 'react'
import { Share2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
```

> Note: `useState` may already be imported. Check and add only what's missing.

**3b.** `ClipCard` currently does NOT call `useApp()`. Add the following at the top of the `ClipCard` function body (right after the function signature line):

```js
  const { state, actions } = useApp()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharing, setSharing] = useState(false)
```

**3c.** `ClipCard` currently returns a bare `<ContextMenu>`. Wrap it in a Fragment and append the Dialog. Replace the current `return (` statement and its contents with:

```jsx
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {/* existing trigger content — keep unchanged */}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {/* existing items — keep unchanged */}
          {state.account && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setShareOpen(true)}>
                <Share2 size={13} />
                Compartilhar
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="w-80">
          <DialogHeader>
            <DialogTitle className="text-sm">Compartilhar arquivo</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground truncate">{entry.filename}</p>
          <Input
            type="email"
            placeholder="E-mail do destinatário"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shareEmail) handleShare()
            }}
          />
          <DialogFooter>
            <Button
              size="sm"
              disabled={!shareEmail || sharing}
              onClick={handleShare}
            >
              {sharing ? 'Enviando…' : 'Compartilhar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
```

**3d.** Add `handleShare` function inside `ClipCard`, before the `return`:

```js
  async function handleShare() {
    setSharing(true)
    await actions.shareFile({ fullPath: entry.fullPath, email: shareEmail })
    setSharing(false)
    setShareOpen(false)
    setShareEmail('')
  }
```

> **Important:** The existing ContextMenu content (trigger + existing items) must be preserved exactly. Only add the share item and Dialog — do not remove any existing items.

- [ ] **Step 4: Run share tests**

```bash
npx vitest run tests/renderer/ClipGridShare.test.jsx
```

Expected: All PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/ClipGrid.jsx tests/renderer/ClipGridShare.test.jsx
git commit -m "feat: add inline share dialog to ClipGrid history entries"
```

---

## Final Verification

After all 10 tasks are complete:

- [ ] Run `npm test` — all tests pass
- [ ] Run `npm run build:unpack` — build succeeds with no errors
- [ ] Start the app with `npm run dev`:
  - "Conta" menu item in sidebar is clickable and opens AccountPanel
  - Login flow opens system browser (requires real OAuth credentials in `authService.js`)
  - "Compartilhar" appears in ClipCard context menu only when logged in

> **Note on OAuth credentials:** `CLIENT_ID` and `CLIENT_SECRET` in `authService.js` are left empty intentionally. The app owner must register a Google Cloud OAuth 2.0 client (Web application type, redirect URI `http://localhost`) and fill these values before the auth flow works end-to-end.
