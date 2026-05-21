import crypto from 'node:crypto'
import http from 'node:http'
import { google } from 'googleapis'
import { safeStorage, shell } from 'electron'
import _Store from 'electron-store'

const Store = _Store.default ?? _Store

const CLIENT_ID = '87201199145-h4604tt5tce9iv1gg9iq982sgu2mjhus.apps.googleusercontent.com'
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
]
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

const _store = new Store({ name: 'auth' })

export function initAuthService() {}

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
      resolve({ port, codePromise, server })
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
  const client = new google.auth.OAuth2(CLIENT_ID)
  client.setCredentials(tokens)
  client.on('tokens', (newTokens) => saveTokens({ ...loadTokens(), ...newTokens }))
  return client
}

export async function loginWithGoogle() {
  const { port, codePromise, server } = await startCallbackServer()
  const redirectUri = `http://localhost:${port}/callback`
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, '', redirectUri)
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
  try {
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
  } finally {
    clearTimeout(timeoutId)
    server.close()
  }
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

export function getStoredUser() {
  return _store?.get('googleUser') ?? null
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
