import { describe, it, expect, vi, beforeEach } from 'vitest'

// availableFormats() is intentionally NOT mocked here — it never returns
// 'CF_ENHMETAFILE' on Windows (system format, not a MIME-type name).
// Detection is done exclusively via readBuffer().
const mockClipboard = {
  readBuffer: vi.fn(),
}

vi.mock('electron', () => ({
  clipboard: mockClipboard,
}))

const { readEMF, hasEMF } = await import('../../src/main/clipboardService.js')

describe('ClipboardService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('hasEMF()', () => {
    it('returns true when readBuffer yields a non-empty Buffer', () => {
      mockClipboard.readBuffer.mockReturnValue(Buffer.from([0x01, 0x02, 0x03]))
      expect(hasEMF()).toBe(true)
      expect(mockClipboard.readBuffer).toHaveBeenCalledWith('CF_ENHMETAFILE')
    })

    it('returns false when readBuffer returns an empty Buffer', () => {
      mockClipboard.readBuffer.mockReturnValue(Buffer.alloc(0))
      expect(hasEMF()).toBe(false)
    })

    it('returns false when readBuffer throws (format not on clipboard)', () => {
      mockClipboard.readBuffer.mockImplementation(() => {
        throw new Error('Clipboard format not available')
      })
      expect(hasEMF()).toBe(false)
    })
  })

  describe('readEMF()', () => {
    it('returns the Buffer when EMF data is present', () => {
      const fakeBuffer = Buffer.from([0x01, 0x02, 0x03])
      mockClipboard.readBuffer.mockReturnValue(fakeBuffer)
      const result = readEMF()
      expect(result).toBe(fakeBuffer)
      expect(mockClipboard.readBuffer).toHaveBeenCalledWith('CF_ENHMETAFILE')
    })

    it('returns null when readBuffer returns an empty Buffer', () => {
      mockClipboard.readBuffer.mockReturnValue(Buffer.alloc(0))
      expect(readEMF()).toBeNull()
    })

    it('returns null when readBuffer throws', () => {
      mockClipboard.readBuffer.mockImplementation(() => {
        throw new Error('Clipboard format not available')
      })
      expect(readEMF()).toBeNull()
    })
  })
})
