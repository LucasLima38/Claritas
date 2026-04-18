import { spawn } from 'child_process'

const STARTUP_TIMEOUT_MS = 10_000
const PROMPT = '> '

export class InkscapeShell {
  constructor(executablePath) {
    this._exe = executablePath
    this._proc = null
    this._ready = false
    this._buffer = ''
    this._pendingResolve = null
    this._pendingReject = null
    this._stopping = false
  }

  /** True while a convert() call is awaiting the completion prompt. */
  get busy() {
    return this._pendingResolve !== null
  }

  /**
   * Spawns `inkscape --shell` and waits for the first `> ` prompt.
   * Resolves when the shell is ready to accept commands.
   * Rejects with Error('STARTUP_TIMEOUT') if the prompt doesn't arrive in 10 s.
   */
  async start() {
    if (this._proc !== null) return
    this._stopping = false
    this._ready = false
    this._buffer = ''

    await new Promise((resolve, reject) => {
      const startTimer = setTimeout(
        () => reject(new Error('STARTUP_TIMEOUT')),
        STARTUP_TIMEOUT_MS
      )

      this._proc = spawn(this._exe, ['--shell'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      this._proc.stdout.on('data', (chunk) => {
        this._buffer += chunk.toString()
        if (!this._buffer.includes(PROMPT)) return

        if (!this._ready) {
          // First prompt — startup complete
          clearTimeout(startTimer)
          this._ready = true
          this._buffer = ''
          resolve()
        } else if (this._pendingResolve) {
          // Subsequent prompt — conversion complete
          const res = this._pendingResolve
          this._pendingResolve = null
          this._pendingReject = null
          this._buffer = ''
          res()
        }
      })

      this._proc.on('exit', (_code, _signal) => {
        if (this._stopping) return

        // Unexpected crash — reject any active convert() call
        const rej = this._pendingReject
        this._pendingResolve = null
        this._pendingReject = null
        if (rej) rej(new Error('PROCESS_CRASHED'))

        this._ready = false
        this._proc = null
        // Auto-restart silently — store promise so it is always handled
        const restartPromise = this.start()
        restartPromise.catch(() => {})
      })

      this._proc.on('error', (err) => {
        clearTimeout(startTimer)
        reject(err)
      })
    })
  }

  /**
   * Kills the Inkscape process. Called on app before-quit.
   */
  stop() {
    this._stopping = true
    this._ready = false
    this._proc?.kill()
    this._proc = null
  }

  /**
   * Sends an EMF→SVG conversion command to the running shell.
   * @param {string} emfPath  Absolute path to the input .emf file (already written)
   * @param {string} svgPath  Absolute path where Inkscape should write the output .svg
   * @param {number} timeout  Milliseconds before rejecting with TIMEOUT (default 15 s)
   * @returns {Promise<void>} Resolves when Inkscape signals completion with `> `
   */
  async convert(emfPath, svgPath, timeout = 15_000) {
    if (!this._ready) throw new Error('SHELL_NOT_READY')

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingResolve = null
        this._pendingReject = null
        this._ready = false
        this._proc?.kill() // force restart; stale prompt won't corrupt the next convert()
        reject(new Error('TIMEOUT'))
      }, timeout)

      this._pendingResolve = () => {
        clearTimeout(timer)
        resolve()
      }
      this._pendingReject = (err) => {
        clearTimeout(timer)
        reject(err)
      }

      const cmd = `"${emfPath}" --export-filename="${svgPath}" --export-area-drawing\n`
      this._proc.stdin.write(cmd)
    })
  }
}
