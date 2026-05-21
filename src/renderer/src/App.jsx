import { useState, useEffect, useCallback, useRef } from 'react'
import { PanelLeftClose, PanelLeftOpen, User } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { useApp } from './context/AppContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import ClipboardArea from './components/ClipboardArea.jsx'
import ClipGrid from './components/ClipGrid.jsx'
import StatusBar from './components/StatusBar.jsx'
import Settings from './components/Settings.jsx'
import { CaptureTab } from './components/CaptureTab.jsx'
import About from './components/About.jsx'
import NotificationsDialog from './components/NotificationsDialog.jsx'
import AccountPanel from './components/AccountPanel.jsx'
import SaveToast from './components/SaveToast.jsx'

export default function App() {
  const { state, actions } = useApp()
  const [screen, setScreen] = useState('main')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(200)
  const [updateStatus, setUpdateStatus] = useState('idle') // 'idle' | 'checking' | 'downloading'
  const [downloadPercent, setDownloadPercent] = useState(0)
  const checkTimeoutRef = useRef(null)
  const isManualCheck = useRef(false)
  const isResizing = useRef(false)

  // Load sidebarWidth from settings once settings arrive
  useEffect(() => {
    if (state.settings?.sidebarWidth) {
      setSidebarWidth(state.settings.sidebarWidth)
    }
  }, [state.settings?.sidebarWidth])

  useEffect(() => {
    return window.electronAPI.onNavigateTo((s) => {
      if (s === 'settings') setScreen('settings')
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onUpdateDownloading(() => {
      clearTimeout(checkTimeoutRef.current)
      isManualCheck.current = false
      setUpdateStatus('downloading')
      setDownloadPercent(0)
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onUpdateDownloadProgress(({ percent }) => {
      setDownloadPercent(percent)
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onUpdateAvailable((info) => {
      clearTimeout(checkTimeoutRef.current)
      setUpdateStatus('idle')
      setDownloadPercent(0)
      toast(`Nova versão ${info.version} disponível`, {
        description: 'Reinicie o app para instalar a atualização.',
        duration: Infinity,
        action: {
          label: 'Reiniciar agora',
          onClick: () => window.electronAPI.installUpdate(),
        },
      })
      actions.addNotification({
        id: crypto.randomUUID(),
        type: 'info',
        message: `Nova versão ${info.version} disponível`,
        read: false,
        timestamp: Date.now(),
      })
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onUpdateNotAvailable(() => {
      clearTimeout(checkTimeoutRef.current)
      if (isManualCheck.current) {
        isManualCheck.current = false
        toast('Você está na versão mais recente', { duration: 3000 })
      }
      setUpdateStatus((prev) => (prev === 'checking' ? 'idle' : prev))
    })
  }, [])

  const handleCheckUpdate = () => {
    if (updateStatus !== 'idle') return
    isManualCheck.current = true
    setUpdateStatus('checking')
    window.electronAPI.checkForUpdates()
    clearTimeout(checkTimeoutRef.current)
    checkTimeoutRef.current = setTimeout(() => {
      isManualCheck.current = false
      setUpdateStatus((prev) => (prev === 'checking' ? 'idle' : prev))
    }, 15000)
  }

  useEffect(() => () => clearTimeout(checkTimeoutRef.current), [])

  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault()
    isResizing.current = true

    function onMouseMove(e) {
      if (!isResizing.current) return
      const newWidth = Math.min(400, Math.max(140, e.clientX))
      setSidebarWidth(newWidth)
    }

    function onMouseUp(e) {
      if (!isResizing.current) return
      isResizing.current = false
      const finalWidth = Math.min(400, Math.max(140, e.clientX))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      actions.updateSettings({ sidebarWidth: finalWidth })
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [actions])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground select-none overflow-hidden">
      {/* Title bar */}
      <div className="h-10 flex items-center app-region-drag shrink-0 px-2 gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="app-region-no-drag h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        </Button>
        <span className="flex-1 text-center text-xs font-medium text-muted-foreground app-region-drag">
          Claritas
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="app-region-no-drag h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          title="Conta Google"
          onClick={() => setAccountOpen(true)}
        >
          <User size={15} />
        </Button>
      </div>

      <div className="h-px bg-border shrink-0" />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          screen={screen}
          onNavigate={setScreen}
          open={sidebarOpen}
          width={sidebarWidth}
          updateStatus={updateStatus}
          downloadPercent={downloadPercent}
          onCheckUpdate={handleCheckUpdate}
          onOpenAbout={() => setAboutOpen(true)}
          onOpenNotifications={() => setNotifOpen(true)}
          unreadCount={state.notifications.filter((n) => !n.read).length}
          onOpenAccount={() => setAccountOpen(true)}
        />

        {sidebarOpen && (
          <div
            className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 transition-colors"
            onMouseDown={handleResizeMouseDown}
          />
        )}

        <div className="flex flex-col flex-1 overflow-hidden">
          {screen === 'main' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
                  <ClipboardArea />
                  <ClipGrid filter="clipboard" />
                </div>
              </div>
              <StatusBar />
            </>
          )}
          {screen === 'capture' && (
            <div className="flex flex-1 overflow-hidden">
              <CaptureTab />
            </div>
          )}
          {screen === 'settings' && <Settings onBack={() => setScreen('main')} />}
        </div>
      </div>

      <NotificationsDialog
        open={notifOpen}
        onOpenChange={setNotifOpen}
        notifications={state.notifications}
        onMarkAllRead={actions.markAllRead}
        onClear={actions.clearNotifications}
      />
      <About open={aboutOpen} onOpenChange={setAboutOpen} onCheckUpdate={handleCheckUpdate} updateStatus={updateStatus} downloadPercent={downloadPercent} />
      <AccountPanel open={accountOpen} onOpenChange={setAccountOpen} />
      <Toaster richColors position="bottom-center" />
      <SaveToast />
    </div>
  )
}
