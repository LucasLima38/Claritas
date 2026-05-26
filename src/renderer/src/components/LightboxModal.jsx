import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, FileText, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function toFileUrl(fullPath) {
  return `localfile:///${fullPath.replace(/\\/g, '/')}`
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function LightboxModal({ entries, index, onClose, onNavigate, onDelete }) {
  const { t } = useTranslation()
  const isOpen = index !== null && index >= 0 && index < entries.length
  const entry = isOpen ? entries[index] : null
  const isPdf = entry?.filename?.endsWith('.pdf')
  const isDriveOnly = entry ? !entry.fullPath : false
  const src = (() => {
    if (!entry) return null
    // Drive-only and PDF both use thumbPath; local SVG/PNG/JPG use fullPath directly
    if (isPdf || isDriveOnly) return entry.thumbPath ? toFileUrl(entry.thumbPath) : null
    return toFileUrl(entry.fullPath)
  })()

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      if (e.key === 'ArrowRight' && index < entries.length - 1) onNavigate(index + 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, index, entries.length, onNavigate])

  async function handleCopy() {
    try {
      const result = await window.electronAPI.copyFileToClipboard({ fullPath: entry.fullPath })
      if (result.ok) toast.success(t('lightbox.copied'))
      else toast.error(t('lightbox.copyError'))
    } catch {
      toast.error(t('lightbox.copyError'))
    }
  }

  async function handleShowInFolder() {
    try {
      await window.electronAPI.showInFolder({ fullPath: entry.fullPath })
    } catch {
      toast.error(t('lightbox.folderError'))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden"
        overlayClassName="bg-black/50"
        hideCloseButton
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <span className="text-sm font-semibold truncate flex-1">{entry?.filename}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {isOpen ? `${index + 1} / ${entries.length}` : ''}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>

        {/* Image area */}
        <div className="flex-1 min-h-0 relative flex items-center justify-center px-12 py-4 overflow-hidden lightbox-preview-bg">
          {(isPdf || isDriveOnly) && !src ? (
            <FileText size={64} className="text-muted-foreground/40" />
          ) : (
            <img
              key={entry?.id}
              src={src}
              alt={entry?.filename}
              className="max-w-full max-h-full object-contain"
              style={{ imageRendering: 'crisp-edges' }}
              draggable={false}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 z-10"
            onClick={() => onNavigate(index - 1)}
            disabled={!isOpen || index <= 0}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 z-10"
            onClick={() => onNavigate(index + 1)}
            disabled={!isOpen || index >= entries.length - 1}
          >
            <ChevronRight size={18} />
          </Button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t shrink-0">
          <span className="text-xs text-muted-foreground">
            {entry && `${formatTime(entry.timestamp)}${entry.sizeBytes != null ? ` · ${formatBytes(entry.sizeBytes)}` : ''}`}
          </span>
          <div className="flex gap-2">
            {!isDriveOnly && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopy}>
                {t('lightbox.copy')}
              </Button>
            )}
            {!isDriveOnly && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleShowInFolder}>
                {t('lightbox.folder')}
              </Button>
            )}
            {entry?.driveFileUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => window.electronAPI.openExternal(entry.driveFileUrl)}
              >
                <ExternalLink size={11} />
                {t('lightbox.drive')}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive border-destructive/30"
              onClick={() => onDelete(entry)}
            >
              {t('lightbox.delete')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
