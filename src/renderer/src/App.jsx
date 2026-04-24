import { useState, useEffect } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { useApp } from './context/AppContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import ClipboardArea from './components/ClipboardArea.jsx'
import ClipGrid from './components/ClipGrid.jsx'
import StatusBar from './components/StatusBar.jsx'
import Settings from './components/Settings.jsx'

export default function App() {
  useApp()
  const [screen, setScreen] = useState('main')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    return window.electronAPI.onNavigateTo((s) => {
      if (s === 'settings') setScreen('settings')
    })
  }, [])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground select-none overflow-hidden">
      {/* Title bar */}
      <div className="h-10 flex items-center border-b border-border app-region-drag shrink-0 px-2 gap-2">
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
        {/* spacer to keep title centered */}
        <div className="h-7 w-7 shrink-0" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar screen={screen} onNavigate={setScreen} open={sidebarOpen} />

        <div className="flex flex-col flex-1 overflow-hidden">
          {screen === 'main' ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
                  <ClipboardArea />
                  <ClipGrid />
                </div>
              </div>
              <StatusBar />
            </>
          ) : (
            <Settings onBack={() => setScreen('main')} />
          )}
        </div>
      </div>

      <Toaster richColors position="bottom-center" />
    </div>
  )
}
