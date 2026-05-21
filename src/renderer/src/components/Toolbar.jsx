import { Clipboard, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '../context/AppContext.jsx'

export default function Toolbar() {
  const { state, actions } = useApp()
  const isConverting = state.status === 'converting'
  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)

  async function chooseDir() {
    if (!activeProject) return
    const result = await window.electronAPI.chooseDirectory()
    if (!result.canceled) {
      await actions.updateProject(activeProject.id, { outputDir: result.path })
    }
  }

  return (
    <div className="h-10 shrink-0 border-b border-border flex items-center px-3.5 gap-2">
      <Button
        size="sm"
        onClick={actions.paste}
        disabled={isConverting || state.projects.length === 0}
        className="app-region-no-drag h-7 text-xs"
      >
        <Clipboard size={13} className="mr-1.5" />
        {isConverting ? 'Convertendo...' : 'Colar'}
        {!isConverting && (
          <span className="ml-1.5 opacity-70 text-[10px] border border-white/30 rounded px-1">Ctrl+V</span>
        )}
      </Button>
      <div className="w-px h-5 bg-border" />
      <Button
        size="sm"
        variant="outline"
        onClick={chooseDir}
        disabled={!activeProject}
        className="app-region-no-drag h-7 text-xs"
      >
        <FolderOpen size={13} className="mr-1.5" />
        Pasta
      </Button>
    </div>
  )
}
