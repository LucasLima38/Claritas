import { FileText, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function toFileUrl(fullPath) {
  return `localfile:///${fullPath.replace(/\\/g, '/')}`
}

export default function ClipGrid() {
  const { state, actions } = useApp()
  const [syncing, setSyncing] = useState(false)
  const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
  const nextName = activeProject
    ? `${activeProject.prefix}${String(activeProject.counter + 1).padStart(3, '0')}.svg`
    : null

  if (state.history.length === 0 && !nextName) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recentes
        </p>
        <div className="flex items-center gap-2">
          {state.history.length > 0 && (
            <p className="text-[10.5px] text-muted-foreground">
              {state.history.length} arquivo{state.history.length !== 1 ? 's' : ''} nesta sessão
            </p>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground"
            title="Sincronizar com pasta"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true)
              await actions.syncHistory()
              setSyncing(false)
            }}
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
        {state.history.map((entry) => (
          <ClipCard key={entry.id} entry={entry} />
        ))}

        {nextName && (
          <Card className="border-dashed bg-muted/30 flex items-center justify-center min-h-[80px]">
            <div className="text-center px-2">
              <p className="text-[10px] text-muted-foreground">próximo</p>
              <p className="text-[11px] font-semibold text-muted-foreground truncate">{nextName}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function ClipCard({ entry }) {
  const { actions } = useApp()
  const isPdf = entry.filename.endsWith('.pdf')
  const fileUrl = toFileUrl(entry.fullPath)

  async function handleCopy() {
    const result = await window.electronAPI.copyFileToClipboard({ fullPath: entry.fullPath })
    if (result.ok) toast.success('Arquivo copiado para o clipboard')
    else toast.error('Não foi possível copiar o arquivo')
  }

  async function handleDelete() {
    await actions.deleteHistoryEntry(entry)
    toast.success(`${entry.filename} removido`)
  }

  async function handleShowInFolder() {
    await window.electronAPI.showInFolder({ fullPath: entry.fullPath })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-default p-0">
          {/* Thumbnail */}
          <div className="h-[72px] bg-[#f5f4ef] border-b border-border flex items-center justify-center overflow-hidden">
            {isPdf ? (
              <FileText size={28} className="text-muted-foreground/50" />
            ) : (
              <img
                src={fileUrl}
                alt={entry.filename}
                className="w-full h-full object-contain p-1"
                style={{ imageRendering: 'crisp-edges' }}
                draggable={false}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
          </div>
          {/* Info */}
          <div className="px-2 py-1.5">
            <p className="text-[11px] font-semibold truncate">{entry.filename}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatTime(entry.timestamp)} · {formatBytes(entry.sizeBytes)}
            </p>
          </div>
        </Card>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={handleCopy}>
          Copiar arquivo
        </ContextMenuItem>
        <ContextMenuItem onClick={handleShowInFolder}>
          Ir para a pasta
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          Deletar arquivo
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
