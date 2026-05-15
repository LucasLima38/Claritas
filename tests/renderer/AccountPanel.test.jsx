// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => ({
  User: () => <span data-testid="icon-user" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  LogOut: () => <span data-testid="icon-logout" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}))

const mockActions = {
  googleLogin: vi.fn().mockResolvedValue({ ok: true }),
  googleLogout: vi.fn(),
  syncProjects: vi.fn(),
}

vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: vi.fn(),
}))

import { useApp } from '../../src/renderer/src/context/AppContext'
import AccountPanel from '../../src/renderer/src/components/AccountPanel'

describe('AccountPanel – logged out', () => {
  beforeEach(() => {
    useApp.mockReturnValue({
      state: { account: null },
      actions: mockActions,
    })
    vi.clearAllMocks()
    mockActions.googleLogin.mockResolvedValue({ ok: true })
  })

  it('shows login button when account is null', () => {
    render(<AccountPanel open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/Entrar com Google/i)).toBeInTheDocument()
  })

  it('calls googleLogin when button is clicked', async () => {
    const onOpenChange = vi.fn()
    render(<AccountPanel open={true} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByText(/Entrar com Google/i))
    expect(mockActions.googleLogin).toHaveBeenCalled()
  })
})

describe('AccountPanel – logged in', () => {
  beforeEach(() => {
    useApp.mockReturnValue({
      state: {
        account: { email: 'user@test.com', name: 'Test User', photo: '', syncing: false, syncError: null },
      },
      actions: mockActions,
    })
  })

  it('shows user email when logged in', () => {
    render(<AccountPanel open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('user@test.com')).toBeInTheDocument()
  })

  it('shows sync button when logged in', () => {
    render(<AccountPanel open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/Sincronizar/i)).toBeInTheDocument()
  })

  it('shows logout button when logged in', () => {
    render(<AccountPanel open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/Sair/i)).toBeInTheDocument()
  })

  it('calls syncProjects on sync button click', () => {
    render(<AccountPanel open={true} onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByText(/Sincronizar agora/i))
    expect(mockActions.syncProjects).toHaveBeenCalled()
  })

  it('calls googleLogout on sair button click', () => {
    render(<AccountPanel open={true} onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByText(/Sair/i))
    expect(mockActions.googleLogout).toHaveBeenCalled()
  })
})
