import { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

// status: 'idle' | 'converting' | 'preview' | 'saving' | 'error'

const initialState = {
  status: 'idle',
  svgContent: null,
  svgMetadata: null,
  previewQueue: [],
  error: null,
  projects: [],
  activeProjectId: null,
  history: [],
  settings: {},
  dirMissing: false,
  dirMissingPath: null,
  exportFormat: 'svg',
  updateInfo: null,
  captureStatus: 'capture-idle',
  captureData: null,
  captureFormat: 'png',
  captureResolution: 'normal',
  notifications: [],
  account: null,
  saveToast: null,
}

export function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        projects: action.projects,
        activeProjectId: action.activeProjectId,
        settings: action.settings,
        history: action.history,
        notifications: action.notifications ?? [],
      }

    case 'PASTE_START':
      return { ...state, status: 'converting', error: null }

    case 'SVG_READY':
      if (state.status === 'preview' || state.status === 'saving') {
        return {
          ...state,
          previewQueue: [...state.previewQueue, { svgContent: action.svgContent, metadata: action.metadata }],
        }
      }
      return {
        ...state,
        status: 'preview',
        svgContent: action.svgContent,
        svgMetadata: action.metadata,
      }

    case 'CONVERSION_ERROR':
      return {
        ...state,
        status: action.toastOnly ? 'idle' : 'error',
        error: action.toastOnly ? state.error : { type: action.errorType, message: action.message },
      }

    case 'SAVE_START':
      return { ...state, status: 'saving' }

    case 'SAVE_SUCCESS': {
      const [nextPreview, ...remainingQueue] = state.previewQueue
      return {
        ...state,
        status: nextPreview ? 'preview' : 'idle',
        svgContent: nextPreview ? nextPreview.svgContent : null,
        svgMetadata: nextPreview ? nextPreview.metadata : null,
        previewQueue: remainingQueue,
        history: [action.entry, ...state.history],
        projects: state.projects.map((p) =>
          p.id === action.entry.projectId
            ? { ...p, counter: action.newCounter }
            : p
        ),
      }
    }

    case 'SAVE_ERROR':
      return { ...state, status: 'preview' }

    case 'DIR_MISSING':
      return {
        ...state,
        status: 'preview',
        dirMissing: true,
        dirMissingPath: action.outputDir,
      }

    case 'CLEAR_DIR_MISSING':
      return { ...state, dirMissing: false, dirMissingPath: null }

    case 'DISCARD': {
      const [nextPreview, ...remainingQueue] = state.previewQueue
      return {
        ...state,
        status: nextPreview ? 'preview' : 'idle',
        svgContent: nextPreview ? nextPreview.svgContent : null,
        svgMetadata: nextPreview ? nextPreview.metadata : null,
        previewQueue: remainingQueue,
        error: null,
      }
    }

    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.id }

    case 'PROJECTS_UPDATED':
      return {
        ...state,
        projects: action.projects,
        activeProjectId: action.activeProjectId ?? state.activeProjectId,
      }

    case 'REORDER_PROJECTS':
      return { ...state, projects: action.projects }

    case 'SETTINGS_UPDATED':
      return { ...state, settings: action.settings }

    case 'SET_EXPORT_FORMAT':
      return { ...state, exportFormat: action.format }

    case 'CLEAR_ERROR':
      return { ...state, status: 'idle', error: null }

    case 'UPDATE_AVAILABLE':
      return { ...state, updateInfo: { version: action.version, releaseDate: action.releaseDate } }

    case 'DELETE_HISTORY_ENTRY':
      return { ...state, history: state.history.filter((e) => e.id !== action.entryId) }

    case 'SYNC_HISTORY':
      return { ...state, history: action.history }

    case 'CAPTURE_READY':
      return {
        ...state,
        captureStatus: 'capture-editor',
        captureData: { dataURL: action.dataURL, width: action.width, height: action.height },
      }

    case 'CAPTURE_CANCELLED':
      return {
        ...state,
        captureStatus: 'capture-idle',
        captureData: null,
      }

    case 'CAPTURE_DISCARD':
      return {
        ...state,
        captureStatus: 'capture-idle',
        captureData: null,
      }

    case 'CAPTURE_SAVE_SUCCESS':
      return {
        ...state,
        captureStatus: 'capture-idle',
        captureData: null,
        history: [action.entry, ...state.history],
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, counter: action.newCounter } : p
        ),
      }

    case 'SET_CAPTURE_FORMAT':
      return { ...state, captureFormat: action.format }

    case 'SET_CAPTURE_RESOLUTION':
      return { ...state, captureResolution: action.resolution }

    case 'CAPTURE_COUNTDOWN_START':
      return { ...state, captureStatus: 'capture-countdown' }

    case 'ADD_NOTIFICATION': {
      const updated = [action.notification, ...state.notifications]
      return { ...state, notifications: updated.slice(0, 50) }
    }

    case 'MARK_ALL_READ':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }

    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] }

    case 'SHOW_SAVE_TOAST':
      return { ...state, saveToast: action.payload }

    case 'HIDE_SAVE_TOAST':
      return { ...state, saveToast: null }

    case 'SET_ACCOUNT':
      return { ...state, account: action.account }

    case 'SET_SYNCING':
      return {
        ...state,
        account: state.account ? { ...state.account, syncing: action.syncing } : state.account,
      }

    case 'SET_SYNC_ERROR':
      return {
        ...state,
        account: state.account ? { ...state.account, syncError: action.error } : state.account,
      }

    default:
      return state
  }
}

