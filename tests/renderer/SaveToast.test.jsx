// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import SaveToast from '../../src/renderer/src/components/SaveToast'

// Mock AppContext
const mockDispatch = vi.fn()
let mockToast = null

vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: () => ({ state: { saveToast: mockToast }, dispatch: mockDispatch }),
}))

describe('SaveToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockDispatch.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    mockToast = null
  })

  it('renders nothing when saveToast is null', () => {
    mockToast = null
    const { container } = render(<SaveToast />)
    expect(container.firstChild).toBeNull()
  })

  it('shows spinner and message in saving state', () => {
    mockToast = { message: 'Salvando…', type: 'saving' }
    render(<SaveToast />)
    expect(screen.getByText('Salvando…')).toBeInTheDocument()
    // spinner svg should be present
    expect(document.querySelector('svg.animate-spin')).toBeInTheDocument()
  })

  it('shows subMessage when provided in saving state', () => {
    mockToast = { message: 'Salvando…', subMessage: 'Enviando para o Drive', type: 'saving' }
    render(<SaveToast />)
    expect(screen.getByText('Enviando para o Drive')).toBeInTheDocument()
  })

  it('shows checkmark and message in success state', () => {
    mockToast = { message: 'Salvo!', type: 'success' }
    render(<SaveToast />)
    expect(screen.getByText('Salvo!')).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('auto-dismisses success after 2000ms', () => {
    mockToast = { message: 'Salvo!', type: 'success' }
    render(<SaveToast />)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'HIDE_SAVE_TOAST' })
  })

  it('auto-dismisses error after 4000ms', () => {
    mockToast = { message: 'Erro!', type: 'error' }
    render(<SaveToast />)
    act(() => { vi.advanceTimersByTime(4000) })
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'HIDE_SAVE_TOAST' })
  })

  it('does not auto-dismiss saving state', () => {
    mockToast = { message: 'Salvando…', type: 'saving' }
    render(<SaveToast />)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
