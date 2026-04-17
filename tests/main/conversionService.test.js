import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    promises: {
      ...actual.promises,
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
      unlink: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockResolvedValue(undefined),
    },
    existsSync: vi.fn().mockReturnValue(true),
  }
})

const mockSpawn = vi.fn()
vi.mock('child_process', () => ({ spawn: mockSpawn, execSync: vi.fn(() => '') }))

vi.mock('electron', () => ({ app: { getPath: vi.fn() } }))

function makeFakeProcess(exitCode = 0, delay = 10) {
  const proc = new EventEmitter()
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  setTimeout(() => proc.emit('close', exitCode), delay)
  return proc
}

const { findInkscape, convert, isValidSVG } = await import('../../src/main/conversionService.js')

describe('ConversionService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('isValidSVG()', () => {
    it('returns true for valid SVG with content', () => {
      expect(isValidSVG('<svg xmlns="..."><rect x="0" y="0" width="10" height="10"/></svg>')).toBe(true)
    })

    it('returns false for empty string', () => {
      expect(isValidSVG('')).toBe(false)
    })

    it('returns false for SVG with empty body', () => {
      expect(isValidSVG('<svg xmlns="..."></svg>')).toBe(false)
    })

    it('returns false for non-SVG content', () => {
      expect(isValidSVG('Hello world')).toBe(false)
    })
  })

  describe('findInkscape()', () => {
    it('returns path when default location exists', async () => {
      const { existsSync } = await import('fs')
      existsSync.mockImplementation((p) => p.includes('inkscape.exe'))
      const result = findInkscape()
      expect(result).toContain('inkscape.exe')
    })

    it('returns null when no Inkscape found', async () => {
      const { existsSync } = await import('fs')
      existsSync.mockReturnValue(false)
      const result = findInkscape()
      expect(result).toBeNull()
    })
  })

  describe('convert()', () => {
    it('resolves with SVG string on success', async () => {
      mockSpawn.mockReturnValue(makeFakeProcess(0))
      const emfBuffer = Buffer.from([0x01])
      const svg = await convert(emfBuffer, 'C:\\inkscape.exe')
      expect(svg).toContain('<svg')
    })

    it('rejects with TIMEOUT error when Inkscape hangs', async () => {
      const proc = makeFakeProcess(0, 99999)
      proc.kill = vi.fn()
      mockSpawn.mockReturnValue(proc)
      await expect(convert(Buffer.from([0x01]), 'C:\\inkscape.exe', 50))
        .rejects.toThrow('TIMEOUT')
      expect(proc.kill).toHaveBeenCalled()
    })

    it('rejects when Inkscape exits with non-zero code', async () => {
      mockSpawn.mockReturnValue(makeFakeProcess(1))
      await expect(convert(Buffer.from([0x01]), 'C:\\inkscape.exe'))
        .rejects.toThrow('code 1')
    })
  })
})
