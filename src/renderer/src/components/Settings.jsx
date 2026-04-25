import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, FolderOpen, Check } from 'lucide-react'
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
    setForm({ id: crypto.randomUUID(), name: '', prefix: '', outputDir: '', counter: 0, color: PROJECT_COLORS[0] })
    setEditingId('new')
  }

  function openEdit(project) {
    setForm({ ...project })
    setEditingId(project.id)
  }

  async function submitForm() {
    if (!form.name || !form.prefix || !form.outputDir) return
    if (editingId === 'new') {
      await actions.addProject(form)
    } else {
      await actions.updateProject(editingId, { name: form.name, prefix: form.prefix, outputDir: form.outputDir, color: form.color })
    }
    setEditingId(null)
    setForm(null)
  }

  async function chooseDir() {
    const result = await window.electronAPI.chooseDirectory()
    if (!result.canceled) setForm((f) => ({ ...f, outputDir: result.path }))
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
            {state.projects.map((p) => (
              <div key={p.id}>
                <Card
                  className={cn(
                    'flex items-center gap-3 p-2.5 cursor-pointer transition-colors hover:bg-accent/60',
                    p.id === state.activeProjectId && 'bg-accent border-primary/30'
                  )}
                  onClick={() => actions.setActiveProject(p.id)}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-medium truncate">{p.name}</span>
                      <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4">
                        {p.prefix}
                      </Badge>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground truncate">{p.outputDir || 'Sem pasta'}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                    {p.id === state.activeProjectId && (
                      <Check size={13} className="text-emerald-600 shrink-0" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil size={11} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 text-destructive hover:text-destructive"
                      onClick={() => actions.deleteProject(p.id)}
                    >
                      <Trash2 size={11} />
                    </Button>
                  </div>
                </Card>
                {editingId === p.id && (
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
            ))}

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
