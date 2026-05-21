import { createHash } from 'crypto'
import { readEMF } from './clipboardService.js'

/**
 * Polls the clipboard every 1 second for CF_ENHMETAFILE (EMF) content.
 * Fires `onNewEMF(buffer)` only when the content has changed (SHA-256 dedup).
 * Overlapping checks are skipped via the `_checking` guard.
 */
export class ClipboardMonitor {
  constructor(onNewEMF) {
    this._onNewEMF = onNewEMF
    this._lastHash = null
    this._interval = null
    this._checking = false
  }

  /** Start polling. Safe to call multiple times — won't create duplicate intervals. */
  start() {
    if (this._interval) return
    this._interval = setInterval(() => this._check(), 1000)
  }

  /** Stop polling. */
  stop() {
    clearInterval(this._interval)
    this._interval = null
  }

  async _check() {
    if (this._checking) return
    this._checking = true
    try {
      const buffer = await readEMF()
      if (!buffer) return
      const hash = createHash('sha256').update(buffer).digest('hex')
      if (hash === this._lastHash) return
      this._lastHash = hash
      await this._onNewEMF(buffer)
    } catch {
      // Silently ignore transient clipboard/conversion errors
    } finally {
      this._checking = false
    }
  }
}
