import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── sharp mock (used by removeBackground inside processEmbeddedImages) ──

const mockSharpToBuffer = vi.fn()
const mockSharpInstance = {
  ensureAlpha: vi.fn().mockReturnThis(),
  raw: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  toBuffer: mockSharpToBuffer,
}
const mockSharpFn = vi.fn().mockReturnValue(mockSharpInstance)

vi.mock('sharp', () => ({ default: mockSharpFn }))

import { isValidSVG, getSVGMetadata, optimizeSvg, processEmbeddedImages, expandCanvasToContent, fixRotatedTextBaseline } from '../../src/main/svgUtils.js'

beforeEach(() => vi.clearAllMocks())

describe('isValidSVG()', () => {
  it('returns true for valid SVG with content', () => {
    expect(
      isValidSVG('<svg xmlns="..."><rect x="0" y="0" width="10" height="10"/></svg>')
    ).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isValidSVG('')).toBe(false)
  })

  it('returns false for SVG with empty body', () => {
    expect(isValidSVG('<svg xmlns="..."></svg>')).toBe(false)
  })

  it('returns false for non-SVG content', () => {
    expect(isValidSVG('Hello world')).toBe(false)
  })
})

describe('getSVGMetadata()', () => {
  it('extracts width and height from svg root element', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="148mm"><rect width="50" height="50"/></svg>'
    const meta = getSVGMetadata(svg, 500)
    expect(meta.width).toBe('210mm')
    expect(meta.height).toBe('148mm')
  })

  it('returns unknown when svg has no width/height attributes', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>'
    const meta = getSVGMetadata(svg, 100)
    expect(meta.width).toBe('unknown')
    expect(meta.height).toBe('unknown')
  })

  it('reports sizeBytes as byte length of the SVG string', () => {
    const svg = '<svg></svg>'
    const meta = getSVGMetadata(svg, 0)
    expect(meta.sizeBytes).toBe(Buffer.byteLength(svg, 'utf8'))
  })

  it('passes through conversionMs unchanged', () => {
    const meta = getSVGMetadata('<svg width="1" height="1"></svg>', 1234)
    expect(meta.conversionMs).toBe(1234)
  })
})

describe('optimizeSvg()', () => {
  it('strips XML comments from SVG', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><!-- comment --><rect width="50" height="50"/></svg>'
    const result = optimizeSvg(svg)
    expect(result).not.toContain('<!-- comment -->')
  })

  it('preserves viewBox attribute', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 148"><rect width="50" height="50"/></svg>'
    const result = optimizeSvg(svg)
    expect(result).toContain('viewBox="0 0 210 148"')
  })

  it('returns original SVG string unchanged when SVGO throws', () => {
    const malformed = 'not valid svg at all <<<'
    const result = optimizeSvg(malformed)
    expect(result).toBe(malformed)
  })
})

describe('processEmbeddedImages()', () => {
  it('returns the same content when there are no image tags', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    expect(await processEmbeddedImages(svg)).toBe(svg)
  })

  it('keeps both image tags at the same position (img1 monochrome + img2 colored layer)', async () => {
    const img = '<image width="100" height="50" x="10" y="20" xlink:href="data:image/png;base64,abc">'
    const svg = `<svg>${img}${img}</svg>`

    // 2×2 gray RGBA image → neutral corners (avgR=128) → removeBackground returns b64 unchanged
    const gray2x2 = Buffer.from([128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255])
    mockSharpToBuffer.mockResolvedValue({ data: gray2x2, info: { width: 2, height: 2 } })

    const result = await processEmbeddedImages(svg)
    // Both images are kept: img2 (colored) renders on top; img1 shows through transparent areas
    expect([...result.matchAll(/<image\b/g)]).toHaveLength(2)
  })

  it('keeps two image tags at different positions', async () => {
    const img1 = '<image width="100" height="50" x="10" y="20" xlink:href="data:image/png;base64,abc">'
    const img2 = '<image width="100" height="50" x="50" y="20" xlink:href="data:image/png;base64,def">'
    const svg = `<svg>${img1}${img2}</svg>`

    const gray2x2 = Buffer.from([128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255])
    mockSharpToBuffer.mockResolvedValue({ data: gray2x2, info: { width: 2, height: 2 } })

    const result = await processEmbeddedImages(svg)
    expect([...result.matchAll(/<image\b/g)]).toHaveLength(2)
  })

  it('leaves image tags without PNG data href unchanged', async () => {
    const tag = '<image width="10" height="10" x="0" y="0" href="data:image/jpeg;base64,xyz">'
    const svg = `<svg>${tag}</svg>`
    const result = await processEmbeddedImages(svg)
    expect(result).toContain(tag)
    expect(mockSharpFn).not.toHaveBeenCalled()
  })

  it('makes black pixels transparent when all image corners are black', async () => {
    // 2×2 RGBA: all 4 pixels opaque black
    const rawBlack = Buffer.from([
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
    ])

    mockSharpToBuffer
      .mockResolvedValueOnce({ data: rawBlack, info: { width: 2, height: 2 } })
      .mockResolvedValueOnce(Buffer.from('processed-png'))

    const b64Input = Buffer.from('fake-png').toString('base64')
    const img = `<image width="10" height="10" x="0" y="0" xlink:href="data:image/png;base64,${b64Input}">`
    const svg = `<svg>${img}</svg>`

    const result = await processEmbeddedImages(svg)

    expect(result).toContain(Buffer.from('processed-png').toString('base64'))
    expect(mockSharpFn).toHaveBeenCalledTimes(2)
  })

  it('makes white background transparent when all image corners are white', async () => {
    // 2×2 RGBA: all 4 pixels opaque white
    const rawWhite = Buffer.from([
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ])

    mockSharpToBuffer
      .mockResolvedValueOnce({ data: rawWhite, info: { width: 2, height: 2 } })
      .mockResolvedValueOnce(Buffer.from('processed-png'))

    const b64Input = Buffer.from('fake-png').toString('base64')
    const img = `<image width="10" height="10" x="0" y="0" xlink:href="data:image/png;base64,${b64Input}">`
    const svg = `<svg>${img}</svg>`

    const result = await processEmbeddedImages(svg)

    expect(result).toContain(Buffer.from('processed-png').toString('base64'))
    expect(mockSharpFn).toHaveBeenCalledTimes(2)
  })

  it('leaves image unchanged when corners are neutral (not near-black or near-white)', async () => {
    // 2×2 RGBA: all 4 pixels mid-gray → avgR=avgG=avgB=128, neither near-black nor near-white
    const gray2x2 = Buffer.from([128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255])
    mockSharpToBuffer.mockResolvedValueOnce({ data: gray2x2, info: { width: 2, height: 2 } })

    const b64Input = Buffer.from('original-png').toString('base64')
    const img = `<image width="10" height="10" x="0" y="0" xlink:href="data:image/png;base64,${b64Input}">`
    const svg = `<svg>${img}</svg>`

    const result = await processEmbeddedImages(svg)

    expect(result).toContain(b64Input)
    // sharp called once for analysis only, not for re-encoding
    expect(mockSharpFn).toHaveBeenCalledTimes(1)
  })
})

