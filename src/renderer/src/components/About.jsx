import { useState, useEffect } from 'react'
import { ArrowLeft, Download, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import logoUrl from '../assets/logo.png'

export default function About({ onBack, onCheckUpdate, updateStatus, downloadPercent }) {
  const [appInfo, setAppInfo] = useState(null)

  useEffect(() => {
    window.electronAPI.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null))
  }, [])

  const isChecking = updateStatus === 'checking'
  const isDownloading = updateStatus === 'downloading'
  const isBusy = isChecking || isDownloading

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="app-region-no-drag h-7 px-2 text-xs text-muted-foreground gap-1"
        >
          <ArrowLeft size={14} /> Voltar
        </Button>
        <h2 className="text-sm font-semibold">Sobre</h2>
      </div>

      <div className="p-5 flex flex-col gap-6 w-full max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-3 py-6">
          <img src={logoUrl} alt="Claritas" className="w-16 h-16 object-contain" />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Claritas</h1>
            {appInfo && (
              <p className="text-xs text-muted-foreground mt-0.5">v{appInfo.version}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2 max-w-xs">
              Captura e exporta esquemáticos do Altium Designer
            </p>
          </div>
        </div>

        <Separator />

        <section className="flex flex-col gap-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Sistema</p>
          <div className="flex flex-col gap-2">
            <InfoRow label="Plataforma" value={appInfo?.platform ?? '—'} />
            <InfoRow label="Arquitetura" value={appInfo?.arch ?? '—'} />
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Atualizações</p>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-muted-foreground">
              {isDownloading
                ? `Baixando… ${downloadPercent}%`
                : isChecking
                ? 'Verificando…'
                : 'Verificar atualizações'}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs gap-1.5"
              onClick={onCheckUpdate}
              disabled={isBusy}
            >
              {isDownloading ? (
                <span className="tabular-nums">{downloadPercent}%</span>
              ) : isChecking ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {isDownloading ? 'Baixando' : isChecking ? 'Verificando' : 'Verificar'}
            </Button>
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Links</p>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-muted-foreground">Repositório no GitHub</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs gap-1.5"
              onClick={() => window.electronAPI.openExternal('https://github.com/LucasLima38/Claritas')}
            >
              <ExternalLink size={12} />
              Abrir
            </Button>
          </div>
        </section>

        <div className="mt-auto pt-4">
          <p className="text-[10px] text-muted-foreground text-center">Made by Lucas Vieira</p>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-[12.5px] font-mono">{value}</span>
    </div>
  )
}
