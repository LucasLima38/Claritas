import { Settings, Clipboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useApp } from '../context/AppContext.jsx'

export default function Sidebar({ screen, onNavigate }) {
  const { state, actions } = useApp()

  return (
    <div className="w-[200px] shrink-0 bg-muted/40 border-r border-border flex flex-col py-2 overflow-hidden">
      <SectionLabel>Workspace</SectionLabel>
      <SidebarItem
        icon={<Clipboard size={14} />}
        active={screen === 'main'}
        onClick={() => onNavigate('main')}
        badge={state.history.length || null}
      >
        Clipboard
      </SidebarItem>

      <Separator className="mx-3 my-1.5 w-auto" />
      <SectionLabel>Projetos</SectionLabel>

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
        <p className="text-[11px] text-muted-foreground px-3 py-1 italic">Nenhum projeto</p>
      )}

      <div className="mt-auto">
        <Separator className="mx-3 mb-1.5 w-auto" />
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

function SectionLabel({ children }) {
  return (
    <p className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1 mb-0.5">
      {children}
    </p>
  )
}

function SidebarItem({ icon, children, active, onClick, badge }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        'app-region-no-drag justify-start gap-2 mx-1.5 px-2.5 h-7 text-[12.5px] w-[calc(100%-12px)] font-normal',
        active && 'bg-accent font-medium text-accent-foreground'
      )}
    >
      <span className="flex items-center justify-center w-4 shrink-0">{icon}</span>
      <span className="flex-1 truncate text-left">{children}</span>
      {badge != null && (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 leading-4 h-4">
          {badge}
        </Badge>
      )}
    </Button>
  )
}
