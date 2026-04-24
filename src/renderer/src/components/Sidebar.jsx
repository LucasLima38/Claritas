import { useState } from 'react'
import { Settings, Clipboard, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useApp } from '../context/AppContext.jsx'

export default function Sidebar({ screen, onNavigate }) {
  const { state, actions } = useApp()
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)

  return (
    <div className="w-[200px] shrink-0 bg-muted/40 border-r border-border flex flex-col py-2 overflow-hidden">

      {state.updateInfo && (
        <div className="px-1.5 pb-1">
          <Button
            variant="ghost"
            onClick={() => setUpdateDialogOpen(true)}
            className="app-region-no-drag w-full justify-start gap-2 px-2.5 h-7 text-[12.5px] font-normal text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
          >
            <span className="relative flex items-center justify-center w-4 shrink-0">
              <Download size={14} />
              <Badge className="absolute -top-2 -right-2 h-3.5 min-w-[14px] px-0.5 text-[8px] leading-none flex items-center justify-center bg-amber-500 text-white border-0 rounded-full">
                1
              </Badge>
            </span>
            <span className="flex-1 truncate text-left">Atualização</span>
          </Button>
        </div>
      )}

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

      <AlertDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download size={16} /> Atualização disponível
            </AlertDialogTitle>
            <AlertDialogDescription>
              A versão <strong>{state.updateInfo?.version}</strong> foi baixada e está pronta para instalar.
              O app vai reiniciar automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={actions.installUpdate}>
              Reiniciar e instalar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
