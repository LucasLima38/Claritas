import { useState, useEffect } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import logoUrl from '../assets/logo.png'

export default function About({ open, onOpenChange, onCheckUpdate, updateStatus, downloadPercent }) {
  const { t } = useTranslation()
  const [appInfo, setAppInfo] = useState(null)

  useEffect(() => {
    if (open) {
      window.electronAPI.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null))
    }
  }, [open])

  const isChecking = updateStatus === 'checking'
  const isDownloading = updateStatus === 'downloading'
  const isBusy = isChecking || isDownloading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        {/* Header com logo */}
        <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-4">
          <img src={logoUrl} alt="Claritas" className="w-12 h-12 object-contain" />
          <div className="text-center">
            <DialogTitle className="text-base font-semibold tracking-tight">Claritas</DialogTitle>
            {appInfo && (
              <p className="text-xs text-muted-foreground mt-0.5">v{appInfo.version}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              {t('about.description')}
            </p>
          </div>
        </div>

        <Separator />

        {/* Sistema */}
        <div className="px-6 py-3 flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{t('about.system')}</p>
          <Row label={t('about.platform')} value={appInfo?.platform ?? '—'} />
          <Row label={t('about.arch')} value={appInfo?.arch ?? '—'} />
        </div>

        <Separator />

        {/* Ações */}
        <div className="px-6 py-3 flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-2 justify-start"
            onClick={onCheckUpdate}
            disabled={isBusy}
          >
            {isDownloading ? (
              <span className="tabular-nums text-primary font-medium">{downloadPercent}%</span>
            ) : isChecking ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            {isDownloading
              ? t('about.downloading', { percent: downloadPercent })
              : isChecking
              ? t('about.checking')
              : t('about.checkUpdate')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-2 justify-start"
            onClick={() => window.electronAPI.openExternal('https://github.com/LucasLima38/Claritas')}
          >
            <ExternalLink size={13} />
            {t('about.github')}
          </Button>
        </div>

        <Separator />

        <p className="text-[10px] text-muted-foreground text-center py-3">
          {t('about.madeBy')}
        </p>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-mono">{value}</span>
    </div>
  )
}
