import { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { toast } from 'sonner'

// status: 'idle' | 'converting' | 'preview' | 'saving' | 'error'

const initialState = {
  status: 'idle',
  svgContent: null,
  svgMetadata: null,
  error: null,
  projects: [],
  activeProjectId: null,
  history: [],
  settings: {},
  dirMissing: false,
  dirMissingPath: null,
  exportFormat: 'svg',
}

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        projects: action.projects,
        activeProjectId: action.activeProjectId,
        settings: action.settings,
        history: action.history,
      }

    case 'PASTE_START':
      return { ...state, status: 'converting', error: null }

    case 'SVG_READY':
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

    case 'SAVE_SUCCESS':
      return {
        ...state,
        status: 'idle',
        svgContent: null,
        svgMetadata: null,
        history: [action.entry, ...state.history],
        projects: state.projects.map((p) =>
          p.id === action.entry.projectId
            ? { ...p, counter: action.newCounter }
            : p
        ),
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

    case 'DISCARD':
      return {
        ...state,
        status: 'idle',
        svgContent: null,
        svgMetadata: null,
        error: null,
      }

    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.id }

    case 'PROJECTS_UPDATED':
      return {
        ...state,
        projects: action.projects,
        activeProjectId: action.activeProjectId ?? state.activeProjectId,
      }

    case 'SETTINGS_UPDATED':
      return { ...state, settings: action.settings }

    case 'SET_EXPORT_FORMAT':
      return { ...state, exportFormat: action.format }

    case 'CLEAR_ERROR':
      return { ...state, status: 'idle', error: null }

    default:
      return state
  }
}

const AppContext = createContext(null)

const THEME_CLASSES = ['dark', 'theme-snnabb', 'theme-charcoal', 'theme-black-moon', 'theme-blue-moon']

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
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const themeRef = useRef('system')

  useEffect(() => {
    window.electronAPI.getInitData().then((data) => {
      dispatch({ type: 'INIT', ...data })
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
      }
    },

    async save() {
      const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
      if (!activeProject) {
        toast.error('Nenhum projeto ativo. Selecione um projeto nas configurações.')
        return
      }
      dispatch({ type: 'SAVE_START' })
      let result
      try {
        result = await window.electronAPI.saveSVG({ projectId: state.activeProjectId, format: state.exportFormat })
      } catch (err) {
        toast.error(`Erro de comunicação: ${err.message}`)
        dispatch({ type: 'SAVE_ERROR' })
        return
      }
      if (!result) {
        toast.error('Resposta inválida do processo principal.')
        dispatch({ type: 'SAVE_ERROR' })
        return
      }
      if (result.ok) {
        dispatch({ type: 'SAVE_SUCCESS', filename: result.filename, entry: result.entry, newCounter: result.newCounter })
        toast.success(`Salvo: ${result.filename}`)
      } else if (result.dirMissing) {
        dispatch({ type: 'DIR_MISSING', outputDir: result.outputDir ?? null })
      } else if (result.error === 'EACCES') {
        toast.error('Sem permissão de escrita na pasta de destino.')
        dispatch({ type: 'SAVE_ERROR' })
      } else {
        toast.error(result.message || 'Erro desconhecido ao salvar.')
        dispatch({ type: 'SAVE_ERROR' })
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

    async updateSettings(updates) {
      const settings = await window.electronAPI.updateSettings(updates)
      dispatch({ type: 'SETTINGS_UPDATED', settings })
      if (updates.theme) {
        themeRef.current = settings.theme
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        applyTheme(settings.theme, systemIsDark)
      }
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
  }

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
