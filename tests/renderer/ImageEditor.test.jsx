// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { forwardRef } from 'react'
import { ImageEditor } from '../../src/renderer/src/components/ImageEditor'
import * as AppContext from '../../src/renderer/src/context/AppContext'

// Mock EditorToolbar — depends on shadcn components not yet scaffolded (toggle-group, slider, popover)
vi.mock('../../src/renderer/src/components/EditorToolbar', () => ({
  EditorToolbar: ({ canUndo, canRedo, onUndo, onRedo, onToggleOcr, ocrOpen }) => (
    <div data-testid="editor-toolbar">
      <button title="Desfazer (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>Undo</button>
      <button title="Refazer (Ctrl+Y)" onClick={onRedo} disabled={!canRedo}>Redo</button>
      <button aria-label="OCR" onClick={onToggleOcr}>OCR</button>
    </div>
  ),
}))

// Mock react-konva — canvas can't render in jsdom
vi.mock('react-konva', () => ({
  Stage: forwardRef(({ children, onMouseDown, onMouseMove, onMouseUp }, ref) => {
    // Expose a minimal Konva-like API so handleSave can call toDataURL
    if (ref) {
      const fakeStage = {
        toDataURL: () => 'data:image/png;base64,fake',
        scaleX: () => 1,
      }
      if (typeof ref === 'function') ref(fakeStage)
      else ref.current = fakeStage
    }
    return (
      <div
        data-testid="konva-stage"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {children}
      </div>
    )
  }),
  Layer: ({ children }) => <div data-testid="konva-layer">{children}</div>,
  Image: (props) => <div data-testid="konva-image" />,
  Arrow: (props) => <div data-testid="konva-arrow" />,
  Rect: (props) => <div data-testid="konva-rect" />,
  Ellipse: (props) => <div data-testid="konva-ellipse" />,
  Line: (props) => <div data-testid="konva-line" />,
  Text: (props) => <div data-testid="konva-text" />,
  Circle: (props) => <div data-testid="konva-circle" />,
  Group: ({ children }) => <div data-testid="konva-group">{children}</div>,
  Transformer: () => null,
}))

// Mock use-image
vi.mock('use-image', () => ({
  default: vi.fn(() => [null, 'loading']),
}))

// Mock tesseract.js
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: vi.fn(),
    terminate: vi.fn(),
  }),
}))

// Mock useApp context
vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: vi.fn(() => ({
    state: {
      captureData: { dataURL: 'data:image/png;base64,abc=', width: 800, height: 600 },
      captureFormat: 'png',
      projects: [{ id: '1', name: 'Test', prefix: 'TEST_', counter: 0 }],
      activeProjectId: '1',
    },
    actions: {
      discardCapture: vi.fn(),
      saveCapture: vi.fn(),
      setCaptureFormat: vi.fn(),
    },
  })),
}))

