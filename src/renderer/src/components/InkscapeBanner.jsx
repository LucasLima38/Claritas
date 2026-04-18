import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function InkscapeBanner({ onGoToSettings }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-sm">
      <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-amber-800 dark:text-amber-300 text-xs">
        Inkscape não foi encontrado. A conversão EMF→SVG não funcionará.
      </p>
      <Button
        variant="link"
        size="sm"
        onClick={onGoToSettings}
        className="ml-auto text-amber-700 dark:text-amber-400 p-0 h-auto text-xs app-region-no-drag"
      >
        Configurar <ArrowRight size={12} className="ml-1" />
      </Button>
    </div>
  )
}
