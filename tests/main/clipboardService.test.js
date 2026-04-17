import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// clipboard.readBuffer() uses RegisterClipboardFormat() which creates a custom
// format ID (≥0xC000) — it never maps to system format CF_ENHMETAFILE (ID 14).
// The only reliable approach is PowerShell P/Invoke calling GetClipboardData(14).
// We mock 'child_process' spawn to simulate PowerShell output.

const mockSpawn = vi.fn()
vi.mock('child_process', () => ({ spawn: mockSpawn }))

// Electron mock not needed — new impl doesn't use electron.clipboard
vi.mock('electron', () => ({}))

const { readEMF, hasEMF } = await import('../../src/main/clipboardService.js')

function makePs(base64Output = '', exitCode = 0, delay = 10) {
  const proc = new EventEmitter()
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  setTimeout(() => {
    if (base64Output) proc.stdout.emit('data', Buffer.from(base64Output))
    proc.emit('close', exitCode)
  }, delay)
  return proc
}

describe('ClipboardService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('readEMF()', () => {
    it('returns a Buffer when PowerShell emits valid base64 EMF data', async () => {
      const emfBytes = Buffer.from([0x01, 0x02, 0x03, 0x04])
      mockSpawn.mockReturnValue(makePs(emfBytes.toString('base64')))
      const result = await readEMF()
      expect(result).toBeInstanceOf(Buffer)
      expect(result).toEqual(emfBytes)
    })

    it('returns null when PowerShell emits empty string (no EMF on clipboard)', async () => {
      mockSpawn.mockReturnValue(makePs(''))
      expect(await readEMF()).toBeNull()
    })

    it('returns null when PowerShell exits with non-zero code', async () => {
      mockSpawn.mockReturnValue(makePs('', 1))
      expect(await readEMF()).toBeNull()
    })

    it('returns null when spawn emits an error', async () => {
      const proc = makePs('', 0)
      proc.kill = vi.fn()
      setTimeout(() => proc.emit('error', new Error('spawn ENOENT')), 5)
      mockSpawn.mockReturnValue(proc)
      expect(await readEMF()).toBeNull()
    })

    it('invokes powershell with -EncodedCommand (no raw quoting)', async () => {
      mockSpawn.mockReturnValue(makePs(''))
      await readEMF()
      expect(mockSpawn).toHaveBeenCalledWith(
        'powershell',
        expect.arrayContaining(['-EncodedCommand']),
        expect.any(Object)
      )
    })

    it('passes -NoProfile and -NonInteractive flags', async () => {
      mockSpawn.mockReturnValue(makePs(''))
      await readEMF()
      const args = mockSpawn.mock.calls[0][1]
      expect(args).toContain('-NoProfile')
      expect(args).toContain('-NonInteractive')
    })
  })

  describe('hasEMF()', () => {
    it('returns true when readEMF resolves with a Buffer', async () => {
      const emfBytes = Buffer.from([0x01])
      mockSpawn.mockReturnValue(makePs(emfBytes.toString('base64')))
      expect(await hasEMF()).toBe(true)
    })

    it('returns false when readEMF resolves with null', async () => {
      mockSpawn.mockReturnValue(makePs(''))
      expect(await hasEMF()).toBe(false)
    })
  })
})
