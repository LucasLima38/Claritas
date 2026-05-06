import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron before dynamic import
vi.mock('electron', () => ({
  desktopCapturer: {
    getSources: vi.fn(),
  },
  screen: {
    getDisplayMatching: vi.fn(() => ({ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } })),
    getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 400 })),
    getAllDisplays: vi.fn(() => [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }]),
  },
  BrowserWindow: vi.fn(() => ({
    loadFile: vi.fn(),
    show: vi.fn(),
    destroy: vi.fn(),
    webContents: { send: vi.fn() },
    on: vi.fn(),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
  })),
  ipcMain: {
    once: vi.fn(),
    removeListener: vi.fn(),
  },
  app: { getPath: vi.fn(() => '/tmp') },
}))

vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, join: actual.join }
})

const { captureFullscreen, captureWindow, makeDataURLFromSource } =
  await import('../../src/main/screenshotService.js')

describe('screenshotService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('makeDataURLFromSource()', () => {
    it('converts a Uint8Array thumbnail to a PNG dataURL', () => {
      const fakeImage = {
        toPNG: () => Buffer.from([137, 80, 78, 71]),
        getSize: () => ({ width: 1920, height: 1080 }),
        toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=',
        crop: vi.fn().mockReturnThis(),
      }
      const result = makeDataURLFromSource(fakeImage, null)
      expect(result.dataURL).toContain('data:image/png;base64,')
      expect(typeof result.width).toBe('number')
      expect(typeof result.height).toBe('number')
    })

    it('crops image when cropRect is provided', () => {
      const fakeImage = {
        toPNG: () => Buffer.from([137, 80, 78, 71]),
        getSize: () => ({ width: 1920, height: 1080 }),
        toDataURL: () => 'data:image/png;base64,cropped=',
        crop: vi.fn().mockReturnThis(),
      }
      const cropRect = { x: 100, y: 50, width: 400, height: 300 }
      makeDataURLFromSource(fakeImage, cropRect)
      expect(fakeImage.crop).toHaveBeenCalledWith(cropRect)
    })
  })

  describe('captureFullscreen()', () => {
    it('calls desktopCapturer.getSources with screen type', async () => {
      const { desktopCapturer } = await import('electron')
      const fakeSource = {
        id: 'screen:1',
        name: 'Screen 1',
        thumbnail: {
          toPNG: () => Buffer.from([137, 80, 78, 71]),
          getSize: () => ({ width: 1920, height: 1080 }),
          toDataURL: () => 'data:image/png;base64,abc=',
          crop: vi.fn().mockReturnThis(),
        },
      }
      desktopCapturer.getSources.mockResolvedValue([fakeSource])

      const fakeWin = {
        getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
      }
      const result = await captureFullscreen(fakeWin)
      expect(desktopCapturer.getSources).toHaveBeenCalledWith(
        expect.objectContaining({ types: ['screen'] })
      )
      expect(result.dataURL).toContain('data:image/png;base64,')
    })

    it('throws when no screen sources found', async () => {
      const { desktopCapturer } = await import('electron')
      desktopCapturer.getSources.mockResolvedValue([])
      const fakeWin = { getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }) }
      await expect(captureFullscreen(fakeWin)).rejects.toThrow('No screen source found')
    })
  })

  describe('captureWindow()', () => {
    it('calls desktopCapturer.getSources with window type', async () => {
      const { desktopCapturer } = await import('electron')
      const fakeSource = {
        id: 'window:1',
        name: 'Test Window',
        thumbnail: {
          toPNG: () => Buffer.from([137, 80, 78, 71]),
          getSize: () => ({ width: 800, height: 600 }),
          toDataURL: () => 'data:image/png;base64,win=',
          crop: vi.fn().mockReturnThis(),
        },
      }
      desktopCapturer.getSources.mockResolvedValue([fakeSource])

      const result = await captureWindow()
      expect(desktopCapturer.getSources).toHaveBeenCalledWith(
        expect.objectContaining({ types: ['window'] })
      )
      expect(result.dataURL).toContain('data:image/png;base64,')
    })
  })
})
