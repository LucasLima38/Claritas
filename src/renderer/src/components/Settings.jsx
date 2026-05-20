import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, FolderOpen, Check, Loader2, Share2, ExternalLink, FolderPlus, Folder, ChevronRight, HardDrive, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { useApp } from '../context/AppContext.jsx'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PROJECT_COLORS = ['#2f81f7', '#27c93f', '#ff9f43', '#e74c3c', '#9b59b6', '#1abc9c']

function BehaviorRow({ label, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-[12.5px] font-medium">{label}</p>
        <p className="text-[10.5px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="app-region-no-drag shrink-0" />
    </div>
  )
}

function ShortcutRecorder({ value, onChange }) {
  const [recording, setRecording] = useState(false)

  function handleKeyDown(e) {
    e.preventDefault()
    if (e.key === 'Escape') { setRecording(false); return }
    const mods = []
    if (e.ctrlKey)  mods.push('Ctrl')
    if (e.altKey)   mods.push('Alt')
    if (e.shiftKey) mods.push('Shift')
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
    // Ignore bare modifier keys — wait for an additional non-modifier key
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return
    // Require at least one modifier
    if (mods.length === 0) return
    const combo = [...mods, key].join('+')
    onChange(combo)
    setRecording(false)
  }

  return (
    <div className="flex gap-2 items-center">
      <div
        tabIndex={0}
        onFocus={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={recording ? handleKeyDown : undefined}
        className="h-7 px-2.5 rounded-md border border-border text-xs flex items-center min-w-[140px] cursor-pointer bg-background focus:ring-1 focus:ring-primary focus:outline-none"
      >
        {recording
          ? <span className="text-muted-foreground italic">Pressione as teclas…</span>
          : (value || <span className="text-muted-foreground">Nenhum</span>)
        }
      </div>
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => onChange('')}
        >
          Limpar
        </Button>
      )}
    </div>
  )
}

