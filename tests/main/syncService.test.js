// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/main/driveService.js', () => ({
  getAppDataFile: vi.fn(),
  upsertAppDataFile: vi.fn().mockResolvedValue({ ok: true }),
}))

let syncService
let driveService

beforeEach(async () => {
  vi.resetModules()
  driveService = await import('../../src/main/driveService.js')
  syncService = await import('../../src/main/syncService.js')
})

describe('pullProjects', () => {
  it('returns action none when Drive file does not exist', async () => {
    driveService.getAppDataFile.mockResolvedValue(null)
    const local = { updatedAt: 0, projects: [] }
    const result = await syncService.pullProjects({}, local)
    expect(result).toEqual({ ok: true, action: 'none', projects: null })
  })

  it('returns action none when Drive data is not newer than local', async () => {
    const driveData = { updatedAt: 100, projects: [{ id: '1', name: 'P1', color: '#fff', outputDir: 'C:\\out', counter: 0 }] }
    driveService.getAppDataFile.mockResolvedValue(JSON.stringify(driveData))
    const local = { updatedAt: 200, projects: [{ id: '1', name: 'P1', color: '#fff', outputDir: 'C:\\out', counter: 0 }] }
    const result = await syncService.pullProjects({}, local)
    expect(result).toEqual({ ok: true, action: 'none', projects: null })
  })

  it('returns pull action when Drive is newer', async () => {
    const driveData = { updatedAt: 500, projects: [{ id: '1', name: 'P1', color: '#aaa', outputDir: 'C:\\out', counter: 3 }] }
    driveService.getAppDataFile.mockResolvedValue(JSON.stringify(driveData))
    const local = { updatedAt: 100, projects: [{ id: '1', name: 'P1', color: '#aaa', outputDir: 'C:\\local', counter: 1 }] }
    const result = await syncService.pullProjects({}, local)
    expect(result.ok).toBe(true)
    expect(result.action).toBe('pull')
    expect(result.projects[0].outputDir).toBe('C:\\local')
    expect(result.newProjectNames).toEqual([])
  })

  it('keeps local outputDir for existing project ids', async () => {
    const driveData = { updatedAt: 999, projects: [{ id: 'abc', name: 'Alpha', color: '#f00', outputDir: 'D:\\drive', counter: 2 }] }
    driveService.getAppDataFile.mockResolvedValue(JSON.stringify(driveData))
    const local = { updatedAt: 1, projects: [{ id: 'abc', name: 'Alpha', color: '#f00', outputDir: 'C:\\local\\alpha', counter: 2 }] }
    const result = await syncService.pullProjects({}, local)
    expect(result.projects[0].outputDir).toBe('C:\\local\\alpha')
  })

  it('sets outputDir to empty string for new projects from Drive', async () => {
    const driveData = { updatedAt: 999, projects: [{ id: 'new-id', name: 'Beta', color: '#00f', outputDir: 'D:\\other', counter: 0 }] }
    driveService.getAppDataFile.mockResolvedValue(JSON.stringify(driveData))
    const local = { updatedAt: 1, projects: [] }
    const result = await syncService.pullProjects({}, local)
    expect(result.projects[0].outputDir).toBe('')
    expect(result.newProjectNames).toEqual(['Beta'])
  })

  it('returns action none when Drive JSON is corrupted', async () => {
    driveService.getAppDataFile.mockResolvedValue('not valid json{{')
    const local = { updatedAt: 0, projects: [] }
    const result = await syncService.pullProjects({}, local)
    expect(result).toEqual({ ok: true, action: 'none', projects: null })
  })
})

describe('pushProjects', () => {
  it('calls upsertAppDataFile with serialized project data', async () => {
    const projects = [{ id: '1', name: 'P1', color: '#fff', outputDir: 'C:\\out', counter: 2, prefix: 'P' }]
    await syncService.pushProjects({}, projects)
    expect(driveService.upsertAppDataFile).toHaveBeenCalledTimes(1)
    const [, filename, content] = driveService.upsertAppDataFile.mock.calls[0]
    expect(filename).toBe('projects.json')
    const parsed = JSON.parse(content)
    expect(parsed.projects[0].id).toBe('1')
    expect(typeof parsed.updatedAt).toBe('number')
    expect(parsed.projects[0].prefix).toBe('P')
  })
})
