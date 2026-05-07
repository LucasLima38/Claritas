// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { OcrPanel } from '../../src/renderer/src/components/OcrPanel'

describe('OcrPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows idle state initially', () => {
    render(<OcrPanel runOcr={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('shows loading state while OCR is running', async () => {
    const neverResolves = new Promise(() => {})
    render(
      <OcrPanel
        runOcr={() => neverResolves}
        autoRun
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/extraindo/i)).toBeInTheDocument()
    })
  })

  it('shows extracted text when OCR succeeds', async () => {
    const mockRunOcr = vi.fn().mockResolvedValue('Hello World')

    await act(async () => {
      render(
        <OcrPanel
          runOcr={mockRunOcr}
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
    const mockRunOcr = vi.fn().mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 31000))
    )

    render(
      <OcrPanel
        runOcr={mockRunOcr}
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
    const mockRunOcr = vi.fn().mockResolvedValue('copied text')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    })

    await act(async () => {
      render(<OcrPanel runOcr={mockRunOcr} autoRun />)
    })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('copied text'))

    fireEvent.click(screen.getByRole('button', { name: /copiar/i }))
    expect(writeText).toHaveBeenCalledWith('copied text')
  })

  it('clears text on Limpar click', async () => {
    const mockRunOcr = vi.fn().mockResolvedValue('some text')

    await act(async () => {
      render(<OcrPanel runOcr={mockRunOcr} autoRun />)
    })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('some text'))

    fireEvent.click(screen.getByRole('button', { name: /limpar/i }))
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('shows "nenhum texto" message when OCR returns empty string', async () => {
    const mockRunOcr = vi.fn().mockResolvedValue('')

    await act(async () => {
      render(<OcrPanel runOcr={mockRunOcr} autoRun />)
    })

    await waitFor(() => {
      expect(screen.getByText(/nenhum texto/i)).toBeInTheDocument()
    })
  })
})
