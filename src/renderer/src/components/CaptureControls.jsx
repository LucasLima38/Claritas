import { useState } from 'react'
import { Monitor, AppWindow, Maximize, Camera, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const MODES = [
  { value: 'region',     label: 'Região',      icon: Maximize },
  { value: 'window',    label: 'Janela ativa', icon: AppWindow },
  { value: 'fullscreen', label: 'Tela cheia',  icon: Monitor },
]

const DELAYS = [
  { value: '0',  label: 'Sem delay' },
  { value: '3',  label: '3 segundos' },
  { value: '5',  label: '5 segundos' },
  { value: '10', label: '10 segundos' },
]

/**
 * Props:
 *   onCapture({ mode, delay }) — called when user clicks Capturar agora
 *   disabled — true while countdown is running
 */
export function CaptureControls({ onCapture, disabled = false }) {
  const [mode, setMode] = useState('fullscreen')
  const [delay, setDelay] = useState('0')

  const handleCapture = () => {
    onCapture({ mode, delay: Number(delay) })
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 h-full py-12">
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Modo de captura</span>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={[
                'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                mode === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Delay</span>
        <div className="flex items-center gap-2">
          <Timer size={16} className="text-muted-foreground" />
          <Select value={delay} onValueChange={setDelay}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELAYS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        size="lg"
        onClick={handleCapture}
        disabled={disabled}
        className="gap-2 px-8"
      >
        <Camera size={18} />
        {disabled ? 'Capturando…' : 'Capturar agora'}
      </Button>
    </div>
  )
}
