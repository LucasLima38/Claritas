import { Eye, Clock, FileText, Maximize2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PreviewArea() {
  const { state, actions } = useApp()
  const { svgContent, svgMetadata } = state
  const isSaving = state.status === 'saving'

  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
  const nextFilename = activeProject
    ? `${activeProject.prefix}${String(activeProject.counter + 1).padStart(3, '0')}.svg`
    : 'output.svg'

  if (!svgContent) return null

  // Create a safe data URL for the SVG preview
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`

  return (
    <div className="border-2 border-[#2f81f7] rounded-lg bg-[#f5f9ff] dark:bg-[#1a2535] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#e8f0fe] dark:bg-[#1e2e4a] border-b border-[#c8d9fb] dark:border-[#2a3f5f]">
        <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[#1a56db] dark:text-[#7cb3f5]">
          <Eye size={13} />
          Prévia — {nextFilename}
        </div>
        <div className="flex gap-2">
          <button
            onClick={actions.discard}
            disabled={isSaving}
            className="h-6 px-2.5 rounded border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[11px] font-medium text-[#6b6a68] dark:text-[#9b9a97] hover:bg-[#f7f7f5] disabled:opacity-50"
          >
            Descartar
          </button>
          <button
            onClick={actions.save}
            disabled={isSaving}
            className="h-6 px-2.5 rounded bg-[#2f81f7] hover:bg-[#2673e0] text-white text-[11px] font-semibold disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar →'}
          </button>
        </div>
      </div>

      {/* SVG Preview — always white background; schematics are designed for light backgrounds */}
      <div className="flex items-center justify-center p-4 min-h-[140px] bg-white">
        <img
          src={svgDataUrl}
          alt="Prévia do esquemático"
          className="max-h-48 max-w-full object-contain drop-shadow-sm"
          style={{ imageRendering: 'crisp-edges' }}
        />
      </div>

      {/* Metadata footer */}
      {svgMetadata && (
        <div className="flex items-center gap-5 px-3 py-1.5 bg-[#e8f0fe] dark:bg-[#1e2e4a] border-t border-[#c8d9fb] dark:border-[#2a3f5f] text-[10.5px] text-[#4a6fa8] dark:text-[#7cb3f5]">
          <span className="flex items-center gap-1">
            <Maximize2 size={10} />
            {svgMetadata.width} × {svgMetadata.height}
          </span>
          <span className="flex items-center gap-1">
            <FileText size={10} />
            {formatBytes(svgMetadata.sizeBytes)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {(svgMetadata.conversionMs / 1000).toFixed(1)}s
          </span>
        </div>
      )}
    </div>
  )
}
