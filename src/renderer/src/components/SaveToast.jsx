import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

export default function SaveToast() {
  const { state, actions } = useApp()
  const toast = state.saveToast

  useEffect(() => {
    if (!toast) return
    if (toast.type === 'success') {
      const t = setTimeout(() => actions.hideSaveToast(), 2000)
      return () => clearTimeout(t)
    }
    if (toast.type === 'error') {
      const t = setTimeout(() => actions.hideSaveToast(), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (!toast) return null

  const bgColor =
    toast.type === 'success' ? 'bg-green-600'
      : toast.type === 'error' ? 'bg-red-600'
      : 'bg-gray-900'

  const icon = toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : null

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-start gap-2 rounded-lg px-4 py-3 text-white shadow-lg ${bgColor}`}
      style={{ minWidth: '220px', maxWidth: '320px' }}
    >
      {toast.type === 'saving' && (
        <svg className="mt-0.5 h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {icon && <span className="mt-0.5 shrink-0 text-sm font-bold">{icon}</span>}
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-tight">{toast.message}</span>
        {toast.subMessage && (
          <span className="mt-0.5 text-xs opacity-80">{toast.subMessage}</span>
        )}
      </div>
    </div>
  )
}
