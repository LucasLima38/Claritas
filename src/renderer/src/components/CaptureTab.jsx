import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { CaptureControls } from './CaptureControls'
import { ImageEditor } from './ImageEditor'
import ClipGrid from './ClipGrid'

export function CaptureTab() {
  const { t } = useTranslation()
  const { state, actions } = useApp()
  const { captureStatus } = state

  if (captureStatus === 'capture-editor') {
    return <ImageEditor />
  }

  if (captureStatus === 'capture-countdown') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <Loader2 size={40} className="animate-spin" />
        <p className="text-sm">{t('capture.capturing')}</p>
        <button
          className="text-xs underline hover:text-foreground transition-colors"
          onClick={actions.cancelCapture}
        >
          {t('capture.cancel')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
        <CaptureControls
          onCapture={({ mode, delay, resolution }) => actions.startCapture({ mode, delay, resolution })}
          disabled={captureStatus === 'capture-countdown'}
        />
        <ClipGrid filter="capture" />
      </div>
    </div>
  )
}
