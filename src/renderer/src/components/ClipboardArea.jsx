import { useEffect } from 'react'
import { Paperclip, AlertCircle, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import PreviewArea from './PreviewArea.jsx'

export default function ClipboardArea() {
  const { state, actions } = useApp()

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
      <div className="border-2 border-dashed border-[#d0cfc9] dark:border-[#3a3a3a] rounded-lg bg-[#fafaf8] dark:bg-[#242424] p-7 text-center">
        <Loader2 size={28} className="mx-auto mb-2 text-[#2f81f7] animate-spin" />
        <p className="text-[13.5px] font-medium">Convertendo com Inkscape...</p>
        <p className="text-[11.5px] text-[#9b9a97] mt-1">Aguarde até 15 segundos</p>
      </div>
    )
  }

  if (state.status === 'preview' || state.status === 'saving') {
    return <PreviewArea />
  }

  if (state.status === 'error') {
    return (
      <div className="border-2 border-dashed border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-950/30 p-7 text-center">
        <AlertCircle size={28} className="mx-auto mb-2 text-red-500" />
        <p className="text-[13.5px] font-medium text-red-700 dark:text-red-400">{state.error?.message}</p>
        <button
          onClick={actions.clearError}
          className="mt-3 text-[11.5px] text-red-600 dark:text-red-400 underline"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const hasProject = state.projects.length > 0
  return (
    <div className="border-2 border-dashed border-[#d0cfc9] dark:border-[#3a3a3a] rounded-lg bg-[#fafaf8] dark:bg-[#242424] p-7 text-center">
      <Paperclip size={28} className="mx-auto mb-2 text-[#9b9a97]" />
      <p className="text-[13.5px] font-medium">
        {hasProject ? 'Cole o esquemático' : 'Crie um projeto nas configurações'}
      </p>
      {hasProject && (
        <p className="text-[11.5px] text-[#9b9a97] mt-1">
          Copie no Altium Designer →{' '}
          <kbd className="bg-[#f0efec] dark:bg-[#2a2a2a] border border-[#d0cfc9] dark:border-[#3a3a3a] rounded px-1.5 py-0.5 text-[10.5px] font-semibold">Ctrl+V</kbd>
          {' '}aqui
        </p>
      )}
    </div>
  )
}
