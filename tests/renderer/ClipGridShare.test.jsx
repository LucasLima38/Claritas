// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

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

const mockShareFile = vi.fn().mockResolvedValue({ ok: true, webViewLink: 'https://link' })
const mockAccount = { email: 'u@t.com', name: 'U', photo: '', syncing: false, syncError: null }

vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: vi.fn(),
}))

import { useApp } from '../../src/renderer/src/context/AppContext'
import ClipGrid from '../../src/renderer/src/components/ClipGrid'

const baseHistory = [{ id: '1', filename: 'f.svg', fullPath: 'C:\\f.svg', projectId: 'p1', thumbPath: null, timestamp: new Date().toISOString(), sizeBytes: 1024 }]
const baseProjects = [{ id: 'p1', name: 'P1', color: '#f00', prefix: 'SCH', counter: 0 }]

describe('ClipGrid share feature', () => {
  it('does not show Compartilhar item when not logged in', () => {
    useApp.mockReturnValue({
      state: { account: null, history: baseHistory, projects: baseProjects, activeProjectId: 'p1', previewQueue: [], status: 'idle' },
      actions: { shareFile: mockShareFile, deleteHistoryEntry: vi.fn(), syncHistory: vi.fn() },
    })
    render(<ClipGrid />)
    expect(screen.queryByText('clipgrid.share')).not.toBeInTheDocument()
  })

  it('shows Compartilhar item when logged in', () => {
    useApp.mockReturnValue({
      state: { account: mockAccount, history: baseHistory, projects: baseProjects, activeProjectId: 'p1', previewQueue: [], status: 'idle' },
      actions: { shareFile: mockShareFile, deleteHistoryEntry: vi.fn(), syncHistory: vi.fn() },
    })
    render(<ClipGrid />)
    expect(screen.getByText('clipgrid.share')).toBeInTheDocument()
  })

  it('opens share dialog when Compartilhar is clicked', () => {
    useApp.mockReturnValue({
      state: { account: mockAccount, history: baseHistory, projects: baseProjects, activeProjectId: 'p1', previewQueue: [], status: 'idle' },
      actions: { shareFile: mockShareFile, deleteHistoryEntry: vi.fn(), syncHistory: vi.fn() },
    })
    render(<ClipGrid />)
    fireEvent.click(screen.getByText('clipgrid.share'))
    expect(screen.getByTestId('share-dialog')).toBeInTheDocument()
  })

  it('submit button is disabled when email is empty', () => {
    useApp.mockReturnValue({
      state: { account: mockAccount, history: baseHistory, projects: baseProjects, activeProjectId: 'p1', previewQueue: [], status: 'idle' },
      actions: { shareFile: mockShareFile, deleteHistoryEntry: vi.fn(), syncHistory: vi.fn() },
    })
    render(<ClipGrid />)
    fireEvent.click(screen.getByText('clipgrid.share'))
    const buttons = screen.getAllByRole('button')
    const submitBtn = buttons.find(b => b.textContent === 'clipgrid.share' && b.closest('[data-testid="share-dialog"]'))
    expect(submitBtn).toBeDisabled()
  })

  it('calls shareFile with correct args on submit', async () => {
    useApp.mockReturnValue({
      state: { account: mockAccount, history: baseHistory, projects: baseProjects, activeProjectId: 'p1', previewQueue: [], status: 'idle' },
      actions: { shareFile: mockShareFile, deleteHistoryEntry: vi.fn(), syncHistory: vi.fn() },
    })
    render(<ClipGrid />)
    fireEvent.click(screen.getByText('clipgrid.share'))
    fireEvent.change(screen.getByPlaceholderText('clipgrid.recipientEmail'), { target: { value: 'test@example.com' } })
    const dialog = screen.getByTestId('share-dialog')
    const buttons = dialog.querySelectorAll('button')
    const submitBtn = Array.from(buttons).find(b => b.textContent === 'clipgrid.share')
    fireEvent.click(submitBtn)
    expect(mockShareFile).toHaveBeenCalledWith({ fullPath: 'C:\\f.svg', email: 'test@example.com' })
  })
})
