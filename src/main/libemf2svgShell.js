import { spawn } from 'child_process'
import path from 'path'

export class Libemf2svgShell {
  constructor(libemf2svgDir) {
    this._dir = libemf2svgDir
    this._exe = path.join(libemf2svgDir, 'emf2svg-conv.exe')
  }

  get ready() { return true }
  get busy()  { return false }

  async start() {}
  stop() {}

  async convert(emfPath, svgPath, timeout = 15_000) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this._exe, ['-i', emfPath, '-o', svgPath, '--emfplus'], {
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
}
