// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { OcrPanel } from '../../src/renderer/src/components/OcrPanel'

// Mock tesseract.js
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}))

describe('OcrPanel', () => {
  let mockWorker

  beforeEach(() => {
    vi.clearAllMocks()
    mockWorker = {
      recognize: vi.fn(),
      terminate: vi.fn(),
    }
  })

  it('shows idle state initially', () => {
    render(<OcrPanel worker={null} imageDataURL="data:image/png;base64,abc" />)
    // Should show the panel with no extracted text yet
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('shows loading state while OCR is running', async () => {
    // A worker that never resolves (simulates loading)
    const neverResolves = new Promise(() => {})
    mockWorker.recognize.mockReturnValue(neverResolves)

    render(
      <OcrPanel
        worker={mockWorker}
        imageDataURL="data:image/png;base64,abc"
        autoRun
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/extraindo/i)).toBeInTheDocument()
    })
  })

  it('shows extracted text when OCR succeeds', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: { text: 'Hello World\n' },
    })

    await act(async () => {
      render(
        <OcrPanel
          worker={mockWorker}
          imageDataURL="data:image/png;base64,abc"
          autoRun
        />
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('Hello World')
    })
  })

  it('shows error message when OCR times out', async () => {
    vi.useFakeTimers()
    mockWorker.recognize.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 31000))
    )

    render(
      <OcrPanel
        worker={mockWorker}
        imageDataURL="data:image/png;base64,abc"
        autoRun
      />
    )

    await act(async () => { vi.advanceTimersByTime(31000) })

    await waitFor(() => {
      expect(screen.getByText(/demorou muito/i)).toBeInTheDocument()
    })
    vi.useRealTimers()
  })

  it('copies text to clipboard on Copiar click', async () => {
    mockWorker.recognize.mockResolvedValue({ data: { text: 'copied text' } })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    })

    await act(async () => {
      render(
        <OcrPanel worker={mockWorker} imageDataURL="data:image/png;base64,abc" autoRun />
      )
    })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('copied text'))

    fireEvent.click(screen.getByRole('button', { name: /copiar/i }))
    expect(writeText).toHaveBeenCalledWith('copied text')
  })

  it('clears text on Limpar click', async () => {
    mockWorker.recognize.mockResolvedValue({ data: { text: 'some text' } })

    await act(async () => {
      render(
        <OcrPanel worker={mockWorker} imageDataURL="data:image/png;base64,abc" autoRun />
      )
    })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('some text'))

    fireEvent.click(screen.getByRole('button', { name: /limpar/i }))
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('shows "nenhum texto" message when OCR returns empty string', async () => {
    mockWorker.recognize.mockResolvedValue({ data: { text: '   \n' } })

    await act(async () => {
      render(
        <OcrPanel worker={mockWorker} imageDataURL="data:image/png;base64,abc" autoRun />
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/nenhum texto/i)).toBeInTheDocument()
    })
  })
})
