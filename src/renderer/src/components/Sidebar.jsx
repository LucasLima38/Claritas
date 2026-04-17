import { Settings, Clipboard } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

export default function Sidebar({ screen, onNavigate }) {
  const { state, actions } = useApp()

  return (
    <div className="w-[200px] shrink-0 bg-[#fbfbfa] dark:bg-[#191919] border-r border-[#e9e9e7] dark:border-[#2e2e2e] flex flex-col py-2 overflow-hidden">
      <SectionLabel>Workspace</SectionLabel>
      <SidebarItem
        icon={<Clipboard size={14} />}
        active={screen === 'main'}
        onClick={() => onNavigate('main')}
        badge={state.history.length || null}
      >
        Clipboard
      </SidebarItem>

      <SectionLabel className="mt-2">Projetos</SectionLabel>
      {state.projects.map((p) => (
        <SidebarItem
          key={p.id}
          icon={<span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: p.color }} />}
          active={p.id === state.activeProjectId && screen === 'main'}
          onClick={() => {
            actions.setActiveProject(p.id)
            onNavigate('main')
          }}
        >
          {p.name}
        </SidebarItem>
      ))}

      {state.projects.length === 0 && (
        <p className="text-[11px] text-[#9b9a97] px-3 py-1 italic">Nenhum projeto</p>
      )}

      <div className="mt-auto border-t border-[#e9e9e7] dark:border-[#2e2e2e] pt-2">
        <SidebarItem
          icon={<Settings size={14} />}
          active={screen === 'settings'}
          onClick={() => onNavigate('settings')}
        >
          Configurações
        </SidebarItem>
      </div>
    </div>
  )
}

function SectionLabel({ children, className = '' }) {
  return (
    <p className={`px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#9b9a97] dark:text-[#4c4c4c] mt-2 mb-0.5 ${className}`}>
      {children}
    </p>
  )
}

function SidebarItem({ icon, children, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`app-region-no-drag flex items-center gap-2 mx-1.5 px-2.5 py-1 rounded text-[12.5px] w-[calc(100%-12px)] text-left transition-colors
        ${active
          ? 'bg-[#e9e9e7] dark:bg-[#2a2a2a] font-medium text-[#37352f] dark:text-[#e6e6e3]'
          : 'text-[#37352f] dark:text-[#c7c7c3] hover:bg-[#efefee] dark:hover:bg-[#242424]'
        }`}
    >
      <span className="flex items-center justify-center w-4 shrink-0">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {badge != null && (
        <span className="bg-[#37352f] dark:bg-[#e6e6e3] text-white dark:text-[#1f1f1f] text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
          {badge}
        </span>
      )}
    </button>
  )
}
