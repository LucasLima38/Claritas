import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

const mockSpawn = vi.fn()
vi.mock('child_process', () => ({ spawn: mockSpawn }))
vi.mock('electron', () => ({ app: { getPath: vi.fn(), isPackaged: false } }))

/** Creates a mock ChildProcess that mimics what spawn() returns. */
function makeMockProc() {
  const proc = new EventEmitter()
  proc.stdin = { write: vi.fn() }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  return proc
}

const { InkscapeShell } = await import('../../src/main/inkscapeShell.js')

describe('InkscapeShell', () => {
  let shell
  let proc

  beforeEach(() => {
    vi.clearAllMocks()
    proc = makeMockProc()
    mockSpawn.mockReturnValue(proc)
    shell = new InkscapeShell('C:\\fake\\inkscape.exe')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── start() ──────────────────────────────────────────────────────────────

  describe('start()', () => {
    it('resolves when stdout emits "> "', async () => {
      const p = shell.start()
      proc.stdout.emit('data', 'Inkscape interactive shell mode.\n> ')
      await expect(p).resolves.toBeUndefined()
      expect(mockSpawn).toHaveBeenCalledWith(
        'C:\\fake\\inkscape.exe',
        ['--shell'],
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
      )
    })

    it('rejects with STARTUP_TIMEOUT when no prompt arrives', async () => {
      vi.useFakeTimers()
      const p = shell.start()
      p.catch(() => {}) // prevent unhandled rejection during timer advancement
      await vi.advanceTimersByTimeAsync(11_000)
      await expect(p).rejects.toThrow('STARTUP_TIMEOUT')
    })
  })

  // ── convert() ────────────────────────────────────────────────────────────

  describe('convert()', () => {
    async function startShell() {
      const p = shell.start()
      proc.stdout.emit('data', '> ')
      await p
    }

    it('writes command to stdin and resolves when stdout emits "> "', async () => {
      await startShell()

      const p = shell.convert('C:\\tmp\\in.emf', 'C:\\tmp\\out.svg')
      expect(proc.stdin.write).toHaveBeenCalledWith(
        'C:\\tmp\\in.emf --export-filename=C:\\tmp\\out.svg --export-area-drawing\n'
      )

      proc.stdout.emit('data', '> ')
      await expect(p).resolves.toBeUndefined()
    })

    it('rejects with TIMEOUT when no prompt arrives within timeout', async () => {
      vi.useFakeTimers()
      // startShell emits "> " synchronously, so startup resolves despite fake timers
      await startShell()

      const p = shell.convert('in.emf', 'out.svg', 200)
      p.catch(() => {}) // prevent unhandled rejection during timer advancement
      await vi.advanceTimersByTimeAsync(300)
      await expect(p).rejects.toThrow('TIMEOUT')
    })

    it('rejects immediately when process crashes during conversion', async () => {
      const restartProc = makeMockProc()
      mockSpawn.mockReturnValueOnce(proc).mockReturnValue(restartProc)

      await startShell()

      const p = shell.convert('in.emf', 'out.svg')
      proc.emit('exit', 1, null)
      await expect(p).rejects.toThrow('PROCESS_CRASHED')
    })
  })

  // ── busy getter ───────────────────────────────────────────────────────────

  describe('busy', () => {
    it('is false before any conversion and true during one', async () => {
      const p = shell.start()
      proc.stdout.emit('data', '> ')
      await p

      expect(shell.busy).toBe(false)

      const cp = shell.convert('in.emf', 'out.svg')
      expect(shell.busy).toBe(true)

      proc.stdout.emit('data', '> ')
      await cp
      expect(shell.busy).toBe(false)
    })
  })
})
