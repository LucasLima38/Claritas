import { RefreshCw, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApp } from '../context/AppContext.jsx'

export default function AccountPanel({ open, onOpenChange }) {
  const { t } = useTranslation()
  const { state, actions } = useApp()
  const { account } = state

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-72">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('account.title')}</DialogTitle>
        </DialogHeader>

        {!account ? (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground text-center">
              {t('account.loginPrompt')}
            </p>
            <Button
              className="w-full gap-2"
              onClick={async () => {
                const r = await actions.googleLogin()
                if (r?.ok) onOpenChange(false)
              }}
            >
              {t('account.login')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {account.photo ? (
                <img
                  src={account.photo}
                  alt={account.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {account.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{account.name}</p>
                <p className="text-xs text-muted-foreground truncate">{account.email}</p>
              </div>
            </div>

            {account.syncError && (
              <p className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded">
                {account.syncError}
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={account.syncing}
              onClick={() => actions.syncProjects()}
            >
              <RefreshCw size={13} className={account.syncing ? 'animate-spin' : ''} />
              {account.syncing ? t('account.syncing') : t('account.syncNow')}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-muted-foreground"
              onClick={() => actions.googleLogout()}
            >
              <LogOut size={13} /> {t('account.logout')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
