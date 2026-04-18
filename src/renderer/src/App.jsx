import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { useApp } from './context/AppContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toolbar from './components/Toolbar.jsx'
import ClipboardArea from './components/ClipboardArea.jsx'
import ClipGrid from './components/ClipGrid.jsx'
import StatusBar from './components/StatusBar.jsx'
import Settings from './components/Settings.jsx'

export default function App() {
  useApp()
  const [screen, setScreen] = useState('main')

  useEffect(() => {
    return window.electronAPI.onNavigateTo((s) => {
      if (s === 'settings') setScreen('settings')
    })
  }, [])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground select-none overflow-hidden">
      {/* Title bar */}
      <div className="h-10 flex items-center justify-center border-b border-border app-region-drag shrink-0">
        <span className="text-xs font-medium text-muted-foreground app-region-no-drag">
          SchematicClip
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar screen={screen} onNavigate={setScreen} />

        <div className="flex flex-col flex-1 overflow-hidden">
          {screen === 'main' ? (
            <>
              <Toolbar />
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <ClipboardArea />
                <ClipGrid />
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
