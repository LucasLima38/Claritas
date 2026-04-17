import { clipboard } from 'electron'

const EMF_FORMAT = 'CF_ENHMETAFILE'

/**
 * Returns true if the Windows clipboard currently holds EMF vector data.
 */
export function hasEMF() {
  return clipboard.availableFormats().includes(EMF_FORMAT)
}

/**
 * Reads the EMF bytes from the clipboard.
 * Returns a Buffer, or null if no EMF data is present.
 */
export function readEMF() {
  if (!hasEMF()) return null
  return clipboard.readBuffer(EMF_FORMAT)
}
