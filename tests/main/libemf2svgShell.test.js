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
const FAKE_INK = 'C:\\resources\\inkscape\\bin\\inkscape.exe'

describe('Libemf2svgShell', () => {
  let shell
  let inkProc  // mock child_process for InkscapeShell internal

  beforeEach(() => {
    vi.clearAllMocks()
    inkProc = makeMockProc()
    mockSpawn.mockReturnValue(inkProc)
    shell = new Libemf2svgShell(FAKE_DIR, FAKE_INK)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── start() / ready ───────────────────────────────────────────────────────

  describe('start()', () => {
    it('delegates startup to the wrapped InkscapeShell', async () => {
      const p = shell.start()
      inkProc.stdout.emit('data', '> ')
      await expect(p).resolves.toBeUndefined()
      expect(shell.ready).toBe(true)
    })
  })

  // ── convert() ─────────────────────────────────────────────────────────────

  describe('convert()', () => {
    it('spawns emf2svg-conv.exe with -i and -o flags and resolves on exit code 0', async () => {
      const emfProc = makeMockProc()
      // First spawn call goes to InkscapeShell startup; second is for emf2svg-conv
      mockSpawn
        .mockReturnValueOnce(inkProc)   // InkscapeShell internal
        .mockReturnValueOnce(emfProc)   // emf2svg-conv

      // Start the inkscape side
      const startP = shell.start()
      inkProc.stdout.emit('data', '> ')
      await startP

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
      const emfProc = makeMockProc()
      mockSpawn
        .mockReturnValueOnce(inkProc)
        .mockReturnValueOnce(emfProc)

      const startP = shell.start()
      inkProc.stdout.emit('data', '> ')
      await startP

      const p = shell.convert('in.emf', 'out.svg')
      emfProc.emit('close', 1)
      await expect(p).rejects.toThrow('emf2svg-conv exited with code 1')
    })

    it('rejects with TIMEOUT and kills the process when timeout expires', async () => {
      vi.useFakeTimers()
      const emfProc = makeMockProc()
      mockSpawn
        .mockReturnValueOnce(inkProc)
        .mockReturnValueOnce(emfProc)

      const startP = shell.start()
      inkProc.stdout.emit('data', '> ')
      await startP

      const p = shell.convert('in.emf', 'out.svg', 200)
      p.catch(() => {})
      await vi.advanceTimersByTimeAsync(300)
      await expect(p).rejects.toThrow('TIMEOUT')
      expect(emfProc.kill).toHaveBeenCalled()
    })
  })

  // ── execute() delegates to InkscapeShell ─────────────────────────────────

  describe('execute()', () => {
    async function startShell() {
      const p = shell.start()
      inkProc.stdout.emit('data', '> ')
      await p
    }

    it('delegates execute() to the wrapped InkscapeShell', async () => {
      await startShell()

      const p = shell.execute('file-open:test.svg; export-do')
      expect(inkProc.stdin.write).toHaveBeenCalledWith('file-open:test.svg; export-do\n')

      inkProc.stdout.emit('data', '> ')
      await expect(p).resolves.toBeUndefined()
    })
  })
})
