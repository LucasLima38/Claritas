import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TYPE_COLORS = {
  error: 'text-destructive',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

export default function NotificationsDialog({ open, onOpenChange, notifications, onMarkAllRead, onClear }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('all')

  function handleOpenChange(value) {
    if (!value) onMarkAllRead()
    onOpenChange(value)
  }

  const visible = activeTab === 'all'
    ? notifications
    : notifications.filter((n) => !n.read)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('notifications.title')}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-2 mb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'text-[12px] px-3 py-1 rounded-md font-medium transition-colors',
              activeTab === 'all'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('notifications.all')}
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={cn(
              'text-[12px] px-3 py-1 rounded-md font-medium transition-colors',
              activeTab === 'unread'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t('notifications.unread')}
          </button>
        </div>

        {/* List */}
        <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-6">{t('notifications.empty')}</p>
          ) : (
            visible.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-2 px-2 py-2 rounded-md text-[12px]',
                  !n.read && 'bg-muted/50'
                )}
              >
                <span className={cn('mt-0.5 shrink-0 font-bold', TYPE_COLORS[n.type] ?? 'text-foreground')}>
                  {n.type === 'error' ? '✕' : n.type === 'warning' ? '⚠' : 'ℹ'}
                </span>
                <span className="flex-1 leading-snug">{n.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="text-[12px] h-7 px-3"
            onClick={onClear}
            disabled={notifications.length === 0}
          >
            {t('notifications.clear')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
