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
import LightboxModal from './LightboxModal.jsx'
import { Share2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

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
  const [selectedIndex, setSelectedIndex] = useState(null)

  async function handleLightboxDelete(entry) {
    const idx = state.history.findIndex((e) => e.id === entry.id)
    if (idx === -1) { setSelectedIndex(null); return }
    const lengthBefore = state.history.length
    const ok = await actions.deleteHistoryEntry(entry)
    if (!ok) { toast.error('Não foi possível remover o arquivo'); return }
    toast.success(`${entry.filename} removido`)
    if (lengthBefore === 1) {
      setSelectedIndex(null)
    } else if (idx >= lengthBefore - 1) {
      setSelectedIndex(idx - 1)
    }
  }

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
        {state.history.map((entry, i) => (
          <ClipCard key={entry.id} entry={entry} onOpen={() => setSelectedIndex(i)} onDelete={handleLightboxDelete} />
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

      <LightboxModal
        entries={state.history}
        index={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onNavigate={setSelectedIndex}
        onDelete={handleLightboxDelete}
      />
    </div>
  )
}

function ClipCard({ entry, onOpen, onDelete }) {
  const isPdf = entry.filename.endsWith('.pdf')
  const fileUrl = toFileUrl(entry.fullPath)
  const thumbUrl = entry.thumbPath ? toFileUrl(entry.thumbPath) : null
  const { state, actions } = useApp()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    setSharing(true)
    await actions.shareFile({ fullPath: entry.fullPath, email: shareEmail })
    setSharing(false)
    setShareOpen(false)
    setShareEmail('')
  }

  async function handleCopy() {
    const result = await window.electronAPI.copyFileToClipboard({ fullPath: entry.fullPath })
    if (result.ok) toast.success('Arquivo copiado para o clipboard')
    else toast.error('Não foi possível copiar o arquivo')
  }

  async function handleShowInFolder() {
    await window.electronAPI.showInFolder({ fullPath: entry.fullPath })
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer p-0" onClick={onOpen}>
            {/* Thumbnail */}
            <div className="relative h-[72px] bg-[#f5f4ef] border-b border-border flex items-center justify-center overflow-hidden">
              {isPdf && !thumbUrl ? (
                <FileText size={28} className="text-muted-foreground/50" />
              ) : (
                <>
                  <img
                    src={isPdf ? thumbUrl : fileUrl}
                    alt={entry.filename}
                    className="w-full h-full object-contain p-1"
                    style={{ imageRendering: 'crisp-edges' }}
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.parentElement.querySelector('.fallback-icon')?.classList.remove('hidden')
                    }}
                  />
                  <FileText size={28} className="fallback-icon hidden text-muted-foreground/50 absolute" />
                </>
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
          <ContextMenuItem onClick={() => onDelete(entry)} className="text-destructive focus:text-destructive">
            Deletar arquivo
          </ContextMenuItem>
          {state.account && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setShareOpen(true)}>
                <Share2 size={13} />
                Compartilhar
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="w-80">
          <DialogHeader>
            <DialogTitle className="text-sm">Compartilhar arquivo</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground truncate">{entry.filename}</p>
          <Input
            type="email"
            placeholder="E-mail do destinatário"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shareEmail) handleShare()
            }}
          />
          <DialogFooter>
            <Button
              size="sm"
              disabled={!shareEmail || sharing}
              onClick={handleShare}
            >
              {sharing ? 'Enviando…' : 'Compartilhar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
