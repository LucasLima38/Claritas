import {
  MousePointer, ArrowUpRight, Square, Circle, Minus, Pen,
  Type, Highlighter, Eraser, Hash, ScanFace, Crop, Maximize, Scan,
  Undo2, Redo2
} from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

const DRAW_TOOLS = [
  { value: 'select',      icon: MousePointer,  label: 'Cursor' },
  { value: 'arrow',       icon: ArrowUpRight,  label: 'Seta' },
  { value: 'rect',        icon: Square,        label: 'Retângulo' },
  { value: 'ellipse',     icon: Circle,        label: 'Elipse' },
  { value: 'line',        icon: Minus,         label: 'Linha' },
  { value: 'pen',         icon: Pen,           label: 'Pincel' },
  { value: 'text',        icon: Type,          label: 'Texto' },
  { value: 'highlight',   icon: Highlighter,   label: 'Highlight' },
  { value: 'eraser',      icon: Eraser,        label: 'Borracha' },
  { value: 'counter',     icon: Hash,          label: 'Contador' },
  { value: 'blur',        icon: ScanFace,      label: 'Blur' },
  { value: 'crop',        icon: Crop,          label: 'Crop' },
  { value: 'resize',      icon: Maximize,      label: 'Redimensionar' },
]

const PALETTE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#000000',
  '#ffffff', '#64748b',
]

/**
 * Props:
 *   activeTool        — current tool id (string)
 *   onToolChange      — (tool: string) => void
 *   color             — current stroke/fill color (hex string)
 *   onColorChange     — (color: string) => void
 *   strokeWidth       — current stroke width (1–20)
 *   onStrokeWidthChange — (width: number) => void
 *   canUndo           — boolean
 *   canRedo           — boolean
 *   onUndo            — () => void
 *   onRedo            — () => void
 *   ocrOpen           — boolean
 *   onToggleOcr       — () => void
 */
export function EditorToolbar({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  ocrOpen,
  onToggleOcr,
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-background border-b border-border flex-wrap">
      {/* Drawing tools */}
      <ToggleGroup
        type="single"
        value={activeTool}
        onValueChange={(v) => v && onToolChange(v)}
        className="flex gap-0.5"
      >
        {DRAW_TOOLS.map(({ value, icon: Icon, label }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={label}
            title={label}
            className="w-8 h-8 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <Icon size={15} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* OCR toggle — separated visually */}
      <Button
        variant={ocrOpen ? 'default' : 'ghost'}
        size="sm"
        onClick={onToggleOcr}
        title="OCR — extrair texto"
        className="w-8 h-8 p-0"
        aria-label="OCR"
      >
        <Scan size={15} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Color picker */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-7 h-7 rounded border-2 border-border hover:border-primary transition-colors"
            style={{ background: color }}
            aria-label="Cor"
            title="Cor"
          />
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3">
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {PALETTE_COLORS.map((c) => (
              <button
                key={c}
                className="w-7 h-7 rounded border border-border hover:scale-110 transition-transform"
                style={{ background: c }}
                onClick={() => onColorChange(c)}
                aria-label={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">#</span>
            <Input
              value={color.replace('#', '')}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
                if (v.length === 6) onColorChange('#' + v)
              }}
              className="h-7 text-xs font-mono"
              maxLength={6}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Stroke width */}
      <div className="flex items-center gap-2 w-28" title="Espessura">
        <span className="text-xs text-muted-foreground shrink-0">
          {strokeWidth}px
        </span>
        <Slider
          min={1}
          max={20}
          step={1}
          value={[strokeWidth]}
          onValueChange={([v]) => onStrokeWidthChange(v)}
          className="w-20"
        />
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Undo / Redo */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onUndo}
        disabled={!canUndo}
        title="Desfazer (Ctrl+Z)"
        className="w-8 h-8 p-0"
      >
        <Undo2 size={15} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRedo}
        disabled={!canRedo}
        title="Refazer (Ctrl+Y)"
        className="w-8 h-8 p-0"
      >
        <Redo2 size={15} />
      </Button>
    </div>
  )
}
