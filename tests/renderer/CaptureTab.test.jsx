// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as AppContext from '../../src/renderer/src/context/AppContext'

vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: vi.fn(),
}))

vi.mock('../../src/renderer/src/components/CaptureControls', () => ({
  CaptureControls: ({ onCapture, disabled }) => (
    <div data-testid="capture-controls" data-disabled={disabled}>
      <button onClick={() => onCapture({ mode: 'fullscreen', delay: 0 })}>Capturar</button>
    </div>
  ),
}))

vi.mock('../../src/renderer/src/components/ImageEditor', () => ({
  ImageEditor: () => <div data-testid="image-editor" />,
}))

vi.mock('lucide-react', () => ({
  Loader2: ({ size, className }) => <div data-testid="loader" data-size={size} className={className} />,
}))

import { CaptureTab } from '../../src/renderer/src/components/CaptureTab'

const mockActions = {
  startCapture: vi.fn(),
  cancelCapture: vi.fn(),
}

function setup(captureStatus) {
  vi.mocked(AppContext.useApp).mockReturnValue({
    state: { captureStatus },
    actions: mockActions,
  })
}

describe('CaptureTab', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders CaptureControls when capture-idle', () => {
    setup('capture-idle')
    render(<CaptureTab />)
    expect(screen.getByTestId('capture-controls')).toBeDefined()
  })

  it('passes disabled=false to CaptureControls when capture-idle', () => {
    setup('capture-idle')
    render(<CaptureTab />)
    expect(screen.getByTestId('capture-controls').dataset.disabled).toBe('false')
  })

  it('renders countdown UI when capture-countdown', () => {
    setup('capture-countdown')
    render(<CaptureTab />)
    expect(screen.getByTestId('loader')).toBeDefined()
    expect(screen.getByText('Capturando…')).toBeDefined()
    expect(screen.getByText('Cancelar')).toBeDefined()
  })

  it('calls cancelCapture when Cancelar is clicked', () => {
    setup('capture-countdown')
    render(<CaptureTab />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(mockActions.cancelCapture).toHaveBeenCalledOnce()
  })

  it('renders ImageEditor when capture-editor', () => {
    setup('capture-editor')
    render(<CaptureTab />)
    expect(screen.getByTestId('image-editor')).toBeDefined()
  })

  it('calls startCapture when CaptureControls triggers onCapture', () => {
    setup('capture-idle')
    render(<CaptureTab />)
    fireEvent.click(screen.getByText('Capturar'))
    expect(mockActions.startCapture).toHaveBeenCalledWith({ mode: 'fullscreen', delay: 0 })
  })
})
