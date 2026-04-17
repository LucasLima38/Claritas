import { useApp } from '../context/AppContext.jsx'

export default function StatusBar() {
  const { state } = useApp()
  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)

  const isConverting = state.status === 'converting'
  const isPreview = state.status === 'preview' || state.status === 'saving'

  const nextName = activeProject
    ? `${activeProject.prefix}${String(activeProject.counter + 1).padStart(3, '0')}.svg`
    : null

  return (
    <div className="h-6 shrink-0 border-t border-[#e9e9e7] dark:border-[#2e2e2e] bg-[#fbfbfa] dark:bg-[#191919] flex items-center px-3.5 gap-3 text-[10px] text-[#9b9a97] dark:text-[#4c4c4c]">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${isConverting ? 'bg-amber-400 animate-pulse' : isPreview ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`}
        />
        <span>
          {isConverting ? 'Convertendo...' : isPreview ? 'Aguardando confirmação' : 'Monitorando'}
        </span>
      </div>

      <span>·</span>
      <span>{state.history.length} SVGs nesta sessão</span>

      {nextName && (
        <>
          <span>·</span>
          <span>Próximo: <span className="font-medium text-[#37352f] dark:text-[#c7c7c3]">{nextName}</span></span>
        </>
      )}

      {activeProject?.outputDir && (
        <>
          <span>·</span>
          <span className="truncate max-w-[200px]">
            📁 <span className="font-medium text-[#37352f] dark:text-[#c7c7c3]">{activeProject.outputDir}</span>
          </span>
        </>
      )}
    </div>
  )
}
