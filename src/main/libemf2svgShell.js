import { spawn } from 'child_process'
import path from 'path'
import { InkscapeShell } from './inkscapeShell.js'

/**
 * EMF→SVG converter that uses the bundled emf2svg-conv.exe (libemf2svg).
 * Export operations (PNG/JPG/PDF) are delegated to a wrapped InkscapeShell.
 */
export class Libemf2svgShell {
  constructor(libemf2svgDir, inkscapeExePath) {
    this._dir = libemf2svgDir
    this._exe = path.join(libemf2svgDir, 'emf2svg-conv.exe')
    this._inkscape = new InkscapeShell(inkscapeExePath)
  }

  get ready() {
    return this._inkscape.ready
  }

  get busy() {
    return this._inkscape.busy
  }

  async start() {
    await this._inkscape.start()
  }

  stop() {
    this._inkscape.stop()
  }

  /**
   * Converts emfPath → svgPath using emf2svg-conv.exe.
   * The exe and its DLLs live in this._dir; cwd is set there so Windows
   * resolves the DLL dependencies automatically.
   */
  async convert(emfPath, svgPath, timeout = 15_000) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this._exe, ['-i', emfPath, '-o', svgPath], {
        cwd: this._dir,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let done = false

      const timer = setTimeout(() => {
        done = true
        proc.kill()
        reject(new Error('TIMEOUT'))
      }, timeout)

      proc.on('close', (code) => {
        if (done) return
        done = true
        clearTimeout(timer)
        if (code === 0) resolve()
        else reject(new Error(`emf2svg-conv exited with code ${code}`))
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  /**
   * Delegates export actions (PNG/JPG/PDF) to the wrapped InkscapeShell.
   */
  async execute(actions, timeout = 30_000) {
    return this._inkscape.execute(actions, timeout)
  }
}
