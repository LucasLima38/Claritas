import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, CheckCircle2, FolderOpen, Loader2 } from 'lucide-react'
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

export default function Settings({ onBack }) {
  const { state, actions } = useApp()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [inkPath, setInkPath] = useState(state.settings.inkscapePath || '')
  const [inkStatus, setInkStatus] = useState(state.settings.inkscapePath ? 'saved' : 'unset')
  const [inkVersion, setInkVersion] = useState(null)
  const [inkChecking, setInkChecking] = useState(false)
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

  async function saveInkscape() {
    await actions.updateSettings({ inkscapePath: inkPath })
    setInkStatus('saved')
    setInkVersion(null)
  }

  async function checkInkscape() {
    if (!inkPath) return
    setInkChecking(true)
    setInkVersion(null)
    const result = await window.electronAPI.checkInkscapeVersion({ path: inkPath })
    setInkChecking(false)
    if (result.ok) {
      setInkVersion({ ok: true, text: `Inkscape ${result.version}` })
    } else {
      setInkVersion({ ok: false, text: 'Não encontrado ou inválido' })
    }
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

      <div className="p-5 flex flex-col gap-6 max-w-2xl">

        {/* Projects section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Projetos</p>

          <div className="flex flex-col gap-2">
            {state.projects.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 p-2.5 rounded-md border',
                  p.id === state.activeProjectId
                    ? 'bg-accent border-primary/30'
                    : 'bg-card border-border'
                )}
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
                <div className="flex gap-1.5 shrink-0">
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
              </div>
            ))}

            {/* Add / Edit form */}
            {editingId ? (
              <div className="border border-primary rounded-md p-3 bg-accent/30 flex flex-col gap-2.5">
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
                    {editingId === 'new' ? 'Adicionar' : 'Salvar'}
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
              </div>
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

        {/* Inkscape section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Inkscape</p>
          <div className="flex gap-2">
            <Input
              className="flex-1 font-mono text-xs h-7"
              placeholder="C:\Program Files\Inkscape\bin\inkscape.exe"
              value={inkPath}
              onChange={(e) => { setInkPath(e.target.value); setInkStatus('dirty'); setInkVersion(null) }}
            />
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={saveInkscape}>
              Salvar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={checkInkscape}
              disabled={inkChecking || !inkPath}
            >
              {inkChecking ? <Loader2 size={11} className="animate-spin" /> : 'Verificar'}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {inkStatus === 'saved' && inkPath && !inkVersion && (
              <p className="text-[10.5px] text-primary flex items-center gap-1">
                <CheckCircle2 size={11} /> Inkscape configurado
              </p>
            )}
            {inkVersion && (
              <Badge variant={inkVersion.ok ? 'default' : 'destructive'} className="text-[10px] gap-1">
                {inkVersion.ok ? <CheckCircle2 size={10} /> : null}
                {inkVersion.text}
              </Badge>
            )}
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
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="snnabb">Snnabb</SelectItem>
                <SelectItem value="charcoal">Charcoal</SelectItem>
                <SelectItem value="black-moon">Black Moon</SelectItem>
                <SelectItem value="blue-moon">Blue Moon</SelectItem>
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
