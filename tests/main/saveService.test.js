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

vi.mock('sharp', () => {
  const sharpMock = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 80 }),
    resize: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized')),
  }))
  return { default: sharpMock }
})

const { generateFilenameWithExt, checkOutputDir, saveImage, saveBuffer, applyResolution } = await import('../../src/main/saveService.js')

describe('SaveService', () => {
  beforeEach(() => vi.clearAllMocks())

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
    expect(result.exists).toBe(false)
  })
})

describe('saveBuffer', () => {
  beforeEach(() => vi.resetAllMocks())

  it('creates output directory and writes file, returning the full path', async () => {
    const buf = Buffer.from('hello')
    const result = await saveBuffer(buf, 'D:\\out', 'img.png')
    expect(fsp.mkdir).toHaveBeenCalledWith('D:\\out', { recursive: true })
    expect(fsp.writeFile).toHaveBeenCalledWith(path.join('D:\\out', 'img.png'), buf)
    expect(result).toBe(path.join('D:\\out', 'img.png'))
  })

  it('throws an error with the OS error code when writeFile fails', async () => {
    const err = new Error('permission denied')
    err.code = 'EACCES'
    fsp.writeFile.mockRejectedValueOnce(err)
    await expect(saveBuffer(Buffer.from('x'), 'D:\\out', 'img.png')).rejects.toThrow('EACCES')
  })
})

describe('applyResolution', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns the buffer unchanged when resolution is "normal"', async () => {
    const buf = Buffer.from('data')
    const result = await applyResolution(buf, 'normal')
    expect(result).toBe(buf)
  })

  it('returns the buffer unchanged when resolution is null', async () => {
    const buf = Buffer.from('data')
    const result = await applyResolution(buf, null)
    expect(result).toBe(buf)
  })

  it('returns the buffer unchanged when resolution is undefined', async () => {
    const buf = Buffer.from('data')
    const result = await applyResolution(buf, undefined)
    expect(result).toBe(buf)
  })

  it('calls sharp().resize() with width*0.5 and height*0.5 for "low"', async () => {
    const sharp = (await import('sharp')).default
    const buf = Buffer.from('data')
    // sharp is called twice: once for metadata(), once for resize chain
    await applyResolution(buf, 'low')
    const instance = sharp.mock.results[1].value
    expect(instance.resize).toHaveBeenCalledWith(50, 40)
  })

  it('calls sharp().resize() with width*2 and height*2 for "high"', async () => {
    const sharp = (await import('sharp')).default
    const buf = Buffer.from('data')
    // sharp is called twice: once for metadata(), once for resize chain
    await applyResolution(buf, 'high')
    const instance = sharp.mock.results[1].value
    expect(instance.resize).toHaveBeenCalledWith(200, 160)
  })

  it('uses Math.round() on the scaled dimensions', async () => {
    const sharp = (await import('sharp')).default
    // Override metadata to return non-integer-friendly values
    const mockInstance = {
      metadata: vi.fn().mockResolvedValue({ width: 101, height: 81 }),
      resize: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized')),
    }
    sharp.mockReturnValueOnce(mockInstance).mockReturnValueOnce(mockInstance)
    const buf = Buffer.from('data')
    await applyResolution(buf, 'low')
    // 101 * 0.5 = 50.5 → Math.round → 51, 81 * 0.5 = 40.5 → Math.round → 41
    expect(mockInstance.resize).toHaveBeenCalledWith(51, 41)
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
