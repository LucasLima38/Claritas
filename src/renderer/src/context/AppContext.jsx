import { createContext, useContext, useReducer, useEffect, useRef } from 'react'

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
  toast: null,
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
        error: { type: action.errorType, message: action.message },
        toast: action.toastOnly ? { message: action.message, type: 'error' } : null,
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
        toast: { message: `Salvo: ${action.filename}`, type: 'success' },
      }

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

    case 'CLEAR_TOAST':
      return { ...state, toast: null }

    case 'CLEAR_ERROR':
      return { ...state, status: 'idle', error: null }

    default:
      return state
  }
}

const AppContext = createContext(null)

// Applies 'dark' class to <html> based on theme setting + system preference.
// Called whenever settings change or system theme changes.
function applyTheme(theme, systemIsDark) {
  const isDark =
    theme === 'dark' ? true :
    theme === 'light' ? false :
    systemIsDark // 'system'
  document.documentElement.classList.toggle('dark', isDark)
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  // Ref so the onThemeChanged closure always reads the latest theme setting
  const themeRef = useRef('system')

  useEffect(() => {
    // Invoke pattern avoids the did-finish-load race condition where the
    // one-shot 'init' event would fire before React registers its listener.
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
      // Re-apply theme when Windows system theme changes (only matters for 'system' mode)
      window.electronAPI.onThemeChanged(({ isDark }) => {
        applyTheme(themeRef.current, isDark)
      }),
      window.electronAPI.onNavigateTo((_screen) => {
        // Navigation handled in App.jsx via state
      }),
    ]
    return () => cleanups.forEach((fn) => fn?.())
  }, [])

  useEffect(() => {
    if (!state.toast) return
    const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3000)
    return () => clearTimeout(t)
  }, [state.toast])

  const actions = {
    async paste() {
      dispatch({ type: 'PASTE_START' })
      const result = await window.electronAPI.pasteSchematic()
      if (result.ok) {
        dispatch({ type: 'SVG_READY', svgContent: result.svgContent, metadata: result.metadata })
      } else {
        const toastOnly = result.error === 'NO_EMF'
        dispatch({ type: 'CONVERSION_ERROR', errorType: result.error, message: result.message, toastOnly })
      }
    },

    async save() {
      const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
      if (!activeProject) return
      dispatch({ type: 'SAVE_START' })
      const result = await window.electronAPI.saveSVG({ projectId: state.activeProjectId })
      if (result.ok) {
        dispatch({ type: 'SAVE_SUCCESS', filename: result.filename, entry: result.entry, newCounter: result.newCounter })
      } else if (result.error === 'DIR_NOT_FOUND') {
        dispatch({ type: 'CONVERSION_ERROR', errorType: 'DIR_NOT_FOUND', message: `Pasta não encontrada: ${result.outputDir}`, toastOnly: false })
      } else {
        dispatch({ type: 'CONVERSION_ERROR', errorType: result.error, message: result.message, toastOnly: false })
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
      // Use activeProjectId from server so auto-activation of first project is reflected
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
      // If theme changed, apply immediately and keep ref in sync
      if (updates.theme) {
        themeRef.current = settings.theme
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        applyTheme(settings.theme, systemIsDark)
      }
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
