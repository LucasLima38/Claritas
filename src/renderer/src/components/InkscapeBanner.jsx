import { AlertTriangle, ArrowRight } from 'lucide-react'

export default function InkscapeBanner({ onGoToSettings }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-[12px]">
      <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-amber-800 dark:text-amber-300">
        Inkscape não foi encontrado. A conversão EMF→SVG não funcionará.
      </p>
      <button
        onClick={onGoToSettings}
        className="ml-auto flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold hover:underline shrink-0"
      >
        Configurar <ArrowRight size={12} />
      </button>
    </div>
  )
}
