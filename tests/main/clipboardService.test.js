import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockClipboard = {
  availableFormats: vi.fn(),
  readBuffer: vi.fn(),
}

vi.mock('electron', () => ({
  clipboard: mockClipboard,
}))

const { readEMF, hasEMF } = await import('../../src/main/clipboardService.js')

describe('ClipboardService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('hasEMF()', () => {
    it('returns true when CF_ENHMETAFILE is available', () => {
      mockClipboard.availableFormats.mockReturnValue(['text/plain', 'CF_ENHMETAFILE'])
      expect(hasEMF()).toBe(true)
    })

    it('returns false when clipboard has no EMF', () => {
      mockClipboard.availableFormats.mockReturnValue(['text/plain', 'image/png'])
      expect(hasEMF()).toBe(false)
    })

    it('returns false when clipboard is empty', () => {
      mockClipboard.availableFormats.mockReturnValue([])
      expect(hasEMF()).toBe(false)
    })
  })

  describe('readEMF()', () => {
    it('returns Buffer when EMF is available', () => {
      const fakeBuffer = Buffer.from([0x01, 0x02, 0x03])
      mockClipboard.availableFormats.mockReturnValue(['CF_ENHMETAFILE'])
      mockClipboard.readBuffer.mockReturnValue(fakeBuffer)
      const result = readEMF()
      expect(result).toBe(fakeBuffer)
      expect(mockClipboard.readBuffer).toHaveBeenCalledWith('CF_ENHMETAFILE')
    })

    it('returns null when no EMF on clipboard', () => {
      mockClipboard.availableFormats.mockReturnValue(['text/plain'])
      const result = readEMF()
      expect(result).toBeNull()
      expect(mockClipboard.readBuffer).not.toHaveBeenCalled()
    })
  })
})
