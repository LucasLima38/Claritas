import { useState } from 'react'
import { DndContext, closestCenter, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Settings, Clipboard, Download, Camera, RefreshCw, Check, Loader2 } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useApp } from '../context/AppContext.jsx'
import logoUrl from '../assets/logo.png'

function SortableSidebarItem({ p, activeProjectId, screen, onNavigate, actions, collapsed }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SidebarItem
        icon={<span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: p.color }} />}
        active={p.id === activeProjectId && screen === 'main'}
        onClick={() => { actions.setActiveProject(p.id); onNavigate('main') }}
        collapsed={collapsed}
        tooltip={p.name}
      >
        {p.name}
      </SidebarItem>
    </div>
  )
}

export default function Sidebar({ screen, onNavigate, open, width, updateStatus, onCheckUpdate }) {
  const { state, actions } = useApp()
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }))
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
    <div
      className={cn(
        'shrink-0 bg-muted/40 border-r border-border flex flex-col overflow-hidden transition-all duration-200',
        !open && 'w-[48px]'
      )}
      style={open ? { width } : undefined}
    >
      {/* Logo header */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border shrink-0">
        <img src={logoUrl} alt="Claritas" className="w-6 h-6 shrink-0 object-contain" />
        {open && (
          <>
            <span className="text-[13px] font-semibold tracking-tight truncate flex-1">Claritas</span>
            <Button
              variant="ghost"
              size="icon"
              className="app-region-no-drag h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onCheckUpdate}
              disabled={updateStatus === 'checking'}
              title={updateStatus === 'upToDate' ? 'Claritas está atualizado' : 'Verificar atualizações'}
            >
              {updateStatus === 'upToDate'
                ? <Check size={12} className="text-green-500" />
                : updateStatus === 'checking'
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Download size={12} />
              }
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden py-2">
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
              {open && <span className="flex-1 truncate text-left">Atualização</span>}
            </Button>
          </div>
        )}

        {open && <SectionLabel>Workspace</SectionLabel>}
        <SidebarItem
          icon={<Clipboard size={14} />}
          active={screen === 'main'}
          onClick={() => onNavigate('main')}
          badge={(state.previewQueue.length + (state.status === 'preview' ? 1 : 0)) || null}
          collapsed={!open}
          tooltip="Clipboard"
        >
          Clipboard
        </SidebarItem>

        <SidebarItem
          icon={<Camera size={14} />}
          active={screen === 'capture'}
          onClick={() => onNavigate('capture')}
          collapsed={!open}
          tooltip="Captura"
        >
          Captura
        </SidebarItem>

        <Separator className="mx-3 my-1.5 w-auto" />
        {open && <SectionLabel>Projetos</SectionLabel>}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={state.projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {state.projects.map((p) => (
              <SortableSidebarItem
                key={p.id}
                p={p}
                activeProjectId={state.activeProjectId}
                screen={screen}
                onNavigate={onNavigate}
                actions={actions}
                collapsed={!open}
              />
            ))}
          </SortableContext>
        </DndContext>

        {state.projects.length === 0 && open && (
          <p className="text-[11px] text-muted-foreground px-3 py-1 italic">Nenhum projeto</p>
        )}

        <div className="mt-auto">
          <Separator className="mx-3 mb-1.5 w-auto" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                title={!open ? 'Configurações' : undefined}
                className={cn(
                  'app-region-no-drag justify-start gap-2 mx-1.5 px-2.5 h-7 text-[12.5px] w-[calc(100%-12px)] font-normal',
                  screen === 'settings' && 'bg-accent font-medium text-accent-foreground',
                  !open && 'justify-center px-0'
                )}
              >
                <span className="flex items-center justify-center w-4 shrink-0">
                  <Settings size={14} />
                </span>
                {open && <span className="flex-1 truncate text-left">Configurações</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuLabel>Configurações Gerais</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onNavigate('settings')}>
                <Settings size={13} />
                Configurações
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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

function SidebarItem({ icon, children, active, onClick, badge, collapsed, tooltip }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      title={collapsed ? tooltip : undefined}
      className={cn(
        'app-region-no-drag justify-start gap-2 mx-1.5 px-2.5 h-7 text-[12.5px] w-[calc(100%-12px)] font-normal',
        active && 'bg-accent font-medium text-accent-foreground',
        collapsed && 'justify-center px-0'
      )}
    >
      <span className="flex items-center justify-center w-4 shrink-0">{icon}</span>
      {!collapsed && <span className="flex-1 truncate text-left">{children}</span>}
      {!collapsed && badge != null && (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 leading-4 h-4">
          {badge}
        </Badge>
      )}
    </Button>
  )
}
