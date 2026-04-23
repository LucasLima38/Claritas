import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/main/clipboardService.js', () => ({
  readEMF: vi.fn(),
}))

const { readEMF } = await import('../../src/main/clipboardService.js')
const { ClipboardMonitor } = await import('../../src/main/clipboardMonitor.js')

describe('ClipboardMonitor', () => {
  let onNewEMF
  let monitor

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    onNewEMF = vi.fn().mockResolvedValue(undefined)
    monitor = new ClipboardMonitor(onNewEMF)
  })

  afterEach(() => {
    monitor.stop()
    vi.useRealTimers()
  })

  it('calls onNewEMF when new EMF is detected', async () => {
    const buffer = Buffer.from('emf-data')
    readEMF.mockResolvedValue(buffer)

    monitor.start()
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve() // flush async _check microtasks

    expect(onNewEMF).toHaveBeenCalledOnce()
    expect(onNewEMF).toHaveBeenCalledWith(buffer)
  })

  it('does NOT call onNewEMF when EMF content is identical (same hash)', async () => {
    const buffer = Buffer.from('same-data')
    readEMF.mockResolvedValue(buffer)

    monitor.start()
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()

    // Same hash → callback fires only once
    expect(onNewEMF).toHaveBeenCalledOnce()
  })

  it('does NOT call onNewEMF when clipboard is empty', async () => {
    readEMF.mockResolvedValue(null)

    monitor.start()
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()

    expect(onNewEMF).not.toHaveBeenCalled()
  })

  it('calls onNewEMF again when clipboard changes to new content', async () => {
    readEMF
      .mockResolvedValueOnce(Buffer.from('first'))
      .mockResolvedValueOnce(Buffer.from('second'))

    monitor.start()
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()

    expect(onNewEMF).toHaveBeenCalledTimes(2)
  })

  it('stop() prevents further callbacks', async () => {
    const buffer = Buffer.from('data')
    readEMF.mockResolvedValue(buffer)

    monitor.start()
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()
    monitor.stop()
    await vi.advanceTimersByTimeAsync(2000)
    await Promise.resolve()

    // Only the tick before stop() fires
    expect(onNewEMF).toHaveBeenCalledOnce()
  })
})
