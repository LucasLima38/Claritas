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
