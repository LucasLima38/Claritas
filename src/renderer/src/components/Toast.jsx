import { CheckCircle2, XCircle } from 'lucide-react'

export default function Toast({ message, type }) {
  const isSuccess = type === 'success'

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-[12.5px] font-medium z-50 pointer-events-none
        ${isSuccess
          ? 'bg-emerald-600 text-white'
          : 'bg-red-600 text-white'
        }`}
    >
      {isSuccess ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {message}
    </div>
  )
}
