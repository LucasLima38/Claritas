/**
 * Tests for the save-image IPC handler wiring:
 * - applyResolution is called with correct arguments
 * - saved file uses the processed buffer (not raw)
 * - resolution: 'normal' passes buffer unchanged
 *
 * Strategy: test saveBuffer + applyResolution composition directly
 * (the handler in index.js just wires these two functions together).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('sharp', () => {
  const sharpMock = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 200, height: 100 }),
    resize: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('scaled-image-data')),
  }))
  return { default: sharpMock }
})

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

const { saveBuffer, applyResolution } = await import('../../src/main/saveService.js')

describe('save-image handler wiring: applyResolution + saveBuffer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applyResolution is called with correct buffer and resolution', async () => {
    const sharp = (await import('sharp')).default
    const rawBuffer = Buffer.from('raw-image')

    await applyResolution(rawBuffer, 'low')

    // sharp called once for metadata
    expect(sharp).toHaveBeenCalledWith(rawBuffer)
    // sharp called second time for resize
    expect(sharp).toHaveBeenCalledTimes(2)
    const resizeInstance = sharp.mock.results[1].value
    // 200 * 0.5 = 100, 100 * 0.5 = 50
    expect(resizeInstance.resize).toHaveBeenCalledWith(100, 50)
  })

  it('the saved file uses the processed buffer, not the raw buffer', async () => {
    const { promises: fsp } = await import('fs')
    const rawBuffer = Buffer.from('raw-image')

    // applyResolution with 'high' returns a different buffer
    const processedBuffer = await applyResolution(rawBuffer, 'high')
    await saveBuffer(processedBuffer, 'D:\\out', 'img.png')

    const [, writtenBuffer] = fsp.writeFile.mock.calls[0]
    // The written buffer should be the processed one ('scaled-image-data'), not rawBuffer
    expect(writtenBuffer.toString()).toBe('scaled-image-data')
    expect(writtenBuffer).not.toBe(rawBuffer)
  })

  it('resolution "normal" passes the original buffer unchanged to saveBuffer', async () => {
    const { promises: fsp } = await import('fs')
    const rawBuffer = Buffer.from('original-data')

    const processedBuffer = await applyResolution(rawBuffer, 'normal')
    // Should be the exact same reference
    expect(processedBuffer).toBe(rawBuffer)

    await saveBuffer(processedBuffer, 'D:\\out', 'img.png')
    const [, writtenBuffer] = fsp.writeFile.mock.calls[0]
    expect(writtenBuffer).toBe(rawBuffer)
  })

  it('undefined resolution (backward compat) passes the original buffer unchanged', async () => {
    const rawBuffer = Buffer.from('original-data')
    const processedBuffer = await applyResolution(rawBuffer, undefined)
    expect(processedBuffer).toBe(rawBuffer)
  })
})
