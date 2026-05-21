// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, onOpenChange, children }) =>
    open ? <div data-testid="dialog" onClick={() => onOpenChange(false)}>{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}))

import NotificationsDialog from '../../src/renderer/src/components/NotificationsDialog'

const makeNotif = (overrides = {}) => ({
  id: crypto.randomUUID(),
  type: 'info',
  message: 'Test notification',
  read: false,
  timestamp: Date.now(),
  ...overrides,
})

describe('NotificationsDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <NotificationsDialog
        open={false}
        onOpenChange={vi.fn()}
        notifications={[makeNotif()]}
        onMarkAllRead={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when open', () => {
    render(
      <NotificationsDialog
        open={true}
        onOpenChange={vi.fn()}
        notifications={[]}
        onMarkAllRead={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByTestId('dialog')).toBeInTheDocument()
    expect(screen.getByText('Notificações')).toBeInTheDocument()
  })

  it('shows notification message in Todos tab', () => {
    render(
      <NotificationsDialog
        open={true}
        onOpenChange={vi.fn()}
        notifications={[makeNotif({ message: 'Erro de conversão: XYZ' })]}
        onMarkAllRead={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText('Erro de conversão: XYZ')).toBeInTheDocument()
  })

  it('Não lidos tab shows only unread notifications', () => {
    const notifications = [
      makeNotif({ message: 'Unread one', read: false }),
      makeNotif({ message: 'Already read', read: true }),
    ]
    render(
      <NotificationsDialog
        open={true}
        onOpenChange={vi.fn()}
        notifications={notifications}
        onMarkAllRead={vi.fn()}
        onClear={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Não lidos'))
    expect(screen.getByText('Unread one')).toBeInTheDocument()
    expect(screen.queryByText('Already read')).not.toBeInTheDocument()
  })

  it('calls onMarkAllRead when dialog closes', () => {
    const onMarkAllRead = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <NotificationsDialog
        open={true}
        onOpenChange={onOpenChange}
        notifications={[makeNotif()]}
        onMarkAllRead={onMarkAllRead}
        onClear={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('dialog'))
    expect(onMarkAllRead).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onClear when Limpar button is clicked', () => {
    const onClear = vi.fn()
    render(
      <NotificationsDialog
        open={true}
        onOpenChange={vi.fn()}
        notifications={[makeNotif()]}
        onMarkAllRead={vi.fn()}
        onClear={onClear}
      />
    )
    fireEvent.click(screen.getByText('Limpar'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('shows empty state when no notifications', () => {
    render(
      <NotificationsDialog
        open={true}
        onOpenChange={vi.fn()}
        notifications={[]}
        onMarkAllRead={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText('Nenhuma notificação.')).toBeInTheDocument()
  })

  it('Limpar button is disabled when notifications is empty', () => {
    render(
      <NotificationsDialog
        open={true}
        onOpenChange={vi.fn()}
        notifications={[]}
        onMarkAllRead={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText('Limpar').closest('button')).toBeDisabled()
  })
})
