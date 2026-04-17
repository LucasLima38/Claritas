import { useState } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, CheckCircle2, FolderOpen, Sun, Moon, Monitor } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const PROJECT_COLORS = ['#2f81f7', '#27c93f', '#ff9f43', '#e74c3c', '#9b59b6', '#1abc9c']

export default function Settings({ onBack }) {
  const { state, actions } = useApp()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [inkPath, setInkPath] = useState(state.settings.inkscapePath || '')
  const [inkStatus, setInkStatus] = useState(state.settings.inkscapePath ? 'saved' : 'unset')

  // ── Project form ──────────────────────────────────────────────────────────

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
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e9e9e7] dark:border-[#2e2e2e]">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-[#9b9a97] hover:text-[#37352f] dark:hover:text-[#e6e6e3]">
          <ArrowLeft size={14} /> Voltar
        </button>
        <h2 className="text-[14px] font-semibold">Configurações</h2>
      </div>

      <div className="p-5 flex flex-col gap-6 max-w-2xl">

        {/* Projects section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#9b9a97] dark:text-[#4c4c4c] mb-3">Projetos</p>

          <div className="flex flex-col gap-2">
            {state.projects.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-md border ${p.id === state.activeProjectId ? 'bg-[#f0f7ff] dark:bg-[#1a2535] border-[#b8d8f8] dark:border-[#2a3f5f]' : 'bg-[#fafaf8] dark:bg-[#242424] border-[#e9e9e7] dark:border-[#2e2e2e]'}`}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium truncate">{p.name}</span>
                    <span className="text-[10px] bg-[#f0efec] dark:bg-[#2a2a2a] rounded px-1.5 py-0.5 text-[#6b6a68] dark:text-[#9b9a97] font-mono">{p.prefix}</span>
                  </div>
                  <p className="text-[10.5px] text-[#9b9a97] truncate">{p.outputDir || 'Sem pasta'}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEdit(p)} className="w-6 h-6 rounded bg-[#f0efec] dark:bg-[#2a2a2a] hover:bg-[#e9e9e7] flex items-center justify-center">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => actions.deleteProject(p.id)} className="w-6 h-6 rounded bg-[#f0efec] dark:bg-[#2a2a2a] hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-red-500">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}

            {/* Add / Edit project form */}
            {editingId ? (
              <div className="border border-[#2f81f7] rounded-md p-3 bg-[#f5f9ff] dark:bg-[#1a2535] flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Nome do projeto">
                    <input className={inputClass} placeholder="Motor BLDC" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <Field label="Prefixo">
                    <input className={inputClass} placeholder="BLDC_" value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Pasta de saída">
                  <div className="flex gap-1.5">
                    <input className={`${inputClass} flex-1`} placeholder="D:\Projetos\..." value={form.outputDir} onChange={(e) => setForm((f) => ({ ...f, outputDir: e.target.value }))} />
                    <button onClick={chooseDir} className="h-7 px-2.5 rounded border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[11px] flex items-center gap-1">
                      <FolderOpen size={12} /> Explorar
                    </button>
                  </div>
                </Field>
                <Field label="Cor">
                  <div className="flex gap-2 mt-0.5">
                    {PROJECT_COLORS.map((c) => (
                      <button key={c} onClick={() => setForm((f) => ({ ...f, color: c }))} className="w-5 h-5 rounded-full border-2 transition-all" style={{ background: c, borderColor: form.color === c ? '#37352f' : 'transparent' }} />
                    ))}
                  </div>
                </Field>
                <div className="flex gap-2 pt-1">
                  <button onClick={submitForm} className="h-7 px-3 bg-[#2f81f7] text-white text-[11.5px] font-semibold rounded hover:bg-[#2673e0]">
                    {editingId === 'new' ? 'Adicionar' : 'Salvar'}
                  </button>
                  <button onClick={() => { setEditingId(null); setForm(null) }} className="h-7 px-3 border border-[#e0e0de] dark:border-[#3a3a3a] text-[11.5px] rounded bg-white dark:bg-[#2a2a2a] hover:bg-[#f7f7f5]">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={openAdd} className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#d0cfc9] dark:border-[#3a3a3a] rounded-md text-[12px] text-[#9b9a97] hover:border-[#9b9a97] hover:text-[#37352f] dark:hover:text-[#c7c7c3] transition-colors">
                <Plus size={13} /> Adicionar projeto
              </button>
            )}
          </div>
        </section>

        {/* Inkscape section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#9b9a97] dark:text-[#4c4c4c] mb-3">Inkscape</p>
          <div className="flex gap-2">
            <input
              className={`${inputClass} flex-1 font-mono text-[11px]`}
              placeholder="C:\Program Files\Inkscape\bin\inkscape.exe"
              value={inkPath}
              onChange={(e) => { setInkPath(e.target.value); setInkStatus('dirty') }}
            />
            <button
              onClick={saveInkscape}
              className="h-7 px-3 bg-white dark:bg-[#2a2a2a] border border-[#e0e0de] dark:border-[#3a3a3a] rounded text-[11px] hover:bg-[#f7f7f5] flex items-center gap-1.5"
            >
              Salvar
            </button>
          </div>
          {inkStatus === 'saved' && inkPath && (
            <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={11} /> Inkscape configurado
            </p>
          )}
        </section>

        {/* Appearance section */}
        <section>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#9b9a97] dark:text-[#4c4c4c] mb-3">Aparência</p>
          <div className="flex gap-2">
            {[
              { value: 'light', label: 'Claro', icon: Sun },
              { value: 'dark',  label: 'Escuro', icon: Moon },
              { value: 'system', label: 'Sistema', icon: Monitor },
            ].map(({ value, label, icon: Icon }) => {
              const active = (state.settings.theme ?? 'system') === value
              return (
                <button
                  key={value}
                  onClick={() => actions.updateSettings({ theme: value })}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-md border text-[11.5px] font-medium transition-colors
                    ${active
                      ? 'border-[#2f81f7] bg-[#f0f7ff] dark:bg-[#1a2535] text-[#2f81f7] dark:text-[#7cb3f5]'
                      : 'border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[#6b6a68] dark:text-[#9b9a97] hover:bg-[#f7f7f5] dark:hover:bg-[#333]'
                    }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-[10.5px] text-[#9b9a97] dark:text-[#4c4c4c] mt-2">
            "Sistema" segue automaticamente a configuração do Windows.
          </p>
        </section>

      </div>
    </div>
  )
}

const inputClass = 'h-7 px-2.5 rounded border border-[#e0e0de] dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a] text-[12px] text-[#37352f] dark:text-[#c7c7c3] focus:outline-none focus:border-[#2f81f7] w-full'

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] font-medium text-[#6b6a68] dark:text-[#9b9a97]">{label}</label>
      {children}
    </div>
  )
}
