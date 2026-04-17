import { clipboard } from 'electron'

const EMF_FORMAT = 'CF_ENHMETAFILE'

/**
 * Returns true if the Windows clipboard currently holds EMF vector data.
 *
 * NOTE: clipboard.availableFormats() only returns MIME-type names that
 * Electron handles natively (text/plain, image/png, etc.).  It never
 * includes CF_ENHMETAFILE because that is a Windows system format with
 * an integer ID (14) — not a named custom format.
 *
 * The only reliable detection method is to attempt readBuffer() and
 * check that the returned Buffer is non-empty.
 */
export function hasEMF() {
  try {
    const buf = clipboard.readBuffer(EMF_FORMAT)
    return Buffer.isBuffer(buf) && buf.length > 0
  } catch {
    return false
  }
}

/**
 * Reads the EMF bytes from the clipboard.
 * Returns a Buffer, or null if no EMF data is present.
 */
export function readEMF() {
  try {
    const buf = clipboard.readBuffer(EMF_FORMAT)
    return (Buffer.isBuffer(buf) && buf.length > 0) ? buf : null
  } catch {
    return null
  }
}