const AppContext = createContext(null)

const THEME_CLASSES = ['dark', 'theme-snnabb', 'theme-charcoal', 'theme-black-moon', 'theme-blue-moon', 'theme-claritas']

function applyTheme(theme, systemIsDark) {
  const root = document.documentElement
  root.classList.remove(...THEME_CLASSES)

  if (theme === 'dark')            root.classList.add('dark')
  else if (theme === 'light')      { /* :root light vars — no class needed */ }
  else if (theme === 'system')     { if (systemIsDark) root.classList.add('dark') }
  else if (theme === 'snnabb')     root.classList.add('theme-snnabb')
  else if (theme === 'charcoal')   root.classList.add('theme-charcoal')
  else if (theme === 'black-moon') root.classList.add('theme-black-moon')
  else if (theme === 'blue-moon')  root.classList.add('theme-blue-moon')
  else if (theme === 'claritas')   root.classList.add('theme-claritas')
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { t } = useTranslation()
  const themeRef = useRef('system')

  useEffect(() => {
    window.electronAPI.getInitData().then((data) => {
      dispatch({ type: 'INIT', ...data })
      if (data.settings?.language) {
        i18n.changeLanguage(data.settings.language)
      }
      const theme = data.settings?.theme ?? 'system'
      themeRef.current = theme
      const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      applyTheme(theme, systemIsDark)
    })

    const cleanups = [
      window.electronAPI.onProjectsUpdated((data) =>
        dispatch({ type: 'PROJECTS_UPDATED', ...data })
      ),
      window.electronAPI.onThemeChanged(({ isDark }) => {
        applyTheme(themeRef.current, isDark)
      }),
      window.electronAPI.onPreviewReady(({ svgContent, metadata }) => {
        dispatch({ type: 'SVG_READY', svgContent, metadata })
      }),
      window.electronAPI.onUpdateAvailable(({ version, releaseDate }) => {
        dispatch({ type: 'UPDATE_AVAILABLE', version, releaseDate })
      }),
      window.electronAPI.onCaptureReady((data) => {
        dispatch({ type: 'CAPTURE_READY', ...data })
      }),
      window.electronAPI.onCaptureCancelled(() => {
        dispatch({ type: 'CAPTURE_CANCELLED' })
      }),
      window.electronAPI.onAccountChanged((user) => {
        dispatch({
          type: 'SET_ACCOUNT',
          account: user ? { ...user, syncing: false, syncError: null } : null,
        })
      }),
      // onNavigateTo is handled in App.jsx — no listener needed here
    ]
    return () => cleanups.forEach((fn) => fn?.())
  }, [])

  const actions = {
    async paste() {
      dispatch({ type: 'PASTE_START' })
      const result = await window.electronAPI.pasteSchematic()
      if (result.ok) {
        dispatch({ type: 'SVG_READY', svgContent: result.svgContent, metadata: result.metadata })
      } else {
        const toastOnly = result.error === 'NO_EMF'
        if (toastOnly) toast.error(result.message)
        dispatch({ type: 'CONVERSION_ERROR', errorType: result.error, message: result.message, toastOnly })
        if (!toastOnly) {
          actions.addNotification({
            id: crypto.randomUUID(),
            type: 'error',
            message: t('context.conversionError', { message: result.message }),
            read: false,
            timestamp: Date.now(),
          })
        }
      }
    },

    async save() {
      const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
      if (!activeProject) {
        toast.error(t('context.noActiveProject'))
        return
      }
      const driveEnabled = activeProject.outputMode === 'drive'
      dispatch({
        type: 'SHOW_SAVE_TOAST',
        payload: {
          message: t('context.saving'),
          subMessage: driveEnabled ? t('context.sendingToDrive') : undefined,
          type: 'saving',
        },
      })
      dispatch({ type: 'SAVE_START' })
      let result
      try {
        result = await window.electronAPI.saveSVG({ projectId: state.activeProjectId, format: state.exportFormat })
      } catch (err) {
        dispatch({
          type: 'SHOW_SAVE_TOAST',
          payload: { message: err?.message ?? t('context.saveError'), type: 'error' },
        })
        dispatch({ type: 'SAVE_ERROR' })
        actions.addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          message: t('context.saveErrorDetail', { message: err.message }),
          read: false,
          timestamp: Date.now(),
        })
        return
      }
      if (!result) {
        dispatch({
          type: 'SHOW_SAVE_TOAST',
          payload: { message: t('context.invalidResponse'), type: 'error' },
        })
        dispatch({ type: 'SAVE_ERROR' })
        actions.addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          message: t('context.saveErrorDetail', { message: t('context.invalidResponse') }),
          read: false,
          timestamp: Date.now(),
        })
        return
      }
      if (result.ok) {
        dispatch({ type: 'SAVE_SUCCESS', filename: result.filename, entry: result.entry, newCounter: result.newCounter })
        dispatch({
          type: 'SHOW_SAVE_TOAST',
          payload: { message: t('context.saved'), type: 'success' },
        })
      } else if (result.dirMissing) {
        dispatch({ type: 'HIDE_SAVE_TOAST' })
        dispatch({ type: 'DIR_MISSING', outputDir: result.outputDir ?? null })
        actions.addNotification({
          id: crypto.randomUUID(),
          type: 'warning',
          message: t('context.outputNotFound', { dir: result.outputDir ?? '(desconhecida)' }),
          read: false,
          timestamp: Date.now(),
        })
      } else if (result.error === 'EACCES') {
        dispatch({
          type: 'SHOW_SAVE_TOAST',
          payload: { message: t('context.noWritePermission'), type: 'error' },
        })
        dispatch({ type: 'SAVE_ERROR' })
        actions.addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          message: t('context.saveErrorDetail', { message: t('context.noWritePermission') }),
          read: false,
          timestamp: Date.now(),
        })
      } else {
        dispatch({
          type: 'SHOW_SAVE_TOAST',
          payload: { message: result.message ?? t('context.saveError'), type: 'error' },
        })
        dispatch({ type: 'SAVE_ERROR' })
        actions.addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          message: t('context.saveErrorDetail', { message: result.message || 'erro desconhecido.' }),
          read: false,
          timestamp: Date.now(),
        })
      }
    },

    async discard() {
      await window.electronAPI.discardSVG()
      dispatch({ type: 'DISCARD' })
    },

    async setActiveProject(id) {
      await window.electronAPI.setActiveProject({ id })
      dispatch({ type: 'SET_ACTIVE_PROJECT', id })
    },

    async addProject(project) {
      const result = await window.electronAPI.addProject(project)
      dispatch({ type: 'PROJECTS_UPDATED', projects: result.projects, activeProjectId: result.activeProjectId })
    },

    async updateProject(id, updates) {
      const result = await window.electronAPI.updateProject({ id, updates })
      dispatch({ type: 'PROJECTS_UPDATED', projects: result.projects })
    },

    async deleteProject(id) {
      const result = await window.electronAPI.deleteProject({ id })
      dispatch({ type: 'PROJECTS_UPDATED', projects: result.projects, activeProjectId: result.activeProjectId })
    },

    async reorderProjects(ids) {
      const result = await window.electronAPI.reorderProjects({ ids })
      dispatch({ type: 'REORDER_PROJECTS', projects: result.projects })
    },

    async updateSettings(updates) {
      const settings = await window.electronAPI.updateSettings(updates)
      dispatch({ type: 'SETTINGS_UPDATED', settings })
      if (updates.theme) {
        themeRef.current = settings.theme
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        applyTheme(settings.theme, systemIsDark)
      }
      if (updates.language) {
        i18n.changeLanguage(settings.language)
      }
    },

    hideSaveToast() {
      dispatch({ type: 'HIDE_SAVE_TOAST' })
    },

    clearDirMissing() {
      dispatch({ type: 'CLEAR_DIR_MISSING' })
    },

    setExportFormat(format) {
      dispatch({ type: 'SET_EXPORT_FORMAT', format })
    },

    clearError() {
      dispatch({ type: 'CLEAR_ERROR' })
    },

    async installUpdate() {
      await window.electronAPI.installUpdate()
    },

    async deleteHistoryEntry(entry) {
      const result = await window.electronAPI.deleteHistoryFile({ entryId: entry.id, fullPath: entry.fullPath, thumbPath: entry.thumbPath, driveFileId: entry.driveFileId ?? null })
      if (result.ok) dispatch({ type: 'DELETE_HISTORY_ENTRY', entryId: entry.id })
      return result.ok
    },

    async syncHistory() {
      const result = await window.electronAPI.syncHistory()
      dispatch({ type: 'SYNC_HISTORY', history: result.history })
    },

    async startCapture({ mode, delay, resolution }) {
      dispatch({ type: 'SET_CAPTURE_RESOLUTION', resolution: resolution ?? 'normal' })
      dispatch({ type: 'CAPTURE_COUNTDOWN_START' })
      await window.electronAPI.captureScreen({ mode, delay })
    },

    cancelCapture() {
      window.electronAPI.cancelCapture()
      dispatch({ type: 'CAPTURE_CANCELLED' })
    },

    discardCapture() {
      dispatch({ type: 'CAPTURE_DISCARD' })
    },

    async saveCapture({ dataURL, format, resolution }) {
      const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
      if (!activeProject) {
        toast.error(t('context.selectProjectFirst'))
        return
      }
      const driveEnabled = activeProject.outputMode === 'drive'
      dispatch({
        type: 'SHOW_SAVE_TOAST',
        payload: {
          message: t('context.saving'),
          subMessage: driveEnabled ? t('context.sendingToDrive') : undefined,
          type: 'saving',
        },
      })
      const result = await window.electronAPI.saveImage({
        dataURL,
        projectId: state.activeProjectId,
        format,
        resolution,
      })
      if (result.ok) {
        dispatch({
          type: 'SHOW_SAVE_TOAST',
          payload: { message: t('context.saved'), type: 'success' },
        })
        dispatch({
          type: 'CAPTURE_SAVE_SUCCESS',
          projectId: state.activeProjectId,
          newCounter: result.newCounter ?? (activeProject.counter ?? 0) + 1,
          entry: result.entry ?? {
            id: Date.now(),
            filename: result.filename,
            fullPath: result.fullPath,
            projectId: state.activeProjectId,
          },
        })
      } else if (result.dirMissing) {
        dispatch({ type: 'HIDE_SAVE_TOAST' })
        dispatch({ type: 'DIR_MISSING', outputDir: result.outputDir ?? null })
      } else {
        dispatch({
          type: 'SHOW_SAVE_TOAST',
          payload: { message: result?.message ?? t('context.captureError'), type: 'error' },
        })
      }
    },

    setCaptureFormat(format) {
      dispatch({ type: 'SET_CAPTURE_FORMAT', format })
    },

    addNotification(notification) {
      const updated = [notification, ...state.notifications].slice(0, 50)
      dispatch({ type: 'ADD_NOTIFICATION', notification })
      window.electronAPI.saveNotifications(updated)
    },

    markAllRead() {
      dispatch({ type: 'MARK_ALL_READ' })
    },

    clearNotifications() {
      dispatch({ type: 'CLEAR_NOTIFICATIONS' })
      window.electronAPI.saveNotifications([])
    },

    async googleLogin() {
      const result = await window.electronAPI.googleLogin()
      if (!result.ok) {
        toast.error(result.error ?? t('context.loginError'))
      }
      return result
    },

    async googleLogout() {
      await window.electronAPI.googleLogout()
    },

    async syncProjects() {
      dispatch({ type: 'SET_SYNCING', syncing: true })
      dispatch({ type: 'SET_SYNC_ERROR', error: null })
      const result = await window.electronAPI.syncProjects()
      dispatch({ type: 'SET_SYNCING', syncing: false })
      if (!result.ok) {
        dispatch({ type: 'SET_SYNC_ERROR', error: result.error ?? t('context.syncError') })
        toast.error(result.error ?? t('context.syncError'))
      }
    },

    async shareFile({ fullPath, email }) {
      const result = await window.electronAPI.shareFile({ fullPath, email })
      if (result.ok) {
        toast.success(t('context.shared', { email }), {
          action: result.webViewLink
            ? { label: t('context.copyLink'), onClick: () => navigator.clipboard.writeText(result.webViewLink) }
            : undefined,
        })
      } else {
        toast.error(result.error ?? t('context.shareError'))
      }
      return result
    },

    async driveCreateProjectFolder(projectId, parentId) {
      return window.electronAPI.driveCreateProjectFolder(projectId, parentId)
    },

    async driveShareProjectFolder(projectId, email) {
      return window.electronAPI.driveShareProjectFolder(projectId, email)
    },
  }

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
