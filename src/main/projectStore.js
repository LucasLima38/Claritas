import _Store from 'electron-store'
// electron-store v9 is ESM-only; Rollup externalises it and emits require(), which
// returns the namespace object { default: StoreClass }.  Unwrap .default so that
// both the CJS production bundle and the ESM Vitest environment get the constructor.
const Store = _Store.default ?? _Store

const PROJECT_DEFAULTS = {
  projects: [],
  activeProjectId: null,
}

const SETTINGS_DEFAULTS = {
  startMinimized: false,
  closeHides: true,
  theme: 'system',
  globalShortcut: 'Ctrl+Shift+V',
  sidebarWidth: 200,
}

export class ProjectStore {
  constructor() {
    this._projects = new Store({ name: 'projects', defaults: PROJECT_DEFAULTS })
    this._settings = new Store({ name: 'settings', defaults: SETTINGS_DEFAULTS })
    this._history = new Store({ name: 'history', defaults: { entries: [] } })
  }

  initSession() {
    this._history.set('entries', [])
  }

  getProjects() {
    return this._projects.get('projects', [])
  }

  getActiveProjectId() {
    return this._projects.get('activeProjectId', null)
  }

  getActiveProject() {
    const id = this.getActiveProjectId()
    const projects = this.getProjects()
    return projects.find((p) => p.id === id) ?? projects[0] ?? null
  }

  setActiveProject(id) {
    this._projects.set('activeProjectId', id)
  }

  addProject(project) {
    const projects = this.getProjects()
    projects.push(project)
    this._projects.set('projects', projects)
  }

  updateProject(id, updates) {
    const projects = this.getProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Project ${id} not found`)
    projects[idx] = { ...projects[idx], ...updates }
    this._projects.set('projects', projects)
  }

  deleteProject(id) {
    const projects = this.getProjects().filter((p) => p.id !== id)
    this._projects.set('projects', projects)
    if (this.getActiveProjectId() === id) {
      this._projects.set('activeProjectId', projects[0]?.id ?? null)
    }
  }

  reorderProjects(ids) {
    const projects = this.getProjects()
    const byId = Object.fromEntries(projects.map((p) => [p.id, p]))
    const reordered = ids.map((id) => byId[id]).filter(Boolean)
    this._projects.set('projects', reordered)
  }

  incrementCounter(projectId) {
    const project = this.getProjects().find((p) => p.id === projectId)
    if (!project) throw new Error(`Project ${projectId} not found`)
    const newCounter = project.counter + 1
    this.updateProject(projectId, { counter: newCounter })
    return newCounter
  }

  getSettings() {
    return {
      startMinimized: this._settings.get('startMinimized', false),
      closeHides: this._settings.get('closeHides', true),
      theme: this._settings.get('theme', 'system'),
      globalShortcut: this._settings.get('globalShortcut', ''),
      sidebarWidth: this._settings.get('sidebarWidth', 200),
    }
  }

  updateSettings(updates) {
    for (const [key, value] of Object.entries(updates)) {
      this._settings.set(key, value)
    }
  }

  addHistoryEntry(entry) {
    const entries = this._history.get('entries', [])
    entries.push(entry)
    this._history.set('entries', entries)
  }

  getHistory() {
    return this._history.get('entries', [])
  }

  deleteHistoryEntry(entryId) {
    const entries = this._history.get('entries', []).filter((e) => e.id !== entryId)
    this._history.set('entries', entries)
  }
}
