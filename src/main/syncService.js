import { getAppDataFile, upsertAppDataFile } from './driveService.js'

export async function pullProjects(authClient, localState) {
  try {
    const content = await getAppDataFile(authClient, 'projects.json')
    if (!content) return { ok: true, action: 'none', projects: null }
    let driveData
    try {
      driveData = JSON.parse(content)
    } catch {
      return { ok: true, action: 'none', projects: null }
    }
    if (driveData.updatedAt <= (localState.updatedAt ?? 0)) {
      return { ok: true, action: 'none', projects: null }
    }
    const merged = driveData.projects.map((dp) => {
      const lp = localState.projects.find((p) => p.id === dp.id)
      return lp ? { ...dp, outputDir: lp.outputDir } : { ...dp, outputDir: '' }
    })
    const newProjects = driveData.projects.filter(
      (dp) => !localState.projects.find((lp) => lp.id === dp.id)
    )
    return {
      ok: true,
      action: 'pull',
      projects: merged,
      newProjectNames: newProjects.map((p) => p.name),
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export async function pushProjects(authClient, projects) {
  try {
    const content = JSON.stringify({
      updatedAt: Date.now(),
      projects: projects.map(({ id, name, color, outputDir, counter, prefix }) => ({
        id, name, color, outputDir, counter, prefix,
      })),
    })
    return await upsertAppDataFile(authClient, 'projects.json', content)
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
