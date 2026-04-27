# No-Inkscape EMF→SVG Pipeline — Design Spec

**Date:** 2026-04-27  
**Status:** Approved  
**Goal:** Eliminate the Inkscape dependency from Claritas by exploring 4 alternative conversion approaches across 4 parallel experimental branches.

---

## Context

Claritas currently depends on Inkscape in `--shell` mode for two tasks:
1. **EMF→SVG conversion** — raw EMF bytes from Altium clipboard → SVG string
2. **SVG→PNG/JPG/PDF export** — rasterization and PDF generation at save time

Inkscape is bundled (~200 MB), requires a setup script, and has cold-start / shell reliability issues. The goal is to eliminate this dependency while keeping both SVG vector and PNG/JPG/PDF raster export working.

**License constraint:** The app targets commercial distribution. GPL-2.0 libraries are excluded from production candidates (Branch 4 is a quality benchmark only).

---

## Interface Contract

All branches must preserve the exact public interface of `conversionService.js`:

```js
convert(emfBuffer: Buffer): Promise<{ svgContent: string, metadata: SvgMetadata }>
exportToFormat(svgContent: string, format: 'svg'|'png'|'jpg'|'pdf', outputPath: string): Promise<void>
```

No changes to renderer (React), IPC handlers, `clipboardService.js`, `clipboardMonitor.js`, `projectStore.js`, or `saveService.js`.

### SvgMetadata shape (unchanged)
```js
{ width: string, height: string, sizeBytes: number, conversionMs: number }
```

---

## What Stays the Same

- `src/main/clipboardService.js` — reads CF_ENHMETAFILE (format ID 14) via PowerShell P/Invoke
- `src/main/clipboardMonitor.js` — polls every 1s, SHA-256 dedup, calls `onNewEMF(buffer)`
- `src/main/projectStore.js`, `src/main/saveService.js` — unchanged
- `src/renderer/` — zero changes across all branches
- `src/main/index.js` IPC handlers — unchanged

---

## Branch 1 — `feature/clipboard-svg`

### Hypothesis
Altium Designer documents placing SVG on the clipboard. If accessible via `RegisterClipboardFormat`, no EMF conversion is needed.

### Files
- **New:** `src/main/svgClipboardService.js` — reads SVG string from clipboard
- **Replace:** `src/main/conversionService.js` → `conversionService.clipboard.js`
- **Remove:** `src/main/inkscapeShell.js` (no shell needed)

### Data Flow
```
clipboardService.js   → emfBuffer (kept as identity proof / hash source)
svgClipboardService.js → tries RegisterClipboardFormat("image/svg+xml"),
                          "SVG", "image/svg", Altium-specific format names
                       → returns svgString | null

convert(emfBuffer):
  svgString = await readSvgFromClipboard()
  if (!svgString) throw { code: 'NO_SVG_CLIPBOARD' }
  validate + SVGO → return { svgContent, metadata }

exportToFormat(svgContent, 'png'|'jpg'):
  resvg-js → render SVG → Buffer → write file

exportToFormat(svgContent, 'pdf'):
  resvg-js → PNG Buffer → pdfkit → write file

exportToFormat(svgContent, 'svg'):
  write svgContent directly
```

### New Dependencies
| Package | License | Purpose |
|---------|---------|---------|
| `resvg-js` | Apache-2.0 | SVG → PNG rasterization (Rust-backed) |
| `pdfkit` | MIT | PNG → PDF wrapping |

### Error Handling
- `NO_SVG_CLIPBOARD` → `status: 'error'`, clear message directing user to try PNG format or different branch
- SVGO / validation failure → existing `CONVERSION_ERROR` flow

### Success Criteria
- SVG from clipboard is valid, renders correctly in preview
- Text and thin traces are sharp and correct color
- PNG/JPG export at ≥ 2× screen resolution
- 10 consecutive pastes without failure

---

## Branch 2 — `feature/powershell-gdi`

