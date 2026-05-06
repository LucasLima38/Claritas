import { useApp } from '@/context/AppContext'
import { CaptureControls } from './CaptureControls'
import { ImageEditor } from './ImageEditor'
import { Loader2 } from 'lucide-react'

export function CaptureTab() {
  const { state, actions } = useApp()
  const { captureStatus } = state

  if (captureStatus === 'capture-editor') {
    return <ImageEditor />
  }

  if (captureStatus === 'capture-countdown') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <Loader2 size={40} className="animate-spin" />
        <p className="text-sm">Capturando…</p>
        <button
          className="text-xs underline hover:text-foreground transition-colors"
          onClick={actions.cancelCapture}
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 w-full h-full">
      <CaptureControls
        onCapture={({ mode, delay }) => actions.startCapture({ mode, delay })}
        disabled={captureStatus === 'capture-countdown'}
      />
    </div>
  )
}
