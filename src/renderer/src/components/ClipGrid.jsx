import { useState } from 'react'
import { ExternalLink, FileText, RefreshCw, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useApp } from '../context/AppContext.jsx'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import LightboxModal from './LightboxModal.jsx'
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

function formatDateTime(isoString, t) {
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (isToday) return t('clipgrid.today', { time })
  const day = date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
  return `${day} · ${time}`
}

function toFileUrl(fullPath) {
  return `localfile:///${fullPath.replace(/\\/g, '/')}`
}

export default function ClipGrid({ filter }) {
  const { t } = useTranslation()
  const { state, actions } = useApp()
  const [syncing, setSyncing] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(null)

  const entries = (filter
    ? state.history.filter((e) =>
        filter === 'capture'
          ? /\.(png|jpe?g|webp)$/i.test(e.filename)
          : /\.(svg|pdf)$/i.test(e.filename)
      )
    : state.history
  ).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  async function handleLightboxDelete(entry) {
    const idx = entries.findIndex((e) => e.id === entry.id)
    if (idx === -1) { setSelectedIndex(null); return }
    const lengthBefore = entries.length
    const ok = await actions.deleteHistoryEntry(entry)
    if (!ok) { toast.error(t('clipgrid.deleteError')); return }
    toast.success(t('clipgrid.deleted', { filename: entry.filename }))
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

  if (entries.length === 0 && (filter === 'capture' || !nextName)) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('clipgrid.recent')}
        </p>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <p className="text-[10.5px] text-muted-foreground">
              {t('clipgrid.files', { count: entries.length })}
            </p>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground"
            title={t('clipgrid.syncFolder')}
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
        {entries.map((entry, i) => (
          <ClipCard key={entry.id} entry={entry} onOpen={() => setSelectedIndex(i)} onDelete={handleLightboxDelete} />
        ))}

        {!filter && nextName && (
          <Card className="border-dashed bg-muted/30 flex items-center justify-center min-h-[80px]">
            <div className="text-center px-2">
              <p className="text-[10px] text-muted-foreground">{t('clipgrid.next')}</p>
              <p className="text-[11px] font-semibold text-muted-foreground truncate">{nextName}</p>
            </div>
          </Card>
        )}
      </div>

      <LightboxModal
        entries={entries}
        index={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onNavigate={setSelectedIndex}
        onDelete={handleLightboxDelete}
      />
    </div>
  )
}

function ClipCard({ entry, onOpen, onDelete }) {
  const { t } = useTranslation()
  const isPdf = entry.filename.endsWith('.pdf')
  const isDriveOnly = !entry.fullPath
  const fileUrl = isDriveOnly ? null : toFileUrl(entry.fullPath)
  const thumbUrl = entry.thumbPath ? toFileUrl(entry.thumbPath) : null
  const { state, actions } = useApp()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    setSharing(true)
    try {
      await actions.shareFile({ fullPath: entry.fullPath, email: shareEmail })
      setShareOpen(false)
      setShareEmail('')
    } catch {
      toast.error(t('clipgrid.shareError'))
    } finally {
      setSharing(false)
    }
  }

  async function handleCopy() {
    const result = await window.electronAPI.copyFileToClipboard({ fullPath: entry.fullPath })
    if (result.ok) toast.success(t('lightbox.copied'))
    else toast.error(t('lightbox.copyError'))
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
              {(isPdf || isDriveOnly) && !thumbUrl ? (
                <FileText size={28} className="text-muted-foreground/50" />
              ) : (
                <>
                  <img
                    src={(isPdf || isDriveOnly) ? thumbUrl : fileUrl}
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
                {formatDateTime(entry.timestamp, t)} · {formatBytes(entry.sizeBytes)}
              </p>
            </div>
          </Card>
        </ContextMenuTrigger>

        <ContextMenuContent>
          {!isDriveOnly && (
            <ContextMenuItem onClick={handleCopy}>
              {t('clipgrid.copyFile')}
            </ContextMenuItem>
          )}
          {!isDriveOnly && (
            <ContextMenuItem onClick={handleShowInFolder}>
              {t('clipgrid.openFolder')}
            </ContextMenuItem>
          )}
          {(entry.driveFolderUrl || entry.driveFileUrl) && (
            <ContextMenuItem onClick={() => window.electronAPI.openExternal(entry.driveFolderUrl ?? entry.driveFileUrl)}>
              <ExternalLink size={13} />
              {t('clipgrid.openDrive')}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDelete(entry)} className="text-destructive focus:text-destructive">
            {t('clipgrid.deleteFile')}
          </ContextMenuItem>
          {state.account && !isDriveOnly && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setShareOpen(true)}>
                <Share2 size={13} />
                {t('clipgrid.share')}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={shareOpen} onOpenChange={(open) => { setShareOpen(open); if (!open) setShareEmail('') }}>
        <DialogContent className="w-80">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('clipgrid.shareFile')}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground truncate">{entry.filename}</p>
          <Input
            type="email"
            placeholder={t('clipgrid.recipientEmail')}
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shareEmail) handleShare()
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              size="sm"
              disabled={!shareEmail || sharing}
              onClick={handleShare}
            >
              {sharing ? t('clipgrid.sending') : t('clipgrid.share')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