### Hypothesis
System.Drawing (GDI+) in PowerShell can render EMF to a high-resolution bitmap. This follows the exact pattern of `clipboardService.js` (inline C#, base64 stdout). SVG output borrows from Branch 1's clipboard reading.

### Files
- **New:** `src/main/gdiShell.js` — PowerShell GDI+ renderer (reusable, pool of 1 process)
- **New:** `src/main/svgClipboardService.js` — same as Branch 1
- **Replace:** `src/main/conversionService.js` → `conversionService.powershell.js`
- **Remove:** `src/main/inkscapeShell.js`

### Data Flow
```
convert(emfBuffer):
  [parallel]
    svgString  = await readSvgFromClipboard()   // Branch 1 module reused
    pngBuffer  = await gdiShell.render(emfBuffer, scale=4)
  return { svgContent: svgString ?? null, pngBuffer, metadata }

gdiShell.render(emfBuffer, scale):
  PowerShell inline C#:
    System.Drawing.Imaging.Metafile(stream)
    Bitmap(width*scale, height*scale)
    Graphics.DrawImage(metafile, rect)
    Bitmap.Save(memStream, ImageFormat.Png)
    Console.WriteLine(Convert.ToBase64String(bytes))
  returns Buffer

exportToFormat(svgContent, 'svg', path):
  if (!svgContent) throw { code: 'NO_SVG_FOR_VECTOR' }
  write svgContent

exportToFormat(_, 'png'|'jpg', path):
  pngBuffer → sharp (resize/compress) → write
  (does NOT need svgContent)

exportToFormat(_, 'pdf', path):
  pngBuffer → pdfkit → write
```

### New Dependencies
| Package | License | Purpose |
|---------|---------|---------|
| `sharp` | Apache-2.0 | PNG resize / JPEG encode |
| `pdfkit` | MIT | PDF generation |

### Error Handling
- SVG export attempted without clipboard SVG → `toast.error` + redirect user to PNG, no full error state
- PowerShell spawn failure → `CONVERSION_ERROR` with `SHELL_CRASH` type
- Render timeout (>10s) → kill process, `CONVERSION_ERROR`

### Performance Target
- Render time: < 800ms (PowerShell spawn ~300ms + render ~200ms + encode ~100ms)

---

## Branch 3 — `feature/koffi-gdi`

### Hypothesis
`koffi` (MIT FFI) can call `PlayEnhMetaFile` from GDI32 directly in the Electron main process — no subprocess, ~50ms render instead of ~300ms.

### Files
- **New:** `src/main/koffiGdi.js` — FFI wrapper around GDI32/User32
- **New:** `src/main/svgClipboardService.js` — same as Branches 1 and 2
- **Replace:** `src/main/conversionService.js` → `conversionService.koffi.js`
- **Remove:** `src/main/inkscapeShell.js`

### Data Flow
```
koffiGdi.render(emfBuffer, scale=4):
  koffi.load('gdi32.dll'), 'user32.dll'
  SetMetaFileBitsEx / GetEnhMetaFileHeader → get width/height
  CreateCompatibleDC(null)
  CreateDIBSection(hdc, BITMAPINFO{scale*w, scale*h, 32bpp})
  PlayEnhMetaFile(hdc, hemf, &rect)
  GetDIBits → raw BGRA pixels
  DeleteDC, DeleteEnhMetaFile
  pngjs.encode(pixels) → Buffer PNG

convert(emfBuffer):
  [parallel]
    svgString = await readSvgFromClipboard()
    pngBuffer = await koffiGdi.render(emfBuffer)
  return { svgContent: svgString ?? null, pngBuffer, metadata }

exportToFormat: identical to Branch 2
```

### New Dependencies
| Package | License | Purpose |
|---------|---------|---------|
| `koffi` | MIT | Win32 FFI |
| `pngjs` | MIT | Raw pixels → PNG encoding |
| `pdfkit` | MIT | PDF generation |
| `sharp` | Apache-2.0 | JPEG encode (optional, pngjs covers PNG) |

### Error Handling
- FFI call failure → `CONVERSION_ERROR` with native error code
- Invalid EMF buffer → validate header before FFI call, throw early

### Performance Target
- Render time: < 200ms total (no subprocess overhead)

---

## Branch 4 — `feature/emf2svg-gpl` (Quality Benchmark Only)

### Purpose
Establish maximum quality ceiling for EMF→SVG vector conversion without Inkscape. **Not a production candidate** due to GPL-2.0 license. Use this branch to evaluate whether the open-source path is worth pursuing.

### Files
- **New:** `src/main/emf2svgBinding.js` — wrapper for `node_emf2svg`
- **Replace:** `src/main/conversionService.js` → `conversionService.emf2svg.js`
- **Remove:** `src/main/inkscapeShell.js`

### Data Flow
```
convert(emfBuffer):
  tmpFile = write emfBuffer to temp UUID .emf
  svgString = emf2svg(tmpFile)   // node_emf2svg C binding
  delete tmpFile
  validate + SVGO → return { svgContent, metadata }

exportToFormat(svgContent, 'png'|'jpg'):
  resvg-js → PNG → write

exportToFormat(svgContent, 'pdf'):
  resvg-js → PNG → pdfkit → write

exportToFormat(svgContent, 'svg'):
  write svgContent directly
```

### New Dependencies
| Package | License | Purpose |
|---------|---------|---------|
| `node_emf2svg` | **GPL-2.0** | EMF→SVG C binding |
| `resvg-js` | Apache-2.0 | SVG→PNG rasterization |
| `pdfkit` | MIT | PDF generation |

---

## Evaluation Matrix

After testing all 4 branches with real Altium schematics:

| Branch | SVG quality | PNG quality | Performance | License | Verdict |
|--------|-------------|-------------|-------------|---------|---------|
| clipboard-svg | TBD | TBD | TBD | ✅ MIT/Apache | Golden path if works |
| powershell-gdi | clipboard-dependent | TBD | ~800ms | ✅ MIT/Apache | Familiar, safe fallback |
| koffi-gdi | clipboard-dependent | TBD | ~200ms | ✅ MIT | Best raster performance |
| emf2svg-gpl | TBD | TBD | TBD | ❌ GPL-2.0 | Benchmark only |

**Decision tree after testing:**
1. Branch 1 SVG works well → merge Branch 1 into master ✅
2. Branch 1 SVG unusable → pick Branch 2 or 3 for raster; accept SVG export requires Altium clipboard
3. Branch 4 quality is substantially better → evaluate open-source model seriously

---

## Shared Utilities (all branches)

- `isValidSVG(str)` — unchanged from current `conversionService.js`
- `getSVGMetadata(str)` — unchanged
- `runSVGO(str)` — unchanged
- SVGO config — unchanged

These can be extracted to `src/main/svgUtils.js` and imported by all branch implementations.

---

## Testing

Each branch must pass the existing test suite (`npm test`, 69 tests) since the interface is unchanged. Additionally, manual testing checklist per branch:

- [ ] Paste 1 schematic → preview appears
- [ ] Paste 10 consecutive schematics → no crash, all previews correct
- [ ] Save as SVG → file opens correctly in browser/Inkscape
- [ ] Save as PNG → sharp, correct colors, no artifacts
- [ ] Save as JPG → acceptable quality
- [ ] Save as PDF → opens correctly in PDF viewer
- [ ] Discard → returns to idle
- [ ] Queue (paste while saving) → processes in order
