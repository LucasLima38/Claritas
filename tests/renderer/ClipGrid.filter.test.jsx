// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('lucide-react', () => ({
  Share2: () => <span data-testid="icon-share2" />,
  Clipboard: () => <span />,
  FolderOpen: () => <span />,
  Trash2: () => <span />,
  FileImage: () => <span />,
  FileText: () => <span />,
  RefreshCw: () => <span />,
  ExternalLink: () => <span />,
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }) => <div>{children}</div>,
  ContextMenuContent: ({ children }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
  ContextMenuSeparator: () => <hr />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => open ? <div data-testid="share-dialog">{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogFooter: ({ children }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('../../src/renderer/src/components/LightboxModal', () => ({
  default: () => null,
}))

vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: vi.fn(),
}))

import { useApp } from '../../src/renderer/src/context/AppContext'
import ClipGrid from '../../src/renderer/src/components/ClipGrid'

const makeEntry = (id, filename, sizeBytes = 1024) => ({
  id,
  filename,
  fullPath: `C:\\files\\${filename}`,
  projectId: 'p1',
  thumbPath: null,
  timestamp: new Date().toISOString(),
  sizeBytes,
})

const captureEntries = [
  makeEntry('img1', 'capture-001.png'),
  makeEntry('img2', 'capture-002.jpg'),
  makeEntry('img3', 'capture-003.webp'),
]

const clipboardEntries = [
  makeEntry('clip1', 'project-001.svg'),
  makeEntry('clip2', 'project-002.pdf'),
]

const mixedHistory = [...captureEntries, ...clipboardEntries]

const baseProjects = [{ id: 'p1', name: 'P1', color: '#f00', prefix: 'SCH', counter: 0 }]

function makeUseApp(history, opts = {}) {
  return {
    state: {
      account: null,
      history,
      projects: opts.projects ?? baseProjects,
      activeProjectId: opts.activeProjectId ?? 'p1',
      previewQueue: [],
      status: 'idle',
    },
    actions: {
      shareFile: vi.fn(),
      deleteHistoryEntry: vi.fn(),
      syncHistory: vi.fn(),
    },
  }
}

describe('ClipGrid filter prop', () => {
  it('filter="capture" shows only image entries (.png, .jpg, .webp)', () => {
    useApp.mockReturnValue(makeUseApp(mixedHistory))
    render(<ClipGrid filter="capture" />)
    expect(screen.getByText('capture-001.png')).toBeInTheDocument()
    expect(screen.getByText('capture-002.jpg')).toBeInTheDocument()
    expect(screen.getByText('capture-003.webp')).toBeInTheDocument()
    expect(screen.queryByText('project-001.svg')).not.toBeInTheDocument()
    expect(screen.queryByText('project-002.pdf')).not.toBeInTheDocument()
  })

  it('filter="clipboard" shows only SVG/PDF entries', () => {
    useApp.mockReturnValue(makeUseApp(mixedHistory))
    render(<ClipGrid filter="clipboard" />)
    expect(screen.getByText('project-001.svg')).toBeInTheDocument()
    expect(screen.getByText('project-002.pdf')).toBeInTheDocument()
    expect(screen.queryByText('capture-001.png')).not.toBeInTheDocument()
    expect(screen.queryByText('capture-002.jpg')).not.toBeInTheDocument()
    expect(screen.queryByText('capture-003.webp')).not.toBeInTheDocument()
  })

  it('filter="capture" hides the "próximo arquivo previsto" placeholder card', () => {
    useApp.mockReturnValue(makeUseApp(captureEntries))
    render(<ClipGrid filter="capture" />)
    expect(screen.queryByText('próximo')).not.toBeInTheDocument()
  })

  it('filter="clipboard" hides the "próximo arquivo previsto" placeholder card', () => {
    useApp.mockReturnValue(makeUseApp(clipboardEntries))
    render(<ClipGrid filter="clipboard" />)
    expect(screen.queryByText('próximo')).not.toBeInTheDocument()
  })

  it('without filter, shows all entries (existing behavior preserved)', () => {
    useApp.mockReturnValue(makeUseApp(mixedHistory))
    render(<ClipGrid />)
    expect(screen.getByText('capture-001.png')).toBeInTheDocument()
    expect(screen.getByText('capture-002.jpg')).toBeInTheDocument()
    expect(screen.getByText('capture-003.webp')).toBeInTheDocument()
    expect(screen.getByText('project-001.svg')).toBeInTheDocument()
    expect(screen.getByText('project-002.pdf')).toBeInTheDocument()
  })

  it('filter="capture" returns null when there are no capture entries even if clipboard entries exist', () => {
    useApp.mockReturnValue(makeUseApp(clipboardEntries))
    const { container } = render(<ClipGrid filter="capture" />)
    expect(container.firstChild).toBeNull()
  })

  it('without filter still shows placeholder card when nextName is set and entries exist', () => {
    useApp.mockReturnValue(makeUseApp(clipboardEntries))
    render(<ClipGrid />)
    // nextName is derived from activeProject counter+1 with prefix "SCH" → "SCH001.svg"
    expect(screen.getByText('próximo')).toBeInTheDocument()
    expect(screen.getByText('SCH001.svg')).toBeInTheDocument()
  })
})
