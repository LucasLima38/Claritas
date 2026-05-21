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

const SVG_UNIT_TO_PT = { px: 72 / 96, pt: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72 }

function parseSvgDimsToPt(svgContent) {
  const re = /(?:width|height)="([\d.]+)(px|pt|mm|cm|in)?"/g
  const dims = []
  let m
  while ((m = re.exec(svgContent)) !== null && dims.length < 2) {
    dims.push(parseFloat(m[1]) * (SVG_UNIT_TO_PT[m[2] ?? 'px'] ?? SVG_UNIT_TO_PT.px))
  }
  return dims.length === 2 ? dims : [595.28, 841.89] // A4 fallback
}

export async function exportToFormat(svgContent, format, outputPath) {
  if (format === 'svg') {
    await fsp.writeFile(outputPath, svgContent, 'utf8')
    return
  }
  if (format === 'png') {
    const { Resvg } = await import('@resvg/resvg-js')
    const resvg = new Resvg(svgContent, { fitTo: { mode: 'zoom', value: 300 / 96 } })
    await fsp.writeFile(outputPath, resvg.render().asPng())
    return
  }
  if (format === 'jpg') {
    const { Resvg } = await import('@resvg/resvg-js')
    const sharp = (await import('sharp')).default
    const resvg = new Resvg(svgContent, { fitTo: { mode: 'zoom', value: 300 / 96 } })
    const pngBuffer = resvg.render().asPng()
    const jpgBuffer = await sharp(pngBuffer).flatten({ background: '#ffffff' }).jpeg({ quality: 95 }).toBuffer()
    await fsp.writeFile(outputPath, jpgBuffer)
    return
  }
  if (format === 'pdf') {
    const PDFDocument = (await import('pdfkit')).default
    const SVGtoPDF = (await import('svg-to-pdfkit')).default
    const [widthPt, heightPt] = parseSvgDimsToPt(svgContent)
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ autoFirstPage: false })
      const chunks = []
      doc.on('data', c => chunks.push(c))
      doc.on('end', () => fsp.writeFile(outputPath, Buffer.concat(chunks)).then(resolve).catch(reject))
      doc.on('error', reject)
      doc.addPage({ size: [widthPt, heightPt], margin: 0 })
      SVGtoPDF(doc, svgContent, 0, 0, { width: widthPt, height: heightPt })
      doc.end()
    })
    return
  }
  throw new Error(`Formato não suportado: ${format}`)
}

export async function generateThumbnail(svgContent) {
  const { Resvg } = await import('@resvg/resvg-js')
  const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 300 } })
  return resvg.render().asPng()
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
