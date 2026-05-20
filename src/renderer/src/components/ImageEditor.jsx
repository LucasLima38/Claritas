import { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Arrow, Rect, Ellipse, Line, Text, Group, Circle } from 'react-konva'
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
          x={-14} y={-7}
          width={28}
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
  const [counterCount, setCounterCount] = useState({})
  const [textEditing, setTextEditing] = useState(null) // { id, x, y, value, color, fontSize }
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [ocrRegion, setOcrRegion] = useState(null)
  const [ocrCroppedDataURL, setOcrCroppedDataURL] = useState(null)
  const [ocrAutoRunKey, setOcrAutoRunKey] = useState(0)
  const [ocrPanelWidth, setOcrPanelWidth] = useState(288)
  const [resolution, setResolution] = useState('normal')
  const ocrRegionStartRef = useRef(null)

  const isDrawingRef = useRef(false)
  const currentShapeRef = useRef(null)
  const textareaRef = useRef(null)
  const stageRef = useRef(null)
  const containerRef = useRef(null)
  const isCommittingRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
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

  const getPointerPos = () => {
    const stage = stageRef.current
    if (!stage) return null
    const pos = stage.getPointerPosition()
    if (!pos) return null
    return { x: pos.x / stage.scaleX(), y: pos.y / stage.scaleY() }
  }

  const handleOcrResizeMouseDown = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = ocrPanelWidth
    const onMove = (ev) => {
      const delta = startX - ev.clientX
      setOcrPanelWidth(Math.min(600, Math.max(220, startWidth + delta)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [ocrPanelWidth])

  const cropAndSetOcrRegion = useCallback((x, y, w, h) => {
    if (!captureData?.dataURL) return
    const img = new Image()
    img.onload = () => {
      const cvs = document.createElement('canvas')
      cvs.width = w
      cvs.height = h
      cvs.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h)
      setOcrCroppedDataURL(cvs.toDataURL('image/png'))
      setOcrAutoRunKey((k) => k + 1)
    }
    img.src = captureData.dataURL
  }, [captureData])

  const resolveAnnotationId = (e) => {
    const id = e.target?.id?.()
    if (id && annotations.some((a) => a.id === id)) return id
    const parentId = e.target?.getParent?.()?.id?.()
    if (parentId && annotations.some((a) => a.id === parentId)) return parentId
    return null
  }

  const handleSave = useCallback(() => {
    if (!stageRef.current) return
    const mimeType = captureFormat === 'jpg' ? 'image/jpeg' : 'image/png'
    const scale = stageRef.current.scaleX()
    const pixelRatio = scale > 0 ? 1 / scale : 1
    const dataURL = stageRef.current.toDataURL({ mimeType, pixelRatio, quality: 0.92 })
    actions.saveCapture({ dataURL, format: captureFormat, resolution })
  }, [captureFormat, resolution, actions])

  useEffect(() => {
    if (textEditing) {
      textareaRef.current?.focus()
    }
  }, [textEditing])

  const commitTextEdit = useCallback(() => {
    if (!textEditing || isCommittingRef.current) return
    isCommittingRef.current = true
    const updated = annotations
      .map((a) => a.id === textEditing.id ? { ...a, text: textEditing.value } : a)
      .filter((a) => !(a.id === textEditing.id && textEditing.value.trim() === ''))
    pushHistory(updated)
    setTextEditing(null)
  }, [textEditing, annotations, pushHistory])

  useEffect(() => {
    if (!textEditing) isCommittingRef.current = false
  }, [textEditing])

  const handleMouseDown = (e) => {
    if (textEditing) { commitTextEdit(); return }
    if (activeTool === 'select') return
    if (activeTool === 'ocr-region') {
      const pos = getPointerPos()
      if (!pos) return
      ocrRegionStartRef.current = pos
      setOcrRegion({ x: pos.x, y: pos.y, width: 0, height: 0 })
      return
    }
    if (activeTool === 'eraser') {
      isDrawingRef.current = true
      const targetId = resolveAnnotationId(e)
      if (targetId) {
        setAnnotations((prev) => prev.filter((a) => a.id !== targetId))
      }
      return
    }

    isDrawingRef.current = true
    const pos = getPointerPos()
    if (!pos) return

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
      const colorCount = (counterCount[color] ?? 0) + 1
      const newCounter = {
        id: generateId(), type: 'counter',
        x: pos.x, y: pos.y,
        count: colorCount, color,
      }
      setCounterCount((prev) => ({ ...prev, [color]: colorCount }))
      pushHistory([...annotations, newCounter])
      isDrawingRef.current = false
      return
    }

    if (currentShapeRef.current) {
      setAnnotations([...annotations, currentShapeRef.current])
    }
  }

  const handleMouseMove = (e) => {
    if (activeTool === 'ocr-region' && ocrRegionStartRef.current) {
      const pos = getPointerPos()
      if (!pos) return
      const start = ocrRegionStartRef.current
      setOcrRegion({ x: start.x, y: start.y, width: pos.x - start.x, height: pos.y - start.y })
      return
    }
    if (activeTool === 'eraser' && isDrawingRef.current) {
      const targetId = resolveAnnotationId(e)
      if (targetId) {
        setAnnotations((prev) => prev.filter((a) => a.id !== targetId))
      }
      return
    }
    if (!isDrawingRef.current || !currentShapeRef.current) return
    const pos = getPointerPos()
    if (!pos) return
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
    if (activeTool === 'ocr-region') {
      if (ocrRegion) {
        const rx = ocrRegion.width >= 0 ? ocrRegion.x : ocrRegion.x + ocrRegion.width
        const ry = ocrRegion.height >= 0 ? ocrRegion.y : ocrRegion.y + ocrRegion.height
        const rw = Math.abs(ocrRegion.width)
        const rh = Math.abs(ocrRegion.height)
        if (rw > 5 && rh > 5) {
          cropAndSetOcrRegion(rx, ry, rw, rh)
          setOcrOpen(true)
        }
      }
      ocrRegionStartRef.current = null
      return
    }
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

  const fitScale = containerSize.width > 0 && containerSize.height > 0
    ? Math.min(1, containerSize.width / stageWidth, containerSize.height / stageHeight)
    : 1

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
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
        onToggleOcr={() => {
          setOcrOpen((v) => {
            if (v) {
              setOcrRegion(null)
              setOcrCroppedDataURL(null)
              setOcrAutoRunKey(0)
              setActiveTool('select')
            } else {
              setActiveTool('ocr-region')
            }
            return !v
          })
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden bg-muted relative"
          style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
        >
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <Stage
              ref={stageRef}
              width={Math.round(stageWidth * fitScale)}
              height={Math.round(stageHeight * fitScale)}
              scaleX={fitScale}
              scaleY={fitScale}
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
              {ocrRegion && (
                <Layer>
                  <Rect
                    x={ocrRegion.x} y={ocrRegion.y}
                    width={ocrRegion.width} height={ocrRegion.height}
                    stroke="#3b82f6"
                    strokeWidth={2 / fitScale}
                    dash={[8 / fitScale, 4 / fitScale]}
                    fill="rgba(59, 130, 246, 0.1)"
                    listening={false}
                  />
                </Layer>
              )}
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
                  left: textEditing.x * fitScale,
                  top: textEditing.y * fitScale,
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
                autoFocus
                placeholder="Digite o texto…"
              />
            )}
          </div>
        </div>

        {ocrOpen && (
          <div className="shrink-0 flex h-full" style={{ width: ocrPanelWidth }}>
            <div
              className="w-1.5 h-full cursor-col-resize shrink-0 hover:bg-primary/20 transition-colors select-none"
              onMouseDown={handleOcrResizeMouseDown}
              title="Arraste para redimensionar"
            />
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <OcrPanel
                key={ocrAutoRunKey}
                runOcr={() => window.electronAPI.runOcr(ocrCroppedDataURL ?? captureData?.dataURL)}
                autoRun={ocrAutoRunKey > 0}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-background">
        <span className="text-sm text-muted-foreground truncate max-w-[300px]">
          {captureData ? `${captureData.width} × ${captureData.height}px` : ''}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Resolução</span>
            <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
              {[
                { value: 'low', label: 'Baixa' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'Alta' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={resolution === value}
                  onClick={() => setResolution(value)}
                  className={`text-[11px] font-semibold px-2 py-1 rounded transition-all ${
                    resolution === value
                      ? 'bg-background text-green-600 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
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
                onClick={handleSave}
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
