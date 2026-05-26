import { useState } from 'react'
import { Monitor, AppWindow, Maximize, Camera, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Props:
 *   onCapture({ mode, delay, resolution }) — called when user clicks Capturar agora
 *   disabled — true while countdown is running
 */
export function CaptureControls({ onCapture, disabled = false }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('fullscreen')
  const [delay, setDelay] = useState('0')
  const [resolution, setResolution] = useState('normal')

  const MODES = [
    { value: 'region',     label: t('capture.modes.region'),     icon: Maximize },
    { value: 'window',     label: t('capture.modes.window'),     icon: AppWindow },
    { value: 'fullscreen', label: t('capture.modes.fullscreen'), icon: Monitor },
  ]

  const DELAYS = [
    { value: '0',  label: t('capture.noDelay') },
    { value: '3',  label: t('capture.seconds', { n: 3 }) },
    { value: '5',  label: t('capture.seconds', { n: 5 }) },
    { value: '10', label: t('capture.seconds', { n: 10 }) },
  ]

  const RESOLUTIONS = [
    { value: 'low',    label: t('capture.resolutions.low') },
    { value: 'normal', label: t('capture.resolutions.normal') },
    { value: 'high',   label: t('capture.resolutions.high') },
  ]

  const handleCapture = () => {
    onCapture({ mode, delay: Number(delay), resolution })
  }

  return (
    <div className="border-2 border-dashed border-border rounded-lg bg-muted/30 p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t('capture.modeLabel')}</span>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
            {MODES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={[
                  'flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  mode === value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Timer size={14} className="text-muted-foreground" />
          <Select value={delay} onValueChange={setDelay}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELAYS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t('capture.resolution')}</span>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
            {RESOLUTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setResolution(value)}
                className={[
                  'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  resolution === value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleCapture}
          disabled={disabled}
          className="gap-2"
        >
          <Camera size={16} />
          {disabled ? t('capture.capturing') : t('capture.captureNow')}
        </Button>
      </div>
    </div>
  )
}
