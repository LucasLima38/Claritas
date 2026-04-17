import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockResolvedValue(undefined),
    },
  }
})

const { generateFilename, saveSVG, checkOutputDir } = await import('../../src/main/saveService.js')

describe('SaveService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('generateFilename()', () => {
    it('pads counter to 3 digits', () => {
      expect(generateFilename('BLDC_', 1)).toBe('BLDC_001.svg')
      expect(generateFilename('BLDC_', 12)).toBe('BLDC_012.svg')
      expect(generateFilename('BLDC_', 123)).toBe('BLDC_123.svg')
    })

    it('handles prefix without trailing underscore', () => {
      expect(generateFilename('RF', 5)).toBe('RF005.svg')
    })

    it('handles counter over 999', () => {
      expect(generateFilename('BLDC_', 1000)).toBe('BLDC_1000.svg')
    })

    it('first save on a new project (counter=0) produces _001', () => {
      // counter starts at 0; save handler calls generateFilename(prefix, counter + 1)
      expect(generateFilename('BLDC_', 0 + 1)).toBe('BLDC_001.svg')
    })
  })

  describe('saveSVG()', () => {
    it('writes SVG to the correct path', async () => {
      const { promises: fsp } = await import('fs')
      const fullPath = await saveSVG('<svg/>', 'D:\\docs', 'BLDC_001.svg')
      expect(fsp.mkdir).toHaveBeenCalledWith('D:\\docs', { recursive: true })
      expect(fsp.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('BLDC_001.svg'),
        '<svg/>',
        'utf8'
      )
      expect(fullPath).toContain('BLDC_001.svg')
    })

    it('throws EACCES when writeFile rejects with permission error', async () => {
      const { promises: fsp } = await import('fs')
      const err = new Error('permission denied')
      err.code = 'EACCES'
      fsp.writeFile.mockRejectedValue(err)
      await expect(saveSVG('<svg/>', 'C:\\Windows\\System32', 'test.svg'))
        .rejects.toThrow('EACCES')
    })
  })

  describe('checkOutputDir()', () => {
    it('returns { exists: true } when directory is accessible', async () => {
      const { promises: fsp } = await import('fs')
      fsp.access.mockResolvedValue(undefined)
      const result = await checkOutputDir('D:\\docs')
      expect(result.exists).toBe(true)
    })

    it('returns { exists: false } when directory is missing', async () => {
      const { promises: fsp } = await import('fs')
      fsp.access.mockRejectedValue(new Error('ENOENT'))
      const result = await checkOutputDir('D:\\nonexistent')
      expect(result.exists).toBe(false)
    })
  })
})