describe('expandCanvasToContent()', () => {
  const wrap = (texts, w = 100, h = 100) =>
    `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${w}.0000" height="${h}.0000"><g transform="translate(-9.0000, -9.0000)">${texts}</g></svg>`

  it('returns SVG unchanged when all text fits within the canvas', () => {
    const svg = wrap('<text x="50" y="50" font-size="10"><![CDATA[A]]></text>')
    expect(expandCanvasToContent(svg)).toBe(svg)
  })

  it('returns SVG unchanged when there are no text elements', () => {
    const svg = wrap('<path d="M0 0 L10 10"/>')
    expect(expandCanvasToContent(svg)).toBe(svg)
  })

  it('returns SVG unchanged when a viewBox already exists', () => {
    const svg = '<svg width="100" height="100" viewBox="0 0 100 100"><text x="500" y="500" font-size="10">A</text></svg>'
    expect(expandCanvasToContent(svg)).toBe(svg)
  })

  it('expands canvas when plain text exceeds the bottom edge', () => {
    const svg = wrap('<text x="50" y="120" font-size="10"><![CDATA[A]]></text>')
    const out = expandCanvasToContent(svg)
    const vb = out.match(/viewBox="(-?\d+) (-?\d+) (\d+) (\d+)"/)
    expect(vb).not.toBeNull()
    const [, x, y, w, h] = vb.map(Number)
    expect(y).toBeLessThanOrEqual(0)
    expect(y + h).toBeGreaterThanOrEqual(121)
    expect(out).toMatch(new RegExp(`width="${w}" height="${h}"`))
  })

  it('accounts for rotate + translate transforms on rotated pin labels', () => {
    // Glyph anchored at (231, 55), rotate(-90) about (231, 62.2) after translate(0, 7.2):
    // local point (231, 62.2) rotates to itself → screen (231, 62.2), then outer translate(-9,-9).
    const svg = wrap(
      '<text transform="rotate(-90, 231.0000, 350.0000) translate(0, 7.2000)" x="231.0000" y="342.8000" font-size="7.2"><![CDATA[G]]></text>',
      333, 327
    )
    const out = expandCanvasToContent(svg)
    const vb = out.match(/viewBox="(-?\d+) (-?\d+) (\d+) (\d+)"/)
    expect(vb).not.toBeNull()
    const [, , y, , h] = vb.map(Number)
    expect(y + h).toBeGreaterThanOrEqual(348)
  })
})

describe('fixRotatedTextBaseline()', () => {
  it('adds the baseline offset as local dx for -90° glyphs', () => {
    const svg = '<text transform="rotate(-90, 231.0000, 350.0000) translate(0, 7.2000)" x="231.0000" y="342.8000" font-size="8.0000"><![CDATA[G]]></text>'
    const out = fixRotatedTextBaseline(svg)
    expect(out).toContain('rotate(-90, 231.0000, 350.0000) translate(7.2, 7.2000)')
  })

  it('subtracts the baseline offset as local dx for +90° glyphs', () => {
    const svg = '<text transform="rotate(90, 100.0000, 50.0000) translate(0, 7.2000)" x="100.0000" y="42.8000" font-size="8.0000"><![CDATA[G]]></text>'
    const out = fixRotatedTextBaseline(svg)
    expect(out).toContain('rotate(90, 100.0000, 50.0000) translate(-7.2, 7.2000)')
  })

  it('preserves an existing non-zero translate dx', () => {
    const svg = '<text transform="rotate(-90, 10, 20) translate(1.5, 7.2000)" x="10" y="12.8"><![CDATA[A]]></text>'
    const out = fixRotatedTextBaseline(svg)
    expect(out).toContain('rotate(-90, 10, 20) translate(8.7, 7.2000)')
  })

  it('leaves non-±90° rotations untouched', () => {
    const svg = '<text transform="rotate(-45, 10, 20) translate(0, 7.2000)" x="10" y="12.8"><![CDATA[A]]></text>'
    expect(fixRotatedTextBaseline(svg)).toBe(svg)
  })

  it('leaves zero baseline offsets untouched', () => {
    const svg = '<text transform="rotate(-90, 10, 20) translate(0, 0)" x="10" y="20"><![CDATA[A]]></text>'
    expect(fixRotatedTextBaseline(svg)).toBe(svg)
  })
})
