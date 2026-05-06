import { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Arrow, Rect, Ellipse, Line, Text, Group, Circle } from 'react-konva'
import { createWorker } from 'tesseract.js'
import useImage from 'use-image'
import { EditorToolbar } from './EditorToolbar'
import { OcrPanel } from './OcrPanel'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useApp } from '@/context/AppContext'

const MAX_HISTORY = 50

function generateId() {
  return Math.random().toString(36).slice(2)
}

function AnnotationShape({ shape }) {
  if (shape.type === 'arrow') {
    return (
      <Arrow
        id={shape.id}
        points={shape.points}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth}
        pointerLength={12}
        pointerWidth={10}
        fill={shape.color}
        hitStrokeWidth={12}
      />
    )
  }
  if (shape.type === 'rect') {
    return (
      <Rect
        id={shape.id}
        x={shape.x} y={shape.y}
        width={shape.width} height={shape.height}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth}
        fill="transparent"
        hitStrokeWidth={10}
      />
    )
  }
  if (shape.type === 'ellipse') {
    return (
      <Ellipse
        id={shape.id}
        x={shape.x} y={shape.y}
        radiusX={shape.radiusX} radiusY={shape.radiusY}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth}
        fill="transparent"
        hitStrokeWidth={10}
      />
    )
  }
  if (shape.type === 'line') {
    return (
      <Line
        id={shape.id}
        points={shape.points}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth}
        hitStrokeWidth={12}
      />
    )
  }
  if (shape.type === 'pen') {
    return (
      <Line
        id={shape.id}
        points={shape.points}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth}
        tension={0.5}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={12}
      />
    )
  }
  if (shape.type === 'text') {
    return (
      <Text
        id={shape.id}
        x={shape.x} y={shape.y}
        text={shape.text}
        fill={shape.color}
        fontSize={shape.fontSize ?? 16}
        fontFamily="system-ui"
      />
    )
  }
  if (shape.type === 'highlight') {
    return (
      <Rect
        id={shape.id}
        x={shape.x} y={shape.y}
        width={shape.width} height={shape.height}
        fill={shape.color}
        opacity={0.35}
      />
    )
  }
  if (shape.type === 'counter') {
    return (
      <Group id={shape.id} x={shape.x} y={shape.y}>
        <Circle radius={14} fill={shape.color} />
        <Text
          text={String(shape.count)}
          fill="#fff"
          fontSize={14}
          fontStyle="bold"
          x={-7} y={-7}
          width={14}
          align="center"
        />
      </Group>
    )
  }
  return null
}

