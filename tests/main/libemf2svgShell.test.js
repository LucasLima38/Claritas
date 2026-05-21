import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

const mockSpawn = vi.fn()
vi.mock('child_process', () => ({ spawn: mockSpawn }))
vi.mock('electron', () => ({ app: { getPath: vi.fn(), isPackaged: false } }))

function makeMockProc({ exitCode = 0 } = {}) {
  const proc = new EventEmitter()
  proc.stdin = { write: vi.fn() }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  proc._exitCode = exitCode
  return proc
}

const { Libemf2svgShell } = await import('../../src/main/libemf2svgShell.js')

const FAKE_DIR = 'C:\\resources\\libemf2svg'

describe('Libemf2svgShell', () => {
  let shell
  let emfProc

  beforeEach(() => {
    vi.clearAllMocks()
    emfProc = makeMockProc()
    mockSpawn.mockReturnValue(emfProc)
    shell = new Libemf2svgShell(FAKE_DIR)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── ready / busy ──────────────────────────────────────────────────────────

  it('ready is always true', () => {
    expect(shell.ready).toBe(true)
  })

  it('busy is always false', () => {
    expect(shell.busy).toBe(false)
  })

  // ── start() / stop() ──────────────────────────────────────────────────────

  describe('start()', () => {
    it('resolves immediately without spawning any process', async () => {
      await expect(shell.start()).resolves.toBeUndefined()
      expect(mockSpawn).not.toHaveBeenCalled()
    })
  })

  describe('stop()', () => {
    it('is a no-op', () => {
      expect(() => shell.stop()).not.toThrow()
    })
  })

  // ── convert() ─────────────────────────────────────────────────────────────

  describe('convert()', () => {
    it('spawns emf2svg-conv.exe with -i and -o flags and resolves on exit code 0', async () => {
      const p = shell.convert('C:\\tmp\\in.emf', 'C:\\tmp\\out.svg')

      expect(mockSpawn).toHaveBeenCalledWith(
        `${FAKE_DIR}\\emf2svg-conv.exe`,
        ['-i', 'C:\\tmp\\in.emf', '-o', 'C:\\tmp\\out.svg'],
        expect.objectContaining({ cwd: FAKE_DIR })
      )

      emfProc.emit('close', 0)
      await expect(p).resolves.toBeUndefined()
    })

    it('rejects when emf2svg-conv.exe exits with non-zero code', async () => {
      const p = shell.convert('in.emf', 'out.svg')
      emfProc.emit('close', 1)
      await expect(p).rejects.toThrow('emf2svg-conv exited with code 1')
    })

    it('rejects with TIMEOUT and kills the process when timeout expires', async () => {
      vi.useFakeTimers()

      const p = shell.convert('in.emf', 'out.svg', 200)
      p.catch(() => {})
      await vi.advanceTimersByTimeAsync(300)
      await expect(p).rejects.toThrow('TIMEOUT')
      expect(emfProc.kill).toHaveBeenCalled()
    })
  })
})
