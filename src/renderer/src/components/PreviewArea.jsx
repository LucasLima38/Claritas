import { Eye, Clock, FileText, Maximize2, FolderOpen } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

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

  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`

  async function handleCreateDir() {
    const result = await window.electronAPI.createOutputDir({ dir: state.dirMissingPath })
    actions.clearDirMissing()
    if (result.ok) {
      await actions.save()
    } else {
      toast.error(`Não foi possível criar a pasta: ${result.message}`)
    }
  }

  async function handleChooseDir() {
    const result = await window.electronAPI.chooseDirectory()
    actions.clearDirMissing()
    if (!result.canceled && activeProject) {
      await actions.updateProject(activeProject.id, { outputDir: result.path })
      await actions.save()
    }
  }

  return (
    <>
      <div className="border-2 border-primary/30 rounded-lg bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Eye size={13} />
            Prévia — {nextFilename}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={actions.discard}
              disabled={isSaving}
              className="h-6 px-2.5 text-[11px]"
            >
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={actions.save}
              disabled={isSaving}
              className="h-6 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSaving ? 'Salvando...' : 'Salvar →'}
            </Button>
          </div>
        </div>

        {/* SVG Preview */}
        <div className="flex items-center justify-center p-4 min-h-[140px] bg-card">
          <img
            src={svgDataUrl}
            alt="Prévia do esquemático"
            className="max-h-48 max-w-full object-contain drop-shadow-sm"
            style={{ imageRendering: 'crisp-edges' }}
          />
        </div>

        {/* Metadata footer */}
        {svgMetadata && (
          <div className="flex items-center gap-4 px-3 py-1.5 bg-muted border-t border-border">
            <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
              <Maximize2 size={9} /> {svgMetadata.width} × {svgMetadata.height}
            </Badge>
            <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
              <FileText size={9} /> {formatBytes(svgMetadata.sizeBytes)}
            </Badge>
            <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
              <Clock size={9} /> {(svgMetadata.conversionMs / 1000).toFixed(1)}s
            </Badge>
          </div>
        )}
      </div>

      {/* Dir Missing Dialog */}
      <AlertDialog open={state.dirMissing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FolderOpen size={18} /> Pasta de saída não encontrada
            </AlertDialogTitle>
            <AlertDialogDescription>
              A pasta de destino não existe:
              <br />
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded mt-1 inline-block break-all">
                {state.dirMissingPath}
              </code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={actions.clearDirMissing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChooseDir}
              className="bg-background text-foreground border border-border hover:bg-accent"
            >
              Escolher outra pasta
            </AlertDialogAction>
            <AlertDialogAction onClick={handleCreateDir}>
              Criar automaticamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
