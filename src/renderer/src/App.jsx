import { useState, useEffect } from 'react'
import { useApp } from './context/AppContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toolbar from './components/Toolbar.jsx'
import ClipboardArea from './components/ClipboardArea.jsx'
import ClipGrid from './components/ClipGrid.jsx'
import StatusBar from './components/StatusBar.jsx'
import Settings from './components/Settings.jsx'
import Toast from './components/Toast.jsx'
import InkscapeBanner from './components/InkscapeBanner.jsx'

export default function App() {
  const { state } = useApp()
  const [screen, setScreen] = useState('main') // 'main' | 'settings'

  // Listen for tray navigation
  useEffect(() => {
    return window.electronAPI.onNavigateTo((s) => {
      if (s === 'settings') setScreen('settings')
    })
  }, [])

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#1f1f1f] text-[#37352f] dark:text-[#e6e6e3] select-none overflow-hidden">
      {/* Title bar drag area — titleBarOverlay handles OS window controls */}
      <div className="h-10 flex items-center justify-center border-b border-[#e9e9e7] dark:border-[#2e2e2e] app-region-drag shrink-0">
        <span className="text-xs font-medium text-[#9b9a97] dark:text-[#5c5c5c] app-region-no-drag">
          SchematicClip
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar screen={screen} onNavigate={setScreen} />

        <div className="flex flex-col flex-1 overflow-hidden">
          {!state.settings.inkscapePath && (
            <InkscapeBanner onGoToSettings={() => setScreen('settings')} />
          )}

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

      {state.toast && <Toast message={state.toast.message} type={state.toast.type} />}
    </div>
  )
}
