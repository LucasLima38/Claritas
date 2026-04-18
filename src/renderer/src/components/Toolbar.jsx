import { Clipboard, FolderOpen, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '../context/AppContext.jsx'

function generateNextName(project) {
  return `${project.prefix}${String(project.counter + 1).padStart(3, '0')}.svg`
}

export default function Toolbar() {
  const { state, actions } = useApp()
  const isPreview = state.status === 'preview' || state.status === 'saving'
  const isSaving = state.status === 'saving'
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
      {isPreview ? (
        <>
          <Button
            size="sm"
            onClick={actions.save}
            disabled={isSaving}
            className="app-region-no-drag h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            <Save size={13} className="mr-1.5" />
            {isSaving ? 'Salvando...' : `Salvar ${activeProject ? generateNextName(activeProject) : ''}`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={actions.discard}
            disabled={isSaving}
            className="app-region-no-drag h-7 text-xs"
          >
            <X size={13} className="mr-1.5" />
            Descartar
          </Button>
        </>
      ) : (
        <>
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
        </>
      )}

      <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[260px]">
        {activeProject ? (
          <>
            <FolderOpen size={11} />
            <span className="font-medium text-foreground truncate">
              {activeProject.outputDir || 'Sem pasta configurada'}
            </span>
          </>
        ) : (
          <span className="italic">Nenhum projeto ativo</span>
        )}
      </div>
    </div>
  )
}
