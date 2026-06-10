import { optimize } from 'svgo'

export function isValidSVG(svgContent) {
  if (!svgContent || svgContent.trim().length === 0) return false
  if (!svgContent.includes('<svg')) return false
  const bodyMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  if (!bodyMatch) return false
  return bodyMatch[1].trim().length > 10
}

export function getSVGMetadata(svgContent, conversionMs) {
  const widthMatch = svgContent.match(/width="([^"]+)"/)
  const heightMatch = svgContent.match(/height="([^"]+)"/)
  return {
    width: widthMatch?.[1] ?? 'unknown',
    height: heightMatch?.[1] ?? 'unknown',
    sizeBytes: Buffer.byteLength(svgContent, 'utf8'),
    conversionMs,
  }
}

async function removeBackground(b64) {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    return b64
  }

  const src = Buffer.from(b64, 'base64')

  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info

  if (w < 2 || h < 2) return b64

  const corners = [0, w - 1, (h - 1) * w, (h - 1) * w + (w - 1)]
  const avgR = corners.reduce((s, pi) => s + data[pi * 4],     0) / 4
  const avgG = corners.reduce((s, pi) => s + data[pi * 4 + 1], 0) / 4
  const avgB = corners.reduce((s, pi) => s + data[pi * 4 + 2], 0) / 4

  const isNearBlack = avgR < 30  && avgG < 30  && avgB < 30
  const isNearWhite = avgR > 225 && avgG > 225 && avgB > 225
  if (!isNearBlack && !isNearWhite) return b64

  // Tight tolerance for black backgrounds: only pure-black pixels are removed.
  // tol=30 would flood through dark logo shadows (e.g. dark maroon at (20,5,3)).
  // tol=10 stops BFS at the logo edge without crossing into shadow channels.
  const tol = isNearBlack ? 10 : 30
  const isBg = (pi) => {
    const i = pi * 4
    return (
      Math.abs(data[i]     - avgR) <= tol &&
      Math.abs(data[i + 1] - avgG) <= tol &&
      Math.abs(data[i + 2] - avgB) <= tol
    )
  }

  const removed = new Uint8Array(w * h)
  const visited = new Uint8Array(w * h)
  const queue   = [...corners]

  while (queue.length > 0) {
    const pi = queue.pop()
    if (pi < 0 || pi >= w * h || visited[pi]) continue
    visited[pi] = 1
    if (!isBg(pi)) continue
    removed[pi] = 1
    const x = pi % w
    const y = Math.floor(pi / w)
    if (x > 0)     queue.push(pi - 1)
    if (x < w - 1) queue.push(pi + 1)
    if (y > 0)     queue.push(pi - w)
    if (y < h - 1) queue.push(pi + w)
  }

  let changed = false
  let bfsCount = 0
  for (let pi = 0; pi < w * h; pi++) {
    if (removed[pi]) {
      data[pi * 4 + 3] = 0
      changed = true
      bfsCount++
    }
  }
  // For white-bg images: remove small enclosed white pockets (letter counters: inside O, B, A…).
  // BFS from corners already removed the outer background; remaining near-white pixels are
  // fully enclosed. Small regions = letter counters → remove. Large regions = structural
  // fills that may overlay other SVG content → keep.
  if (isNearWhite) {
    const maxCounterArea = Math.ceil(w * h * 0.05)
    const seen = new Uint8Array(w * h)
    const bfsRemovedCount = removed.reduce((s, v) => s + v, 0)

    for (let start = 0; start < w * h; start++) {
      if (data[start * 4 + 3] === 0 || seen[start] || !isBg(start)) continue

      const region = [start]
      const q = [start]
      seen[start] = 1

      while (q.length > 0) {
        const pi = q.pop()
        const x = pi % w, y = Math.floor(pi / w)
        if (x > 0   && !seen[pi-1] && data[(pi-1)*4+3] > 0 && isBg(pi-1)) { seen[pi-1]=1; q.push(pi-1); region.push(pi-1) }
        if (x < w-1 && !seen[pi+1] && data[(pi+1)*4+3] > 0 && isBg(pi+1)) { seen[pi+1]=1; q.push(pi+1); region.push(pi+1) }
        if (y > 0   && !seen[pi-w] && data[(pi-w)*4+3] > 0 && isBg(pi-w)) { seen[pi-w]=1; q.push(pi-w); region.push(pi-w) }
        if (y < h-1 && !seen[pi+w] && data[(pi+w)*4+3] > 0 && isBg(pi+w)) { seen[pi+w]=1; q.push(pi+w); region.push(pi+w) }
      }

      if (region.length <= maxCounterArea) {
        for (const pi of region) { data[pi * 4 + 3] = 0; changed = true }
      }
    }
  }

  if (!changed) return b64

  const out = await sharp(data, {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer()

  return out.toString('base64')
}

export async function processEmbeddedImages(svgContent) {
  // Process ALL embedded images — do not deduplicate.
  // Altium embeds manufacturer icons twice at the same position:
  //   img1 (white bg, monochrome): may contain text/details absent from img2
  //   img2 (black bg, colored):    provides the color version of the logo
  // SVG renders in document order so img2 sits on top; where img2 is transparent
  // img1's content (e.g. "SILICON LABS" text) shows through naturally.
  const hrefRe = /\b(?:xlink:href|href)="data:image\/png;base64,([^"]+)"/
  const imageTagRe = /<image\b[^>]*>/g

  const segments = []
  let lastIdx = 0
  let match

  while ((match = imageTagRe.exec(svgContent)) !== null) {
    segments.push(svgContent.slice(lastIdx, match.index))
    const tag = match[0]
    const hrefMatch = tag.match(hrefRe)

    if (hrefMatch) {
      const b64 = hrefMatch[1]
      const newB64 = await removeBackground(b64)
      segments.push(tag.replace(b64, newB64))
    } else {
      segments.push(tag)
    }

    lastIdx = match.index + tag.length
  }

  segments.push(svgContent.slice(lastIdx))
  return segments.join('')
}

