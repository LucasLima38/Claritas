import { Clipboard, FolderOpen, Save, X } from 'lucide-react'
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
    <div className="h-10 shrink-0 border-b border-[#e9e9e7] dark:border-[#2e2e2e] flex items-center px-3.5 gap-2">
      {isPreview ? (
        <>
          <button
            onClick={actions.save}
            disabled={isSaving}
            className="app-region-no-drag h-7 px-3 rounded-md bg-[#2da44e] hover:bg-[#2c974b] text-white text-[11.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={13} />
            {isSaving ? 'Salvando...' : `Salvar ${activeProject ? generateNextName(activeProject) : ''}`}
          </button>
          <button
            onClick={actions.discard}
            disabled={isSaving}
            className="app-region-no-drag h-7 px-3 rounded-md border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[11.5px] font-medium text-[#6b6a68] dark:text-[#9b9a97] hover:bg-[#f7f7f5] dark:hover:bg-[#333] flex items-center gap-1.5 disabled:opacity-50"
          >
            <X size={13} />
            Descartar
          </button>
        </>
      ) : (
        <>
          <button
            onClick={actions.paste}
            disabled={isConverting || state.projects.length === 0}
            className="app-region-no-drag h-7 px-3 rounded-md bg-[#2f81f7] hover:bg-[#2673e0] text-white text-[11.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Clipboard size={13} />
            {isConverting ? 'Convertendo...' : 'Colar'}
            {!isConverting && (
              <span className="opacity-70 text-[10px] font-normal border border-white/30 rounded px-1">Ctrl+V</span>
            )}
          </button>
          <div className="w-px h-5 bg-[#e9e9e7] dark:bg-[#2e2e2e]" />
          <button
            onClick={chooseDir}
            disabled={!activeProject}
            className="app-region-no-drag h-7 px-2.5 rounded-md border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[11.5px] font-medium text-[#37352f] dark:text-[#c7c7c3] hover:bg-[#f7f7f5] dark:hover:bg-[#333] flex items-center gap-1.5 disabled:opacity-50"
          >
            <FolderOpen size={13} />
            Pasta
          </button>
        </>
      )}

      <div className="ml-auto flex items-center gap-1 text-[11px] text-[#9b9a97] dark:text-[#4c4c4c] truncate max-w-[260px]">
        {activeProject ? (
          <>
            <FolderOpen size={11} />
            <span className="font-medium text-[#37352f] dark:text-[#c7c7c3] truncate">
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
