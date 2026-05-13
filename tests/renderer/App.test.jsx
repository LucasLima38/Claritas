// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// Mock all heavy child components
vi.mock('../../src/renderer/src/components/Sidebar', () => ({
  default: ({ updateStatus, onCheckUpdate }) => (
    <button
      title="Verificar atualizações"
      onClick={onCheckUpdate}
      disabled={updateStatus === 'checking'}
    >
      {updateStatus === 'checking'
        ? <span data-testid="icon-loader" className="animate-spin" />
        : <span data-testid="icon-download" />
      }
    </button>
  ),
}))
vi.mock('../../src/renderer/src/components/ClipboardArea', () => ({ default: () => null }))
vi.mock('../../src/renderer/src/components/ClipGrid', () => ({ default: () => null }))
vi.mock('../../src/renderer/src/components/StatusBar', () => ({ default: () => null }))
vi.mock('../../src/renderer/src/components/Settings', () => ({ default: () => null }))
vi.mock('../../src/renderer/src/components/CaptureTab', () => ({ CaptureTab: () => null }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('sonner', () => ({ toast: vi.fn() }))
vi.mock('lucide-react', () => ({
  PanelLeftClose: () => <span>PanelLeftClose</span>,
  PanelLeftOpen:  () => <span>PanelLeftOpen</span>,
}))

vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: () => ({
    state: { settings: {} },
    actions: { updateSettings: vi.fn() },
  }),
}))

let notAvailableCb = null
let updateAvailableCb = null
let navigateCb = null

beforeEach(() => {
  notAvailableCb = null
  updateAvailableCb = null
  navigateCb = null

  globalThis.window.electronAPI = {
    getInitData: vi.fn().mockResolvedValue({}),
    checkForUpdates: vi.fn(),
    onUpdateNotAvailable: vi.fn((cb) => { notAvailableCb = cb; return () => {} }),
    onUpdateAvailable:    vi.fn((cb) => { updateAvailableCb = cb; return () => {} }),
    onNavigateTo:         vi.fn((cb) => { navigateCb = cb; return () => {} }),
    onShellStatus:        vi.fn(() => () => {}),
    onProjectsUpdated:    vi.fn(() => () => {}),
    onThemeChanged:       vi.fn(() => () => {}),
    installUpdate:        vi.fn(),
  }
})

import App from '../../src/renderer/src/App'

describe('Update check button', () => {
  it('renders the download button in idle state', () => {
    render(<App />)
    expect(screen.getByTitle(/verificar atualizações/i)).toBeInTheDocument()
    expect(screen.getByTestId('icon-download')).toBeInTheDocument()
  })

  it('enters checking state on click', async () => {
    render(<App />)
    fireEvent.click(screen.getByTitle(/verificar atualizações/i))
    expect(window.electronAPI.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('icon-loader').className).toMatch(/animate-spin/)
  })

  it('resets to idle when update-available fires while checking', async () => {
    render(<App />)
    fireEvent.click(screen.getByTitle(/verificar atualizações/i))
    expect(screen.getByTestId('icon-loader').className).toMatch(/animate-spin/)

    await act(async () => { updateAvailableCb({ version: '9.9.9', releaseDate: null }) })
    expect(screen.getByTestId('icon-download')).toBeInTheDocument()
  })

  it('returns to download icon immediately after update-not-available', async () => {
    render(<App />)
    fireEvent.click(screen.getByTitle(/verificar atualizações/i))
    expect(screen.getByTestId('icon-loader').className).toMatch(/animate-spin/)

    await act(async () => { notAvailableCb() })
    expect(screen.getByTestId('icon-download')).toBeInTheDocument()
  })
})