// Inkscape's EMF conversion sizes the canvas to the drawing's vector geometry,
// but text glyphs (rendered as <text>, one element per glyph for rotated labels)
// can extend past it and get clipped. Expand the canvas to cover all text anchors.
export function expandCanvasToContent(svgContent) {
  const dimMatch = svgContent.match(/<svg([^>]*?)\swidth="([\d.]+)"\s+height="([\d.]+)"/)
  if (!dimMatch || /viewBox/.test(svgContent.match(/<svg[^>]*>/)?.[0] ?? '')) return svgContent
  const width = parseFloat(dimMatch[2])
  const height = parseFloat(dimMatch[3])

  // Texts live inside an outer translate group; account for it.
  let tx = 0, ty = 0
  const outerT = svgContent.match(/<g\s+transform="translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)"/)
  if (outerT) {
    tx = parseFloat(outerT[1])
    ty = parseFloat(outerT[2])
  }

  let minX = 0, minY = 0, maxX = width, maxY = height
  const textRe = /<text\b([^>]*)>/g
  let found = false
  let m
  while ((m = textRe.exec(svgContent)) !== null) {
    const attrs = m[1]
    const x = parseFloat(attrs.match(/\bx="(-?[\d.]+)"/)?.[1] ?? '0')
    const y = parseFloat(attrs.match(/\by="(-?[\d.]+)"/)?.[1] ?? '0')
    const fontSize = parseFloat(attrs.match(/font-size="([\d.]+)"/)?.[1] ?? '10')
    const rot = attrs.match(
      /rotate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)(?:\s*translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\))?/
    )
    let px = x, py = y
    if (rot) {
      const rad = (parseFloat(rot[1]) * Math.PI) / 180
      const cx = parseFloat(rot[2])
      const cy = parseFloat(rot[3])
      const lx = x + parseFloat(rot[4] ?? '0')
      const ly = y + parseFloat(rot[5] ?? '0')
      px = cx + (lx - cx) * Math.cos(rad) - (ly - cy) * Math.sin(rad)
      py = cy + (lx - cx) * Math.sin(rad) + (ly - cy) * Math.cos(rad)
    }
    px += tx
    py += ty
    minX = Math.min(minX, px - fontSize)
    minY = Math.min(minY, py - fontSize)
    maxX = Math.max(maxX, px + fontSize)
    maxY = Math.max(maxY, py + fontSize)
    found = true
  }

  if (!found || (minX >= 0 && minY >= 0 && maxX <= width && maxY <= height)) return svgContent

  const pad = 2
  const vbX = Math.floor(minX) - pad
  const vbY = Math.floor(minY) - pad
  const vbW = Math.ceil(maxX) + pad - vbX
  const vbH = Math.ceil(maxY) + pad - vbY

  return svgContent.replace(
    dimMatch[0],
    `<svg${dimMatch[1]} width="${vbW}" height="${vbH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}"`
  )
}

// Inkscape's EMF conversion emits rotated glyphs as
// rotate(±90, x, y+dy) translate(0, dy), where dy is the font ascent
// (0.9 × font-size). That applies the baseline offset along screen Y, but for
// ±90° text it must act along the rotated baseline axis — every vertical label
// lands dy units too low (-90°) or too high (+90°), so labels on a symbol's
// top edge sit too far inside while bottom-edge labels touch the border.
// Compensate with a local-space X offset, which rotation maps onto screen Y.
export function fixRotatedTextBaseline(svgContent) {
  return svgContent.replace(
    /transform="rotate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)\s*translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)"/g,
    (match, angle, cx, cy, tdx, tdy) => {
      const a = parseFloat(angle)
      const dy = parseFloat(tdy)
      if (Math.abs(Math.abs(a) - 90) > 1 || dy === 0) return match
      const localDx = a < 0 ? dy : -dy
      return `transform="rotate(${angle}, ${cx}, ${cy}) translate(${parseFloat(tdx) + localDx}, ${tdy})"`
    }
  )
}

export function optimizeSvg(svgContent) {
  try {
    const result = optimize(svgContent, {
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              removeViewBox: false,
              cleanupIds: false,
            },
          },
        },
      ],
    })
    return result.data
  } catch {
    return svgContent
  }
}
