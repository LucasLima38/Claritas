import { useState, useEffect, useCallback } from 'react'
import { Loader2, Check, AlertCircle, Lock, LockOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'

const OCR_TIMEOUT_MS = 30_000

function createTimeoutPromise(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('OCR_TIMEOUT')), ms)
  )
}

function interpretParagraphs(text) {
  if (!text) return []

  // Double newlines → explicit paragraph breaks
  const byDouble = text.split(/\n{2,}/)
  if (byDouble.length > 1) {
    return byDouble.map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean)
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  const paragraphs = []
  let current = []

  for (const line of lines) {
    if (current.length === 0) {
      current.push(line)
      continue
    }
    const lastLine = current[current.length - 1]
    const prevEndsTerminal = /[.!?]$/.test(lastLine)
    // Only join lines when clearly mid-paragraph: previous doesn't end a sentence
    // and current line starts with a lowercase letter (wrapped continuation)
    const c = line[0]
    const startsLower = c !== undefined && c === c.toLowerCase() && c !== c.toUpperCase()

    if (!prevEndsTerminal && !startsLower) {
      // Uppercase start after a non-terminal line = heading/title → new paragraph
      paragraphs.push(current.join(' '))
      current = [line]
    } else {
      // Everything else: mid-sentence continuation OR post-terminal uppercase → join
      current.push(line)
    }
  }
  if (current.length > 0) paragraphs.push(current.join(' '))

  return paragraphs.filter(Boolean)
}

/**
 * Post-processes raw OCR text to fix common artefacts:
 *
 * 1. End-of-line syllable-break hyphens
 *    OCR splits a word across lines and adds a hyphen at the end of the first line.
 *    If the fragment before the hyphen ends with a vowel → soft hyphen, remove it and join.
 *    If it ends with a consonant → likely a real compound word, keep the hyphen.
 *      "pro-\ncesso"  → "processo"
 *      "well-\nknown" → "well-known"
 *
 * 2. Spurious whitespace inside a hyphenated word
 *    The OCR engine sometimes inserts a space right after (or before) the hyphen.
 *      "e- mail"  → "e-mail"
 *      "t -shirt" → "t-shirt"
 */
function fixOcrArtifacts(text) {
  if (!text) return text

  // 1. End-of-line soft hyphens
  let out = text.replace(
    /(\w+)-\n([a-záàãâéêíóôõúüç])/gi,
    (_, before, after) =>
      /[aeiouáàãâéêíóôõúü]$/i.test(before)
        ? before + after        // vowel ending → syllable break, remove hyphen
        : before + '-' + after  // consonant ending → compound word, keep hyphen
  )

  // 2. Spurious whitespace around the hyphen inside a word
  out = out.replace(/(\w)\s*-\s+(\w)/g, '$1-$2')
  out = out.replace(/(\w)\s+-\s*(\w)/g, '$1-$2')

  return out
}

/**
 * Props:
 *   runOcr   — async () => string
 *   autoRun  — start OCR immediately on mount
 */
export function OcrPanel({ runOcr, autoRun = false }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const [locked, setLocked] = useState(false)

  const handleRunOcr = useCallback(async () => {
    if (!runOcr) return
    setStatus('loading')
    setError(null)

    try {
      const extracted = await Promise.race([
        runOcr(),
        createTimeoutPromise(OCR_TIMEOUT_MS),
      ])
      if (!extracted) {
        setStatus('empty')
        setText('')
      } else {
        setStatus('ready')
        setText(fixOcrArtifacts(extracted))
      }
    } catch (err) {
      setStatus('error')
      setError(
        err.message === 'OCR_TIMEOUT'
          ? t('ocr.timeout')
          : t('ocr.extractError', { message: err.message })
      )
    }
  }, [runOcr, t])

  useEffect(() => {
    if (autoRun) handleRunOcr()
  }, [autoRun, handleRunOcr])

  const handleCopy = () => navigator.clipboard.writeText(text)

  const handleClear = () => {
    setText('')
    setStatus('idle')
    setLocked(false)
  }

  const paragraphs = interpretParagraphs(text)

  const statusIcon = {
    idle: null,
    loading: <Loader2 size={14} className="animate-spin text-muted-foreground" />,
    ready: <Check size={14} className="text-green-500" />,
    error: <AlertCircle size={14} className="text-destructive" />,
    empty: <AlertCircle size={14} className="text-muted-foreground" />,
  }[status]

  const statusLabel = {
    idle: t('ocr.waiting'),
    loading: t('ocr.extracting'),
    ready: t('ocr.ready'),
    error: t('ocr.error'),
    empty: t('ocr.noText'),
  }[status]

  return (
    <Card className="w-full flex flex-col h-full rounded-none border-l border-t-0 border-b-0 border-r-0">
      <CardHeader className="py-2 px-3 flex-row items-center space-y-0 gap-2 shrink-0">
        <span className="text-sm font-medium flex-1">{t('ocr.extractedText')}</span>

        {/* ── Lock button + status ── */}
        <div className="flex items-center gap-1 shrink-0">
          {status === 'ready' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setLocked(l => !l)}
              title={locked ? t('ocr.unlock') : t('ocr.lock')}
            >
              {locked ? <Lock size={12} /> : <LockOpen size={12} />}
            </Button>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {statusIcon}
            <span>{statusLabel}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-2 flex-1 flex flex-col gap-2 overflow-hidden min-h-0">
        {status === 'error' && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        {status === 'empty' && (
          <p className="text-xs text-muted-foreground">{t('ocr.notFound')}</p>
        )}

        {locked && status === 'ready' ? (
          // ── Formatted paragraph view (read-only) ──
          <div className="flex-1 overflow-y-auto rounded-md border border-input bg-background px-4 py-3 text-sm leading-relaxed min-h-[200px]">
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-4 last:mb-0">
                {p}
              </p>
            ))}
          </div>
        ) : (
          // ── Editable raw textarea ──
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={status === 'idle' ? t('ocr.clickToStart') : ''}
            className="flex-1 resize-none text-sm font-mono min-h-[200px]"
            aria-label={t('ocr.extractedText')}
          />
        )}
      </CardContent>

      <CardFooter className="px-3 py-2 gap-2 flex-wrap shrink-0">
        <Button
          variant="default"
          size="sm"
          onClick={handleRunOcr}
          disabled={status === 'loading'}
          className="flex-1 gap-1.5"
        >
          {status === 'loading' && <Loader2 size={14} className="animate-spin" />}
          {t('ocr.extract')}
        </Button>
        {status !== 'idle' && (
          <>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!text} className="flex-1">
              {t('ocr.copy')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} className="flex-1">
              {t('ocr.clear')}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
