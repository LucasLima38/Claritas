import { describe, it, expect, vi, beforeEach } from 'vitest'
import { promises as fsp } from 'fs'
import path from 'path'

// Unit tests use mocked fs
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

const { generateFilename, generateFilenameWithExt, saveSVG, checkOutputDir, saveImage } = await import('../../src/main/saveService.js')

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

describe('generateFilenameWithExt()', () => {
  it('generates filename with given extension', () => {
    expect(generateFilenameWithExt('BLDC_', 1, 'svg')).toBe('BLDC_001.svg')
    expect(generateFilenameWithExt('BLDC_', 1, 'png')).toBe('BLDC_001.png')
    expect(generateFilenameWithExt('BLDC_', 1, 'jpg')).toBe('BLDC_001.jpg')
    expect(generateFilenameWithExt('BLDC_', 1, 'pdf')).toBe('BLDC_001.pdf')
  })

  it('pads counter to 3 digits', () => {
    expect(generateFilenameWithExt('X_', 7, 'png')).toBe('X_007.png')
    expect(generateFilenameWithExt('X_', 42, 'png')).toBe('X_042.png')
  })

  it('does not pad counter above 999', () => {
    expect(generateFilenameWithExt('X_', 1000, 'png')).toBe('X_1000.png')
  })
})

describe('dirMissing signal', () => {
  it('checkOutputDir returns { exists: false } for missing dir — dirMissing path is triggered', async () => {
    const { promises: fsp } = await import('fs')
    fsp.access.mockRejectedValue(new Error('ENOENT'))
    const result = await checkOutputDir('D:\\nonexistent')
    // In save-svg handler: if (!result.exists) return { dirMissing: true, outputDir }
    expect(result.exists).toBe(false)
    // Simulate handler response
    const handlerResponse = !result.exists
      ? { dirMissing: true, outputDir: 'D:\\nonexistent' }
      : { ok: true }
    expect(handlerResponse.dirMissing).toBe(true)
    expect(handlerResponse.outputDir).toBe('D:\\nonexistent')
  })
})

describe('saveImage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('calls mkdir and writeFile with correct args for PNG', async () => {
    const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const dataURL = `data:image/png;base64,${pngData}`
    const outputDir = 'D:\\docs\\screenshots'
    const filename = 'test-image.png'

    const result = await saveImage(dataURL, outputDir, filename)

    expect(fsp.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true })
    expect(fsp.writeFile).toHaveBeenCalledWith(
      path.join(outputDir, filename),
      expect.any(Buffer)
    )
    expect(result).toBe(path.join(outputDir, filename))
  })

  it('strips dataURL header and decodes base64 to buffer', async () => {
    const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const dataURL = `data:image/png;base64,${pngData}`

    await saveImage(dataURL, 'D:\\out', 'img.png')

    const [, writtenBuffer] = fsp.writeFile.mock.calls[0]
    expect(writtenBuffer).toBeInstanceOf(Buffer)
    expect(writtenBuffer.length).toBeGreaterThan(0)
  })

  it('works with JPG dataURL', async () => {
    const jpgData = '/9j/4AAQSkZJRgABAQEASABIAAD/2Q=='
    const dataURL = `data:image/jpeg;base64,${jpgData}`

    const result = await saveImage(dataURL, 'D:\\out', 'img.jpg')

    expect(fsp.writeFile).toHaveBeenCalled()
    expect(result).toContain('img.jpg')
  })

  it('throws with error code when writeFile rejects', async () => {
    const err = new Error('permission denied')
    err.code = 'EACCES'
    fsp.writeFile.mockRejectedValueOnce(err)

    await expect(saveImage('data:image/png;base64,abc', 'D:\\out', 'img.png'))
      .rejects.toThrow('EACCES')
  })
})
