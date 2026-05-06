import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Loader2, Check, AlertCircle } from 'lucide-react'

const OCR_TIMEOUT_MS = 30_000

function createTimeoutPromise(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('OCR_TIMEOUT')), ms)
  )
}

/**
 * Props:
 *   worker         — Tesseract.js worker instance (created + managed by ImageEditor)
 *   imageDataURL   — the current image as dataURL for OCR processing
 *   autoRun        — if true, start OCR immediately on mount (used in tests)
 */
export function OcrPanel({ worker, imageDataURL, autoRun = false }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error' | 'empty'
  const [text, setText] = useState('')
  const [error, setError] = useState(null)

  const runOcr = useCallback(async () => {
    if (!worker || !imageDataURL) return
    setStatus('loading')
    setError(null)

    try {
      const result = await Promise.race([
        worker.recognize(imageDataURL),
        createTimeoutPromise(OCR_TIMEOUT_MS),
      ])
      const extracted = result.data.text.trim()
      if (!extracted) {
        setStatus('empty')
        setText('')
      } else {
        setStatus('ready')
        setText(extracted)
      }
    } catch (err) {
      setStatus('error')
      setError(
        err.message === 'OCR_TIMEOUT'
          ? 'OCR demorou muito. Tente novamente.'
          : `Erro ao extrair texto: ${err.message}`
      )
    }
  }, [worker, imageDataURL])

  useEffect(() => {
    if (autoRun) runOcr()
  }, [autoRun, runOcr])

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
  }

  const handleClear = () => {
    setText('')
    setStatus('idle')
  }

  const statusIcon = {
    idle: null,
    loading: <Loader2 size={14} className="animate-spin text-muted-foreground" />,
    ready: <Check size={14} className="text-green-500" />,
    error: <AlertCircle size={14} className="text-destructive" />,
    empty: <AlertCircle size={14} className="text-muted-foreground" />,
  }[status]

  const statusLabel = {
    idle: 'Aguardando',
    loading: 'Extraindo texto…',
    ready: 'Pronto',
    error: 'Erro',
    empty: 'Sem texto',
  }[status]

  return (
    <Card className="w-[280px] flex flex-col h-full rounded-none border-l border-t-0 border-b-0 border-r-0">
      <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
        <span className="text-sm font-medium">Texto extraído</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {statusIcon}
          <span>{statusLabel}</span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-2 flex-1 flex flex-col gap-2">
        {status === 'error' && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        {status === 'empty' && (
          <p className="text-xs text-muted-foreground">Nenhum texto encontrado na imagem.</p>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={status === 'idle' ? 'Clique em Extrair para iniciar o OCR' : ''}
          className="flex-1 resize-none text-sm font-mono min-h-[200px]"
          aria-label="Texto extraído"
        />
      </CardContent>

      <CardFooter className="px-4 py-3 gap-2">
        {status === 'idle' && worker && (
          <Button variant="default" size="sm" onClick={runOcr} className="flex-1">
            Extrair
          </Button>
        )}
        {status !== 'idle' && (
          <>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!text} className="flex-1">
              Copiar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} className="flex-1">
              Limpar
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
