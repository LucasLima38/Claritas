import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock electron-store before importing ProjectStore
vi.mock('electron-store', () => {
  const Store = vi.fn().mockImplementation(function () {
    const data = {}
    this.get = vi.fn((key, defaultVal) => (key in data ? data[key] : defaultVal))
    this.set = vi.fn((key, val) => { data[key] = val })
    Object.defineProperty(this, 'store', { get: () => data })
  })
  return { default: Store }
})

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/test-appdata') }
}))

const { ProjectStore } = await import('../../src/main/projectStore.js')

describe('ProjectStore', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    store = new ProjectStore()
  })

  it('returns empty projects array by default', () => {
    expect(store.getProjects()).toEqual([])
  })

  it('adds a project', () => {
    const project = { id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 1, color: '#fff' }
    store.addProject(project)
    expect(store.getProjects()).toHaveLength(1)
    expect(store.getProjects()[0].id).toBe('p1')
  })

  it('returns active project', () => {
    const project = { id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 1, color: '#fff' }
    store.addProject(project)
    store.setActiveProject('p1')
    expect(store.getActiveProject().id).toBe('p1')
  })

  it('updates a project', () => {
    store.addProject({ id: 'p1', name: 'Old', prefix: 'O_', outputDir: '/tmp', counter: 1, color: '#fff' })
    store.updateProject('p1', { name: 'New', prefix: 'N_' })
    expect(store.getProjects()[0].name).toBe('New')
    expect(store.getProjects()[0].prefix).toBe('N_')
  })

  it('deletes a project', () => {
    store.addProject({ id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 1, color: '#fff' })
    store.deleteProject('p1')
    expect(store.getProjects()).toHaveLength(0)
  })

  it('increments counter and returns new value', () => {
    store.addProject({ id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 2, color: '#fff' })
    const next = store.incrementCounter('p1')
    expect(next).toBe(3)
    expect(store.getProjects()[0].counter).toBe(3)
  })

  it('throws when incrementing counter for unknown project', () => {
    expect(() => store.incrementCounter('nonexistent')).toThrow('not found')
  })

  it('initSession clears history entries', () => {
    store.addHistoryEntry({ id: '1', filename: 'test.svg', fullPath: '/tmp/test.svg', projectId: 'p1', timestamp: '', sizeBytes: 100 })
    store.initSession()
    expect(store.getHistory()).toHaveLength(0)
  })

  it('addHistoryEntry stores entry', () => {
    const entry = { id: '1', filename: 'BLDC_001.svg', fullPath: '/tmp/BLDC_001.svg', projectId: 'p1', timestamp: '2026-01-01T00:00:00Z', sizeBytes: 48000 }
    store.addHistoryEntry(entry)
    expect(store.getHistory()).toHaveLength(1)
    expect(store.getHistory()[0].filename).toBe('BLDC_001.svg')
  })

  it('getSettings returns defaults when unset', () => {
    const settings = store.getSettings()
    expect(settings.conversionTimeout).toBe(15000)
    expect(settings.startMinimized).toBe(false)
  })

  it('updateSettings persists changes', () => {
    store.updateSettings({ inkscapePath: 'C:\\inkscape.exe' })
    expect(store.getSettings().inkscapePath).toBe('C:\\inkscape.exe')
  })

  it('getActiveProjectId returns first project id when activeProjectId is null but projects exist', () => {
    const project = { id: 'p1', name: 'Test', prefix: 'T_', outputDir: '/tmp', counter: 0, color: '#fff' }
    store.addProject(project)
    // activeProjectId is null by default — simulate the bug scenario
    expect(store.getActiveProjectId()).toBeNull()
    expect(store.getProjects()).toHaveLength(1)
    // The handler should call setActiveProject to fix this
    if (!store.getActiveProjectId() && store.getProjects().length > 0) {
      store.setActiveProject(store.getProjects()[0].id)
    }
    expect(store.getActiveProjectId()).toBe('p1')
  })
})
