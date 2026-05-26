import { useEffect } from 'react'
import { Paperclip, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '../context/AppContext.jsx'
import PreviewArea from './PreviewArea.jsx'
import { useTranslation, Trans } from 'react-i18next'

export default function ClipboardArea() {
  const { state, actions } = useApp()
  const { t } = useTranslation()

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.ctrlKey && e.key === 'v' && state.status === 'idle') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return
        e.preventDefault()
        actions.paste()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.status, actions])

  if (state.status === 'converting') {
    return (
      <div className="border-2 border-dashed border-border rounded-lg bg-muted/30 p-7 text-center">
        <Loader2 size={28} className="mx-auto mb-2 text-primary animate-spin" />
        <p className="text-sm font-medium">{t('clipboard.converting')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('clipboard.wait')}</p>
      </div>
    )
  }

  if (state.status === 'preview' || state.status === 'saving') {
    return <PreviewArea />
  }

  if (state.status === 'error') {
    return (
      <div className="border-2 border-dashed border-destructive/40 rounded-lg bg-destructive/5 p-7 text-center">
        <AlertCircle size={28} className="mx-auto mb-2 text-destructive" />
        <p className="text-sm font-medium text-destructive">{state.error?.message}</p>
        <Button
          variant="link"
          size="sm"
          onClick={actions.clearError}
          className="mt-2 text-destructive"
        >
          {t('clipboard.retry')}
        </Button>
      </div>
    )
  }

  const hasProject = state.projects.length > 0
  return (
    <div className="border-2 border-dashed border-border rounded-lg bg-muted/30 p-7 text-center">
      <Paperclip size={28} className="mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm font-medium">
        {hasProject ? t('clipboard.paste') : t('clipboard.createProject')}
      </p>
      {hasProject && (
        <p className="text-xs text-muted-foreground mt-1">
          <Trans
              i18nKey="clipboard.instruction"
              components={{ kbd: <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-[10.5px] font-semibold" /> }}
            />
        </p>
      )}
    </div>
  )
}
