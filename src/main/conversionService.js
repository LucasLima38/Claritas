import { promises as fsp } from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { isValidSVG, getSVGMetadata, optimizeSvg } from './svgUtils.js'

export { isValidSVG, getSVGMetadata }

let _shell = null

export function setShell(shell) {
  _shell = shell
}

export async function exportToFormat(svgContent, format, outputPath, timeout = 30_000) {
  if (format === 'svg') {
    await fsp.writeFile(outputPath, svgContent, 'utf8')
    return
  }
  if (!_shell) throw new Error('SHELL_NOT_INITIALIZED')

  const tmpSvg = path.join(os.tmpdir(), `schclip_exp_${randomUUID()}.svg`)
  await fsp.writeFile(tmpSvg, svgContent, 'utf8')
  try {
    const inkFormat = format === 'jpg' ? 'jpeg' : format
    const parts = [
      `file-open:${tmpSvg}`,
      `export-type:${inkFormat}`,
    ]
    if (format !== 'pdf') parts.push('export-dpi:300')
    if (format === 'jpg')  parts.push('export-jpeg-quality:95')
    parts.push(`export-filename:${outputPath}`, 'export-do', 'file-close')
    const actions = parts.join('; ')
    await _shell.execute(actions, timeout)
  } finally {
    await fsp.unlink(tmpSvg).catch(() => {})
  }
}

export async function convert(emfBuffer, timeout = 15_000) {
  const id = randomUUID()
  const tmpDir = os.tmpdir()
  const emfPath = path.join(tmpDir, `schclip_${id}.emf`)
  const svgPath = path.join(tmpDir, `schclip_${id}.svg`)

  await fsp.writeFile(emfPath, emfBuffer)
  try {
    if (!_shell) throw new Error('SHELL_NOT_INITIALIZED')
    await _shell.convert(emfPath, svgPath, timeout)
    const svgContent = await fsp.readFile(svgPath, 'utf8')
    return optimizeSvg(svgContent)
  } finally {
    await fsp.unlink(emfPath).catch(() => {})
    await fsp.unlink(svgPath).catch(() => {})
  }
}
