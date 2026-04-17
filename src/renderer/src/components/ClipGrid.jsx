import { CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ClipGrid() {
  const { state } = useApp()
  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
  const nextName = activeProject
    ? `${activeProject.prefix}${String(activeProject.counter + 1).padStart(3, '0')}.svg`
    : null

  if (state.history.length === 0 && !nextName) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#9b9a97] dark:text-[#4c4c4c]">
          Recentes
        </p>
        {state.history.length > 0 && (
          <p className="text-[10.5px] text-[#9b9a97] dark:text-[#4c4c4c]">
            {state.history.length} arquivo{state.history.length !== 1 ? 's' : ''} nesta sessão
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {state.history.map((entry) => (
          <ClipCard key={entry.id} entry={entry} />
        ))}

        {/* Placeholder for the next clip */}
        {nextName && (
          <div className="border border-dashed border-[#d0cfc9] dark:border-[#3a3a3a] rounded-md bg-[#fafaf8] dark:bg-[#242424] flex items-center justify-center min-h-[80px]">
            <div className="text-center px-2">
              <p className="text-[10px] text-[#9b9a97] dark:text-[#4c4c4c]">próximo</p>
              <p className="text-[11px] font-semibold text-[#9b9a97] dark:text-[#4c4c4c] truncate">{nextName}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ClipCard({ entry }) {
  return (
    <div className="border border-[#e9e9e7] dark:border-[#2e2e2e] rounded-md overflow-hidden bg-white dark:bg-[#1f1f1f] hover:shadow-md transition-shadow cursor-default">
      {/* Thumbnail area */}
      <div className="h-[60px] bg-[#f7f7f5] dark:bg-[#242424] border-b border-[#e9e9e7] dark:border-[#2e2e2e] flex items-center justify-center relative">
        <div className="w-8 h-8 bg-[#e9e9e7] dark:bg-[#2a2a2a] rounded" />
        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#2f81f7] rounded-full flex items-center justify-center">
          <CheckCircle2 size={10} className="text-white" />
        </div>
      </div>
      {/* Info */}
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-semibold truncate">{entry.filename}</p>
        <p className="text-[10px] text-[#9b9a97] dark:text-[#4c4c4c]">
          {formatTime(entry.timestamp)} · {formatBytes(entry.sizeBytes)}
        </p>
      </div>
    </div>
  )
}
