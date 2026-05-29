import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, closestCenter, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Settings, Clipboard, Download, Camera, Loader2, Info, Bell, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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

export default function Sidebar({ screen, onNavigate, open, width, updateStatus, downloadPercent, onCheckUpdate, onOpenAbout, onOpenNotifications, unreadCount, onOpenAccount }) {
  const { state, actions } = useApp()
  const { t } = useTranslation()
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [hoveringDownload, setHoveringDownload] = useState(false)
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
            <TooltipProvider delayDuration={0}>
              <Tooltip open={hoveringDownload && updateStatus === 'downloading'}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="app-region-no-drag h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={state.updateInfo ? () => setUpdateDialogOpen(true) : onCheckUpdate}
                    disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                    title={
                      updateStatus === 'downloading' ? undefined
                      : state.updateInfo ? t('sidebar.updateAvailable')
                      : updateStatus === 'checking' ? t('sidebar.checking')
                      : t('sidebar.checkUpdate')
                    }
                    onMouseEnter={() => setHoveringDownload(true)}
                    onMouseLeave={() => setHoveringDownload(false)}
                  >
                    {state.updateInfo
                      ? <Download size={12} className="animate-levitate text-primary" />
                      : updateStatus === 'downloading'
                        ? <Download size={12} className="text-primary animate-pulse" />
                        : updateStatus === 'checking'
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Download size={12} />
                    }
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-1.5 p-2 min-w-[140px]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('sidebar.downloadingLabel')}</span>
                    <span className="font-bold tabular-nums">{downloadPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${downloadPercent}%` }}
                    />
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden py-2">
        <div className="flex flex-col overflow-y-auto flex-1">
          {open && <SectionLabel>{t('sidebar.workspace')}</SectionLabel>}
          <SidebarItem
            icon={<Clipboard size={14} />}
            active={screen === 'main'}
            onClick={() => onNavigate('main')}
            badge={(state.previewQueue.length + (state.status === 'preview' ? 1 : 0)) || null}
            collapsed={!open}
            tooltip={t('sidebar.clipboard')}
          >
            {t('sidebar.clipboard')}
          </SidebarItem>

          <SidebarItem
            icon={<Camera size={14} />}
            active={screen === 'capture'}
            onClick={() => onNavigate('capture')}
            collapsed={!open}
            tooltip={t('sidebar.capture')}
          >
            {t('sidebar.capture')}
          </SidebarItem>

          <Separator className="mx-3 my-1.5 w-auto" />
          {open && <SectionLabel>{t('sidebar.projects')}</SectionLabel>}

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
            <p className="text-[11px] text-muted-foreground px-3 py-1 italic">{t('sidebar.noProjects')}</p>
          )}
        </div>

        <div>
          <Separator className="mx-3 mb-1.5 w-auto" />
          <SidebarItem
            icon={<Bell size={14} />}
            onClick={onOpenNotifications}
            collapsed={!open}
            tooltip={t('sidebar.notifications')}
            badge={unreadCount > 0 ? unreadCount : null}
          >
            {t('sidebar.notifications')}
          </SidebarItem>
          <SidebarItem
            icon={
              state.account?.photo
                ? <img src={state.account.photo} alt={state.account.name} className="w-4 h-4 rounded-full object-cover" />
                : <User size={14} />
            }
            onClick={onOpenAccount}
            collapsed={!open}
            tooltip={t('sidebar.account')}
          >
            {t('sidebar.account')}
          </SidebarItem>
          <SidebarItem
            icon={<Settings size={14} />}
            active={screen === 'settings'}
            onClick={() => onNavigate('settings')}
            collapsed={!open}
            tooltip={t('sidebar.settings')}
          >
            {t('sidebar.settings')}
          </SidebarItem>
          <SidebarItem
            icon={<Info size={14} />}
            onClick={onOpenAbout}
            collapsed={!open}
            tooltip={t('sidebar.about')}
          >
            {t('sidebar.about')}
          </SidebarItem>
        </div>
      </div>

      <AlertDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download size={16} /> {t('sidebar.updateDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('sidebar.updateDialog.description', { version: state.updateInfo?.version })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sidebar.updateDialog.later')}</AlertDialogCancel>
            <AlertDialogAction onClick={actions.installUpdate}>
              {t('sidebar.updateDialog.install')}
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
