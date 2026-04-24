import { Eye, Clock, FileText, Maximize2, FolderOpen, ZoomIn, ZoomOut, Scan, Save, X, Layers } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch'

const PREVIEW_MIN_HEIGHT = 240
const ZOOM_STEP = 0.25
const WHEEL_STEP = 0.005

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls()

  function fitToView() {
    resetTransform(200)
  }

  return (
    <div className="absolute bottom-2 right-2 flex gap-1 z-10">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 bg-background/80 hover:bg-background"
        onClick={() => zoomIn(ZOOM_STEP)}
      >
        <ZoomIn size={13} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 bg-background/80 hover:bg-background"
        onClick={() => zoomOut(ZOOM_STEP)}
      >
        <ZoomOut size={13} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 bg-background/80 hover:bg-background"
        title="Enquadrar tudo"
        onClick={fitToView}
      >
        <Scan size={13} />
      </Button>
    </div>
  )
}

export default function PreviewArea() {
  const { state, actions } = useApp()
  const { svgContent, svgMetadata } = state
  const isSaving = state.status === 'saving'

  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
  const nextFilename = activeProject
    ? `${activeProject.prefix}${String(activeProject.counter + 1).padStart(3, '0')}.${state.exportFormat}`
    : `output.${state.exportFormat}`

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
          <div className="flex gap-1.5 items-center">
            <Button
              size="sm"
              variant="outline"
              onClick={actions.discard}
              disabled={isSaving}
              className="h-6 px-2.5 text-[11px] gap-1.5"
            >
              <X size={11} />
              Descartar
            </Button>
            <Select value={state.exportFormat} onValueChange={actions.setExportFormat}>
              <SelectTrigger className="h-6 w-[78px] text-[11px] px-2 app-region-no-drag gap-1.5">
                <Layers size={11} className="shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="svg">SVG</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpg">JPG</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={actions.save}
              disabled={isSaving}
              className="h-6 px-2.5 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save size={11} />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* SVG Preview */}
        <div className="relative overflow-hidden" style={{ background: '#f5f4ef', minHeight: PREVIEW_MIN_HEIGHT }}>
          <TransformWrapper
            minScale={0.1}
            maxScale={10}
            doubleClick={{ mode: 'reset' }}
            wheel={{ step: WHEEL_STEP }}
          >
            <ZoomControls />
            <TransformComponent
              wrapperStyle={{ width: '100%', minHeight: PREVIEW_MIN_HEIGHT }}
              contentStyle={{ width: '100%' }}
            >
              <img
                src={svgDataUrl}
                alt="Prévia do esquemático"
                draggable={false}
                style={{
                  display: 'block',
                  width: '100%',
                  height: `${PREVIEW_MIN_HEIGHT}px`,
                  objectFit: 'contain',
                  padding: '16px',
                  boxSizing: 'border-box',
                  imageRendering: 'crisp-edges',
                }}
              />
            </TransformComponent>
          </TransformWrapper>
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