describe('ImageEditor', () => {
  it('renders the konva stage', () => {
    render(<ImageEditor />)
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument()
  })

  it('renders undo and redo buttons', () => {
    render(<ImageEditor />)
    expect(screen.getByTitle(/desfazer/i)).toBeInTheDocument()
    expect(screen.getByTitle(/refazer/i)).toBeInTheDocument()
  })

  it('undo button is disabled when no annotations', () => {
    render(<ImageEditor />)
    const undoBtn = screen.getByTitle(/desfazer/i)
    expect(undoBtn).toBeDisabled()
  })

  it('renders action bar with Descartar and Salvar buttons', () => {
    render(<ImageEditor />)
    expect(screen.getByText(/descartar/i)).toBeInTheDocument()
    expect(screen.getByText(/salvar/i)).toBeInTheDocument()
  })

  it('calls discardCapture when Descartar is clicked', () => {
    const mockDiscard = vi.fn()
    vi.mocked(AppContext.useApp).mockReturnValue({
      state: {
        captureData: { dataURL: 'data:image/png;base64,abc=', width: 800, height: 600 },
        captureFormat: 'png',
        projects: [],
        activeProjectId: null,
      },
      actions: {
        discardCapture: mockDiscard,
        saveCapture: vi.fn(),
        setCaptureFormat: vi.fn(),
      },
    })

    render(<ImageEditor />)
    fireEvent.click(screen.getByText(/descartar/i))
    expect(mockDiscard).toHaveBeenCalledTimes(1)
  })

  it('toggles OCR panel when OCR tool button is clicked', () => {
    render(<ImageEditor />)
    // OCR panel should not be visible initially
    expect(screen.queryByText(/texto extraído/i)).not.toBeInTheDocument()
    // Click the OCR toolbar button
    const ocrBtn = screen.getByRole('button', { name: /ocr/i })
    fireEvent.click(ocrBtn)
    expect(screen.getByText(/texto extraído/i)).toBeInTheDocument()
  })

  describe('Resolution picker', () => {
    it('renders three resolution pill buttons: Baixa, Normal, Alta', () => {
      render(<ImageEditor />)
      expect(screen.getByRole('button', { name: 'Baixa' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Normal' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Alta' })).toBeInTheDocument()
    })

    it('"Normal" is selected by default (aria-pressed="true")', () => {
      render(<ImageEditor />)
      expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Baixa' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Alta' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('clicking "Baixa" selects it and deselects "Normal"', () => {
      render(<ImageEditor />)
      fireEvent.click(screen.getByRole('button', { name: 'Baixa' }))
      expect(screen.getByRole('button', { name: 'Baixa' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('clicking "Alta" selects it and deselects "Normal"', () => {
      render(<ImageEditor />)
      fireEvent.click(screen.getByRole('button', { name: 'Alta' }))
      expect(screen.getByRole('button', { name: 'Alta' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('saveCapture is called with resolution: "normal" by default', () => {
      const mockSave = vi.fn()
      vi.mocked(AppContext.useApp).mockReturnValue({
        state: {
          captureData: { dataURL: 'data:image/png;base64,abc=', width: 800, height: 600 },
          captureFormat: 'png',
          projects: [],
          activeProjectId: null,
        },
        actions: {
          discardCapture: vi.fn(),
          saveCapture: mockSave,
          setCaptureFormat: vi.fn(),
        },
      })
      render(<ImageEditor />)
      fireEvent.click(screen.getByText(/salvar/i))
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: 'normal' })
      )
    })

    it('saveCapture is called with resolution: "low" after clicking Baixa', () => {
      const mockSave = vi.fn()
      vi.mocked(AppContext.useApp).mockReturnValue({
        state: {
          captureData: { dataURL: 'data:image/png;base64,abc=', width: 800, height: 600 },
          captureFormat: 'png',
          projects: [],
          activeProjectId: null,
        },
        actions: {
          discardCapture: vi.fn(),
          saveCapture: mockSave,
          setCaptureFormat: vi.fn(),
        },
      })
      render(<ImageEditor />)
      fireEvent.click(screen.getByRole('button', { name: 'Baixa' }))
      fireEvent.click(screen.getByText(/salvar/i))
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: 'low' })
      )
    })

    it('saveCapture is called with resolution: "high" after clicking Alta', () => {
      const mockSave = vi.fn()
      vi.mocked(AppContext.useApp).mockReturnValue({
        state: {
          captureData: { dataURL: 'data:image/png;base64,abc=', width: 800, height: 600 },
          captureFormat: 'png',
          projects: [],
          activeProjectId: null,
        },
        actions: {
          discardCapture: vi.fn(),
          saveCapture: mockSave,
          setCaptureFormat: vi.fn(),
        },
      })
      render(<ImageEditor />)
      fireEvent.click(screen.getByRole('button', { name: 'Alta' }))
      fireEvent.click(screen.getByText(/salvar/i))
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: 'high' })
      )
    })
  })
})
