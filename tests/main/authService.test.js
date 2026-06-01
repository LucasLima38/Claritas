// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mockStore is declared here so the electron-store factory can close over it.
// It gets reassigned in beforeEach before each import, so the constructor always
// returns the freshly-created mock object for that test.
let mockStore

// Mock electron-store so the module-level `new Store({ name: 'auth' })` in
// authService.js doesn't try to locate an Electron app data path (which fails
// in Node/Vitest with "Please specify the `projectName` option").
vi.mock('electron-store', () => ({
  default: function MockStore() {
    return mockStore
  },
}))

// Must mock before import
vi.mock('googleapis', () => {
  const mockOAuth2 = vi.fn().mockImplementation(function () {
    this.generateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/auth?fake')
    this.getToken = vi.fn().mockResolvedValue({
      tokens: { access_token: 'at', refresh_token: 'rt', expiry_date: 9999999999999 }
    })
    this.setCredentials = vi.fn()
    this.getAccessToken = vi.fn().mockResolvedValue({ token: 'at' })
    this.revokeToken = vi.fn().mockResolvedValue({})
    this.on = vi.fn()
  })
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

beforeEach(async () => {
  vi.resetModules()
  mockStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }
  // Re-import fresh module after resetModules.
  // The electron-store mock above ensures the module-level Store instantiation
  // returns mockStore instead of trying to create a real store.
  authService = await import('../../src/main/authService.js')
})

describe('getAuthClient', () => {
  it('returns null when no tokens stored', () => {
    mockStore.get.mockReturnValue(undefined)
    expect(authService.getAuthClient()).toBeNull()
  })

  it('returns an OAuth2 client when tokens are stored', async () => {
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
    google.auth.OAuth2.mockImplementationOnce(function () {
      this.setCredentials = vi.fn()
      this.getAccessToken = vi.fn().mockRejectedValue(new Error('token expired'))
      this.on = vi.fn()
    })
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