function DriveFolderBrowser({ onSelectLocation, onSelectExisting }) {
  const { state } = useApp()
  const ROOT = { id: null, name: 'Meu Drive' }
  const [stack, setStack] = useState([ROOT])
  const [cache, setCache] = useState({})
  const [loadingKey, setLoadingKey] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [creating, setCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [savingFolder, setSavingFolder] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const current = stack[stack.length - 1]
  const cacheKey = current.id ?? '__root__'
  const rawFolders = cache[cacheKey]
  const loading = loadingKey === cacheKey

  const folders = useMemo(() => {
    if (!rawFolders) return rawFolders
    return [...rawFolders].sort((a, b) => {
      const cmp =
        sortBy === 'name'
          ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          : (a.modifiedTime ?? '').localeCompare(b.modifiedTime ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rawFolders, sortBy, sortDir])

  useEffect(() => {
    if (state.account) fetchLevel(null, '__root__')
  }, [state.account])

  async function fetchLevel(parentId, key) {
    if (!state.account) return
    if (cache[key] !== undefined) return
    setLoadingKey(key)
    setFetchError(null)
    try {
      const result = await window.electronAPI.driveListFolders(parentId)
      setLoadingKey(null)
      if (result.ok) {
        setCache((c) => ({ ...c, [key]: result.folders }))
      } else {
        setFetchError(result.error ?? 'Erro ao listar pastas')
      }
    } catch {
      setLoadingKey(null)
      setFetchError('Erro ao listar pastas')
    }
  }

  function enter(folder) {
    setStack((s) => [...s, { id: folder.id, name: folder.name }])
    fetchLevel(folder.id, folder.id)
    setCreating(false)
    setNewFolderName('')
  }

  function goBack() {
    if (stack.length <= 1) return
    setStack((s) => s.slice(0, -1))
    setCreating(false)
    setNewFolderName('')
  }

  function toggleSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    setSavingFolder(true)
    try {
      const result = await window.electronAPI.driveCreateFolder(current.id, name)
      if (result.ok) {
        setCache((c) => {
          const next = { ...c }
          delete next[cacheKey]
          return next
        })
        setCreating(false)
        setNewFolderName('')
        setLoadingKey(cacheKey)
        const res = await window.electronAPI.driveListFolders(current.id)
        setLoadingKey(null)
        if (res.ok) setCache((c) => ({ ...c, [cacheKey]: res.folders }))
      } else {
        toast.error(result.error ?? 'Erro ao criar pasta')
      }
    } catch {
      toast.error('Erro ao criar pasta')
    } finally {
      setSavingFolder(false)
    }
  }

  async function handleDeleteFolder(folderId) {
    setDeletingId(folderId)
    try {
      const result = await window.electronAPI.driveDeleteFolder(folderId)
      if (result.ok) {
        setCache((c) => {
          const next = { ...c }
          delete next[cacheKey]
          return next
        })
        setConfirmDeleteId(null)
        setLoadingKey(cacheKey)
        const res = await window.electronAPI.driveListFolders(current.id)
        setLoadingKey(null)
        if (res.ok) setCache((c) => ({ ...c, [cacheKey]: res.folders }))
        toast.success('Pasta excluída')
      } else {
        toast.error(result.error ?? 'Erro ao excluir pasta')
      }
    } catch {
      toast.error('Erro ao excluir pasta')
    } finally {
      setDeletingId(null)
    }
  }

  function formatDate(iso) {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(iso))
    } catch {
      return '—'
    }
  }

  function SortIcon({ col }) {
    if (sortBy !== col)
      return <ChevronsUpDown size={9} className="text-muted-foreground/50 ml-0.5 shrink-0" />
    return sortDir === 'asc' ? (
      <ChevronUp size={9} className="text-foreground ml-0.5 shrink-0" />
    ) : (
      <ChevronDown size={9} className="text-foreground ml-0.5 shrink-0" />
    )
  }

  if (!state.account) return null

  return (
    <div className="flex flex-col rounded-md border border-border bg-background overflow-hidden">
      {/* Header: back + current location */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
        <button
          className={cn(
            'flex items-center justify-center h-5 w-5 rounded hover:bg-accent transition-colors',
            stack.length <= 1 && 'opacity-30 pointer-events-none'
          )}
          onClick={goBack}
          disabled={stack.length <= 1}
        >
          <ArrowLeft size={11} />
        </button>
        <HardDrive size={11} className="text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium text-foreground truncate flex-1">{current.name}</span>
      </div>

      {/* Section label */}
      <div className="px-2 pt-1.5 pb-0.5">
        <span className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Meu Drive
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-2 py-0.5 border-b border-border/50">
        <button
          className="flex items-center flex-1 text-[9.5px] text-muted-foreground hover:text-foreground font-medium"
          onClick={() => toggleSort('name')}
        >
          Nome
          <SortIcon col="name" />
        </button>
        <button
          className="flex items-center text-[9.5px] text-muted-foreground hover:text-foreground font-medium w-[90px] justify-end"
          onClick={() => toggleSort('modifiedTime')}
        >
          <SortIcon col="modifiedTime" />
          Modificado
        </button>
      </div>

      {/* Folder rows */}
      <div className="max-h-[140px] overflow-y-auto flex flex-col">
        {loading && (
          <div className="flex items-center justify-center py-3">
            <Loader2 size={13} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && fetchError && (
          <p className="text-[10px] text-destructive text-center py-3">{fetchError}</p>
        )}
        {!loading && !fetchError && folders?.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-3">Nenhuma pasta</p>
        )}
        {folders?.map((f) => (
          <div key={f.id} className="group flex items-center gap-1.5 px-2 py-1 hover:bg-accent">
            {confirmDeleteId === f.id ? (
              <>
                <Trash2 size={11} className="text-destructive shrink-0" />
                <span className="text-[10.5px] flex-1 text-destructive truncate min-w-0">
                  Excluir &quot;{f.name}&quot;?
                </span>
                <button
                  onClick={() => handleDeleteFolder(f.id)}
                  disabled={deletingId === f.id}
                  className="text-[10px] text-destructive hover:underline shrink-0 disabled:opacity-50"
                >
                  {deletingId === f.id
                    ? <Loader2 size={10} className="animate-spin" />
                    : 'Confirmar'}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 ml-1"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  onClick={() => enter(f)}
                >
                  <Folder size={11} className="text-muted-foreground shrink-0" />
                  <span className="text-[11px] flex-1 truncate">{f.name}</span>
                </button>
                <span className="text-[10px] text-muted-foreground w-[70px] text-right shrink-0 group-hover:hidden">
                  {formatDate(f.modifiedTime)}
                </span>
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  {onSelectExisting && (
                    <button
                      onClick={() => onSelectExisting(f)}
                      className="text-[9.5px] text-primary hover:underline px-1 shrink-0"
                      title="Selecionar esta pasta"
                    >
                      Selecionar
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDeleteId(f.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0.5 rounded"
                    title="Excluir pasta"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Inline new folder input */}
      {creating && (
        <div className="flex items-center gap-1.5 px-2 py-1 border-t border-border/50">
          <Folder size={11} className="text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder()
              if (e.key === 'Escape') {
                setCreating(false)
                setNewFolderName('')
              }
            }}
            placeholder="Nome da pasta"
            className="flex-1 text-[11px] bg-transparent border-none outline-none placeholder:text-muted-foreground/60 min-w-0"
          />
          {savingFolder ? (
            <Loader2 size={11} className="animate-spin text-muted-foreground shrink-0" />
          ) : (
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="text-[10px] text-primary hover:underline shrink-0 disabled:opacity-40"
            >
              Criar
            </button>
          )}
          <button
            onClick={() => {
              setCreating(false)
              setNewFolderName('')
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between px-2 py-1.5 border-t border-border">
        <button
          className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => {
            setCreating(true)
            setNewFolderName('')
          }}
        >
          <FolderPlus size={11} />
          Nova pasta
        </button>
        <Button
          size="sm"
          className="h-6 px-2.5 text-[10.5px] gap-1"
          onClick={() => onSelectLocation(current)}
        >
          <Check size={10} />
          Criar pasta aqui
        </Button>
      </div>
    </div>
  )
}

function DriveProjectSection({ projectId, form, setForm, required = false }) {
  const { state, actions } = useApp()
  const [shareEmail, setShareEmail] = useState('')
  const [sharing, setSharing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const [pendingParent, setPendingParent] = useState(null)

  if (!state.account) return null

  async function handleConfirmCreate() {
    setCreating(true)
    const result = await actions.driveCreateProjectFolder(projectId, pendingParent.id)
    setCreating(false)
    if (result.ok) {
      setForm((f) => ({ ...f, driveFolderId: result.folderId, driveFolderUrl: result.folderUrl }))
      setBrowsing(false)
      setPendingParent(null)
      toast.success('Pasta criada no Drive')
    } else {
      toast.error(result.error ?? 'Erro ao criar pasta no Drive')
    }
  }

  function handleSelectExisting(folder) {
    setForm((f) => ({ ...f, driveFolderId: folder.id, driveFolderUrl: folder.webViewLink }))
    setBrowsing(false)
    setPendingParent(null)
    toast.success('Pasta vinculada ao projeto')
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <Separator />
      {form.driveFolderId ? (
        browsing ? (
          <>
            <Label className="text-[10.5px]">Escolher nova localização</Label>
            <DriveFolderBrowser onSelectLocation={(f) => setPendingParent(f)} onSelectExisting={handleSelectExisting} />
            {pendingParent && (
              <div className="flex items-center justify-between rounded-md border border-border bg-accent/30 px-2.5 py-1.5">
                <span className="text-[10.5px]">
                  Criar em <span className="font-medium">{pendingParent.name}</span>?
                </span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                    onClick={() => setPendingParent(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="h-6 px-2 text-xs gap-1"
                    disabled={creating} onClick={handleConfirmCreate}>
                    {creating && <Loader2 size={10} className="animate-spin" />}
                    Criar
                  </Button>
                </div>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs self-start px-1 text-muted-foreground"
              onClick={() => { setBrowsing(false); setPendingParent(null) }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Folder size={11} className="text-muted-foreground shrink-0" />
                <span className="text-[10.5px] text-muted-foreground">Pasta no Drive vinculada</span>
                <button
                  className="text-[10.5px] text-primary flex items-center gap-0.5 hover:underline"
                  onClick={() => window.electronAPI.openExternal(form.driveFolderUrl)}
                >
                  Abrir <ExternalLink size={9} />
                </button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10.5px]"
                onClick={() => setBrowsing(true)}
              >
                Trocar
              </Button>
            </div>
            <Label className="text-[10.5px]">Compartilhar com colaborador</Label>
            <div className="flex gap-1.5">
              <Input
                className="h-7 text-xs flex-1"
                placeholder="colaborador@empresa.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs shrink-0"
                disabled={sharing || !shareEmail}
                onClick={async () => {
                  setSharing(true)
                  const result = await actions.driveShareProjectFolder(projectId, shareEmail)
                  setSharing(false)
                  if (result.ok) {
                    toast.success(`Pasta compartilhada com ${shareEmail}`, {
                      action: result.webViewLink
                        ? { label: 'Copiar link', onClick: () => navigator.clipboard.writeText(result.webViewLink) }
                        : undefined,
                    })
                    setShareEmail('')
                  } else {
                    toast.error(result.error ?? 'Erro ao compartilhar')
                  }
                }}
              >
                {sharing ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                <span className="ml-1">Compartilhar</span>
              </Button>
            </div>
          </>
        )
      ) : (
        <>
          <Label className="text-[10.5px]">Pasta no Google Drive{!required && ' (opcional)'}</Label>
          <DriveFolderBrowser onSelectLocation={(f) => setPendingParent(f)} onSelectExisting={handleSelectExisting} />
          {pendingParent && (
            <div className="flex items-center justify-between rounded-md border border-border bg-accent/30 px-2.5 py-1.5">
              <span className="text-[10.5px]">
                Criar em <span className="font-medium">{pendingParent.name}</span>?
              </span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                  onClick={() => setPendingParent(null)}>
                  Cancelar
                </Button>
                <Button size="sm" className="h-6 px-2 text-xs gap-1"
                  disabled={creating} onClick={handleConfirmCreate}>
                  {creating && <Loader2 size={10} className="animate-spin" />}
                  Criar
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SortableProjectCard({ p, activeProjectId, editingId, form, onEdit, onDelete, onSetActive, setForm, chooseDir, submitForm, setEditingId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={cn(
          'flex items-center gap-3 p-2.5 cursor-pointer transition-colors hover:bg-accent/60',
          p.id === activeProjectId && 'bg-accent border-primary/30'
        )}
        onClick={() => onSetActive(p.id)}
        {...attributes}
        {...listeners}
      >
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-medium truncate">{p.name}</span>
            <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4">
              {p.prefix}
            </Badge>
          </div>
          <p className="text-[10.5px] text-muted-foreground truncate flex items-center gap-0.5">
            {p.outputMode === 'drive'
              ? (p.driveFolderUrl
                  ? <><Folder size={10} className="shrink-0" /><span>Drive</span></>
                  : 'Drive — sem pasta')
              : (p.outputDir || 'Sem pasta')}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
          {p.id === activeProjectId && (
            <Check size={13} className="text-emerald-600 shrink-0" />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={() => onEdit(p)}
          >
            <Pencil size={11} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(p.id)}
          >
            <Trash2 size={11} />
          </Button>
        </div>
      </Card>
      {editingId === p.id && form && (
        <Card className="border-primary p-3 bg-accent/30 flex flex-col gap-2.5 mt-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[10.5px]">Nome do projeto</Label>
              <Input
                className="h-7 text-xs"
                placeholder="Motor BLDC"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10.5px]">Prefixo</Label>
              <Input
                className="h-7 text-xs"
                placeholder="BLDC_"
                value={form.prefix}
                onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] text-muted-foreground flex-1">Destino de saída</span>
            <Button
              size="sm"
              variant={form.outputMode !== 'drive' ? 'default' : 'outline'}
              className="h-6 px-2.5 text-xs"
              onClick={() => setForm((f) => ({ ...f, outputMode: 'local' }))}
            >
              Local
            </Button>
            <Button
              size="sm"
              variant={form.outputMode === 'drive' ? 'default' : 'outline'}
              className="h-6 px-2.5 text-xs"
              onClick={() => setForm((f) => ({ ...f, outputMode: 'drive' }))}
            >
              Drive
            </Button>
          </div>
          {form.outputMode !== 'drive' && (
            <div className="flex flex-col gap-1">
              <Label className="text-[10.5px]">Pasta de saída</Label>
              <div className="flex gap-1.5">
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="D:\Projetos\..."
                  value={form.outputDir}
                  onChange={(e) => setForm((f) => ({ ...f, outputDir: e.target.value }))}
                />
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={chooseDir}>
                  <FolderOpen size={12} className="mr-1" /> Explorar
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10.5px]">Cor</Label>
            <div className="flex gap-2 mt-0.5">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className="w-5 h-5 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: form.color === c ? 'hsl(var(--foreground))' : 'transparent' }}
                />
              ))}
            </div>
          </div>
          {form.outputMode === 'drive' && (
            <DriveProjectSection projectId={p.id} form={form} setForm={setForm} required />
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs" onClick={submitForm}>
              Salvar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => { setEditingId(null); setForm(null) }}
            >
              Cancelar
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export default function Settings({ onBack }) {
  const { state, actions } = useApp()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [launchOnStartup, setLaunchOnStartup] = useState(false)

  // Load OS login-item state on mount
  useEffect(() => {
    window.electronAPI.getLoginItemSettings()
      .then(({ openAtLogin }) => setLaunchOnStartup(openAtLogin))
      .catch(() => setLaunchOnStartup(false))
  }, [])

  async function handleLaunchOnStartup(value) {
    setLaunchOnStartup(value)
    await window.electronAPI.setLoginItemSettings({ openAtLogin: value })
  }

  function openAdd() {
    setForm({ id: crypto.randomUUID(), name: '', prefix: '', outputDir: '', outputMode: 'local', counter: 0, color: PROJECT_COLORS[0] })
    setEditingId('new')
  }

  function openEdit(project) {
    setForm({ outputMode: 'local', ...project })
    setEditingId(project.id)
  }

  async function submitForm() {
    const mode = form.outputMode
    if (!form.name || !form.prefix) {
      toast.error('Preencha nome e prefixo')
      return
    }
    if (mode === 'local' && !form.outputDir) {
      toast.error('Preencha a pasta de saída')
      return
    }
    if (mode === 'drive' && !form.driveFolderId) {
      toast.error('Configure a pasta do Drive antes de salvar')
      return
    }
    if (editingId === 'new') {
      await actions.addProject({
        ...form,
        outputMode: mode,
        ...(mode === 'local'
          ? { driveFolderId: null, driveFolderUrl: null }
          : { outputDir: '' }),
      })
    } else {
      const updates = {
        name: form.name,
        prefix: form.prefix,
        color: form.color,
        outputMode: mode,
        ...(mode === 'local'
          ? { outputDir: form.outputDir, driveFolderId: null, driveFolderUrl: null }
          : { outputDir: '', driveFolderId: form.driveFolderId, driveFolderUrl: form.driveFolderUrl }),
      }
      await actions.updateProject(editingId, updates)
    }
    setEditingId(null)
    setForm(null)
  }

  async function chooseDir() {
    const result = await window.electronAPI.chooseDirectory()
    if (!result.canceled) setForm((f) => ({ ...f, outputDir: result.path }))
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } })
  )

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = state.projects.findIndex((p) => p.id === active.id)
    const newIndex = state.projects.findIndex((p) => p.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const newOrder = arrayMove(state.projects, oldIndex, newIndex)
    await actions.reorderProjects(newOrder.map((p) => p.id))
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="app-region-no-drag h-7 px-2 text-xs text-muted-foreground gap-1"
        >
          <ArrowLeft size={14} /> Voltar
        </Button>
        <h2 className="text-sm font-semibold">Configurações</h2>
      </div>

      <div className="p-5 flex flex-col gap-6 w-full max-w-2xl mx-auto">

        {/* Projects section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Projetos</p>

          <div className="flex flex-col gap-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={state.projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {state.projects.map((p) => (
                  <SortableProjectCard
                    key={p.id}
                    p={p}
                    activeProjectId={state.activeProjectId}
                    editingId={editingId}
                    form={form}
                    onEdit={openEdit}
                    onDelete={actions.deleteProject}
                    onSetActive={actions.setActiveProject}
                    setForm={setForm}
                    chooseDir={chooseDir}
                    submitForm={submitForm}
                    setEditingId={setEditingId}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {editingId === 'new' ? (
              <Card className="border-primary p-3 bg-accent/30 flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10.5px]">Nome do projeto</Label>
                    <Input
                      className="h-7 text-xs"
                      placeholder="Motor BLDC"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10.5px]">Prefixo</Label>
                    <Input
                      className="h-7 text-xs"
                      placeholder="BLDC_"
                      value={form.prefix}
                      onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
                    />
                  </div>
                </div>
                {/* New projects always start in local mode — drive mode requires an
                    existing projectId so the DriveProjectSection can link folders. */}
                <div className="flex flex-col gap-1">
                  <Label className="text-[10.5px]">Pasta de saída</Label>
                  <div className="flex gap-1.5">
                    <Input
                      className="h-7 text-xs flex-1"
                      placeholder="D:\Projetos\..."
                      value={form.outputDir}
                      onChange={(e) => setForm((f) => ({ ...f, outputDir: e.target.value }))}
                    />
                    <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={chooseDir}>
                      <FolderOpen size={12} className="mr-1" /> Explorar
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10.5px]">Cor</Label>
                  <div className="flex gap-2 mt-0.5">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className="w-5 h-5 rounded-full border-2 transition-all"
                        style={{ background: c, borderColor: form.color === c ? 'hsl(var(--foreground))' : 'transparent' }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="h-7 text-xs" onClick={submitForm}>
                    Adicionar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setEditingId(null); setForm(null) }}
                  >
                    Cancelar
                  </Button>
                </div>
              </Card>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={openAdd}
                className="border-dashed justify-start gap-2 text-xs text-muted-foreground h-9"
              >
                <Plus size={13} /> Adicionar projeto
              </Button>
            )}
          </div>
        </section>

        <Separator />

        {/* Comportamento section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Comportamento</p>
          <div className="flex flex-col divide-y divide-border">
            <BehaviorRow
              label="Iniciar com o Windows"
              description="Inicia automaticamente ao fazer login"
              checked={launchOnStartup}
              onCheckedChange={handleLaunchOnStartup}
            />
            <BehaviorRow
              label="Iniciar minimizado"
              description="Abre sem exibir a janela (apenas bandeja)"
              checked={state.settings.startMinimized ?? false}
              onCheckedChange={(v) => actions.updateSettings({ startMinimized: v })}
            />
            <BehaviorRow
              label="Botão fechar oculta o app"
              description="× mantém o app rodando na bandeja do sistema"
              checked={state.settings.closeHides ?? true}
              onCheckedChange={(v) => actions.updateSettings({ closeHides: v })}
            />
          </div>
        </section>

        <Separator />

        {/* Atalho global */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Atalho global</p>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10.5px]">Abrir preview (funciona mesmo com o app minimizado)</Label>
            <ShortcutRecorder
              value={state.settings.globalShortcut ?? ''}
              onChange={(v) => actions.updateSettings({ globalShortcut: v })}
            />
            <p className="text-[10.5px] text-muted-foreground mt-1">
              Ex: Ctrl+Shift+S · Requer ao menos um modificador (Ctrl, Alt ou Shift)
            </p>
          </div>
        </section>

        <Separator />

        {/* Aparência section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Aparência</p>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10.5px]">Tema</Label>
            <Select
              value={state.settings.theme ?? 'system'}
              onValueChange={(value) => actions.updateSettings({ theme: value })}
            >
              <SelectTrigger className="h-7 text-xs w-56 app-region-no-drag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Sistema (padrão)</SelectItem>
                <SelectItem value="black-moon">Black Moon</SelectItem>
                <SelectItem value="blue-moon">Blue Moon</SelectItem>
                <SelectItem value="charcoal">Charcoal</SelectItem>
                <SelectItem value="claritas">Claritas</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="snnabb">Snnabb</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10.5px] text-muted-foreground mt-1">
              "Sistema" segue automaticamente a configuração do Windows.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