export function ImageEditor() {
  const { state, actions } = useApp()
  const { captureData, captureFormat } = state

  const [image] = useImage(captureData?.dataURL ?? '')
  const [activeTool, setActiveTool] = useState('select')
  const [color, setColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [annotations, setAnnotations] = useState([])
  const [history, setHistory] = useState([[]])
  const [historyIdx, setHistoryIdx] = useState(0)
  const [ocrOpen, setOcrOpen] = useState(false)
  const [counterCount, setCounterCount] = useState(1)
  const [textEditing, setTextEditing] = useState(null) // { id, x, y, value, color, fontSize }

  const isDrawingRef = useRef(false)
  const currentShapeRef = useRef(null)
  const workerRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    let mounted = true
    createWorker('por+eng').then((w) => {
      if (mounted) workerRef.current = w
    })
    return () => {
      mounted = false
      workerRef.current?.terminate()
    }
  }, [])

  const handleUndo = useCallback(() => {
    if (historyIdx <= 0) return
    const newIdx = historyIdx - 1
    setHistoryIdx(newIdx)
    setAnnotations(history[newIdx])
  }, [history, historyIdx])

  const handleRedo = useCallback(() => {
    if (historyIdx >= history.length - 1) return
    const newIdx = historyIdx + 1
    setHistoryIdx(newIdx)
    setAnnotations(history[newIdx])
  }, [history, historyIdx])

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  const pushHistory = useCallback((newAnnotations) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIdx + 1)
      const next = [...trimmed, newAnnotations]
      if (next.length > MAX_HISTORY) next.shift()
      return next
    })
    setHistoryIdx((prev) => Math.min(prev + 1, MAX_HISTORY - 1))
    setAnnotations(newAnnotations)
  }, [historyIdx])

  const getPointerPos = (e) => {
    const stage = e.target.getStage()
    return stage.getPointerPosition()
  }

  useEffect(() => {
    if (textEditing) {
      textareaRef.current?.focus()
    }
  }, [textEditing])

  const commitTextEdit = useCallback(() => {
    if (!textEditing) return
    const updated = annotations
      .map((a) => a.id === textEditing.id ? { ...a, text: textEditing.value } : a)
      .filter((a) => !(a.id === textEditing.id && textEditing.value.trim() === ''))
    pushHistory(updated)
    setTextEditing(null)
  }, [textEditing, annotations, pushHistory])

  const handleMouseDown = (e) => {
    if (textEditing) { commitTextEdit(); return }
    if (activeTool === 'select') return
    if (activeTool === 'eraser') {
      isDrawingRef.current = true
      const targetId = e.target?.id?.()
      if (targetId && annotations.some((a) => a.id === targetId)) {
        setAnnotations((prev) => prev.filter((a) => a.id !== targetId))
      }
      return
    }

    isDrawingRef.current = true
    const pos = getPointerPos(e)

    if (activeTool === 'arrow' || activeTool === 'line') {
      currentShapeRef.current = {
        id: generateId(), type: activeTool,
        points: [pos.x, pos.y, pos.x, pos.y],
        color, strokeWidth,
      }
    } else if (activeTool === 'rect' || activeTool === 'highlight') {
      currentShapeRef.current = {
        id: generateId(), type: activeTool,
        x: pos.x, y: pos.y, width: 0, height: 0,
        color, strokeWidth,
      }
    } else if (activeTool === 'ellipse') {
      currentShapeRef.current = {
        id: generateId(), type: activeTool,
        x: pos.x, y: pos.y, radiusX: 0, radiusY: 0,
        color, strokeWidth,
        _startX: pos.x, _startY: pos.y,
      }
    } else if (activeTool === 'pen') {
      currentShapeRef.current = {
        id: generateId(), type: 'pen',
        points: [pos.x, pos.y],
        color, strokeWidth,
      }
    } else if (activeTool === 'text') {
      const newId = generateId()
      const newText = {
        id: newId, type: 'text',
        x: pos.x, y: pos.y,
        text: '',
        color, fontSize: 16,
      }
      pushHistory([...annotations, newText])
      setTextEditing({ id: newId, x: pos.x, y: pos.y, value: '', color, fontSize: 16 })
      isDrawingRef.current = false
      return
    } else if (activeTool === 'counter') {
      const newCounter = {
        id: generateId(), type: 'counter',
        x: pos.x, y: pos.y,
        count: counterCount, color,
      }
      setCounterCount((c) => c + 1)
      pushHistory([...annotations, newCounter])
      isDrawingRef.current = false
      return
    }

    if (currentShapeRef.current) {
      setAnnotations([...annotations, currentShapeRef.current])
    }
  }

  const handleMouseMove = (e) => {
    if (activeTool === 'eraser' && isDrawingRef.current) {
      const targetId = e.target?.id?.()
      if (targetId) {
        setAnnotations((prev) => {
          if (!prev.some((a) => a.id === targetId)) return prev
          return prev.filter((a) => a.id !== targetId)
        })
      }
      return
    }
    if (!isDrawingRef.current || !currentShapeRef.current) return
    const pos = getPointerPos(e)
    const shape = currentShapeRef.current

    if (shape.type === 'arrow' || shape.type === 'line') {
      const updated = { ...shape, points: [shape.points[0], shape.points[1], pos.x, pos.y] }
      currentShapeRef.current = updated
      setAnnotations((prev) => prev.map((a) => a.id === shape.id ? updated : a))
    } else if (shape.type === 'rect' || shape.type === 'highlight') {
      const updated = { ...shape, width: pos.x - shape.x, height: pos.y - shape.y }
      currentShapeRef.current = updated
      setAnnotations((prev) => prev.map((a) => a.id === shape.id ? updated : a))
    } else if (shape.type === 'ellipse') {
      const updated = {
        ...shape,
        radiusX: Math.abs(pos.x - shape._startX) / 2,
        radiusY: Math.abs(pos.y - shape._startY) / 2,
        x: (pos.x + shape._startX) / 2,
        y: (pos.y + shape._startY) / 2,
      }
      currentShapeRef.current = updated
      setAnnotations((prev) => prev.map((a) => a.id === shape.id ? updated : a))
    } else if (shape.type === 'pen') {
      const updated = { ...shape, points: [...shape.points, pos.x, pos.y] }
      currentShapeRef.current = updated
      setAnnotations((prev) => prev.map((a) => a.id === shape.id ? updated : a))
    }
  }

  const handleMouseUp = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    if (activeTool === 'eraser') {
      pushHistory([...annotations])
      return
    }
    if (currentShapeRef.current) {
      pushHistory([...annotations])
    }
    currentShapeRef.current = null
  }

  const canUndo = historyIdx > 0
  const canRedo = historyIdx < history.length - 1

  const stageWidth = captureData?.width ?? 800
  const stageHeight = captureData?.height ?? 600

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        color={color}
        onColorChange={setColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        ocrOpen={ocrOpen}
        onToggleOcr={() => setOcrOpen((v) => !v)}
      />

      <div className="flex flex-1 overflow-auto">
        <div
          className="flex-1 overflow-auto bg-muted flex items-start justify-start"
          style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
        >
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Stage
              width={stageWidth}
              height={stageHeight}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <Layer>
                {image && (
                  <KonvaImage image={image} x={0} y={0} width={stageWidth} height={stageHeight} />
                )}
              </Layer>
              <Layer>
                {annotations.map((shape) => (
                  shape.id === textEditing?.id
                    ? null
                    : <AnnotationShape key={shape.id} shape={shape} />
                ))}
              </Layer>
            </Stage>
            {textEditing && (
              <textarea
                ref={textareaRef}
                value={textEditing.value}
                onChange={(e) => setTextEditing((prev) => ({ ...prev, value: e.target.value }))}
                onBlur={commitTextEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setAnnotations((prev) => prev.filter((a) => a.id !== textEditing.id))
                    setTextEditing(null)
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    commitTextEdit()
                  }
                }}
                style={{
                  position: 'absolute',
                  left: textEditing.x,
                  top: textEditing.y,
                  minWidth: 120,
                  minHeight: 28,
                  fontSize: textEditing.fontSize,
                  color: textEditing.color,
                  background: 'rgba(0,0,0,0.55)',
                  border: '1px dashed ' + textEditing.color,
                  borderRadius: 3,
                  padding: '2px 4px',
                  outline: 'none',
                  resize: 'none',
                  overflow: 'hidden',
                  fontFamily: 'system-ui, sans-serif',
                  lineHeight: 1.4,
                  zIndex: 10,
                  whiteSpace: 'pre',
                }}
                rows={1}
                placeholder="Digite o texto…"
              />
            )}
          </div>
        </div>

        {ocrOpen && (
          <OcrPanel
            worker={workerRef.current}
            imageDataURL={captureData?.dataURL}
          />
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-background">
        <span className="text-sm text-muted-foreground truncate max-w-[300px]">
          {captureData ? `${captureData.width} × ${captureData.height}px` : ''}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={actions.discardCapture}
          >
            Descartar
          </Button>
          <DropdownMenu>
            <div className="flex items-center">
              <Button
                size="sm"
                className="rounded-r-none"
                onClick={() => actions.saveCapture({ dataURL: captureData?.dataURL, format: captureFormat })}
              >
                Salvar {captureFormat.toUpperCase()}
              </Button>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="rounded-l-none border-l border-primary-foreground/20 px-2">
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
            </div>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.setCaptureFormat('png')}>PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.setCaptureFormat('jpg')}>JPG</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
