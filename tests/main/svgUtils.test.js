import { describe, it, expect } from 'vitest'
import { isValidSVG, getSVGMetadata, optimizeSvg } from '../../src/main/svgUtils.js'

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
