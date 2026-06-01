import { spawn } from 'child_process'
import os from 'os'
import path from 'path'
import fs from 'fs'

// PowerShell script that calls Windows.Media.Ocr (built-in WinRT engine).
// No downloads required — uses whatever language packs Windows has installed.
const PS_SCRIPT = String.raw`
param([string]$ImagePath)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

# Load WinRT types
[void][Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
[void][Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap,Windows.Foundation,ContentType=WindowsRuntime]

# Await helper — caller passes [Type]$T explicitly because GetGenericArguments()
# returns empty on COM-wrapped WinRT types in PowerShell 5.1
function Await($AsyncOp, [Type]$T) {
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 }
  )[0].MakeGenericMethod($T)
  $task = $asTask.Invoke($null, @($AsyncOp))
  $task.Wait() | Out-Null
  $task.Result
}

# Load image via GDI+ (synchronous — avoids WinRT BitmapDecoder async failures)
$gdi     = [System.Drawing.Bitmap]::new($ImagePath)
$w       = $gdi.Width
$h       = $gdi.Height
$rect    = [System.Drawing.Rectangle]::new(0, 0, $w, $h)
# Format32bppArgb stores bytes as BGRA in memory — matches Bgra8 exactly
$bmpData = $gdi.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                         [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes   = [byte[]]::new([Math]::Abs($bmpData.Stride) * $h)
[System.Runtime.InteropServices.Marshal]::Copy($bmpData.Scan0, $bytes, 0, $bytes.Length)
$gdi.UnlockBits($bmpData)
$gdi.Dispose()

# byte[] -> IBuffer -> SoftwareBitmap (Bgra8/Premultiplied as required by OcrEngine)
$ibuffer = [System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeBufferExtensions]::AsBuffer($bytes)
$bitmap  = [Windows.Graphics.Imaging.SoftwareBitmap]::CreateCopyFromBuffer(
  $ibuffer,
  [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
  $w, $h,
  [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied
)

# Pick engine: pt-BR -> user profile -> any available
$engine = $null
$ptLang = [Windows.Globalization.Language]::new('pt-BR')
if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($ptLang)) {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($ptLang)
}
if (-not $engine) {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if (-not $engine) {
  $available = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
  if ($available.Count -gt 0) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($available[0])
  }
}
if (-not $engine) {
  [Console]::Error.WriteLine("DIAG: no engine available")
  exit 1
}

[Console]::Error.WriteLine("DIAG: engine=" + $engine.RecognizerLanguage.LanguageTag + " bitmap=" + $w + "x" + $h)
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
[Console]::Error.WriteLine("DIAG: lines=" + $result.Lines.Count)
($result.Lines | ForEach-Object { $_.Text }) -join [Environment]::NewLine
`

export async function recognizeDataURL(dataURL) {
  const base64  = dataURL.replace(/^data:image\/\w+;base64,/, '')
  const ts      = Date.now()
  const tmpImg  = path.join(os.tmpdir(), `claritas-ocr-${ts}.png`)
  const tmpPs   = path.join(os.tmpdir(), `claritas-ocr-${ts}.ps1`)

  // UTF-8 BOM so PowerShell 5.1 reads it correctly
  const bom = Buffer.from([0xEF, 0xBB, 0xBF])
  fs.writeFileSync(tmpImg, Buffer.from(base64, 'base64'))
  fs.writeFileSync(tmpPs,  Buffer.concat([bom, Buffer.from(PS_SCRIPT, 'utf8')]))

  try {
    return await new Promise((resolve, reject) => {
      const proc = spawn('powershell.exe', [
        '-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', tmpPs, '-ImagePath', tmpImg,
      ])

      proc.stdout.setEncoding('utf8')
      proc.stderr.setEncoding('utf8')
      let stdout = '', stderr = ''
      proc.stdout.on('data', d => { stdout += d })
      proc.stderr.on('data', d => { stderr += d })
      proc.on('close', code => {
        if (code !== 0) reject(new Error(stderr.trim() || `PowerShell exited ${code}`))
        else {
          if (stderr.trim()) console.debug('[OCR diag]', stderr.trim())
          resolve(stdout.trim())
        }
      })
      proc.on('error', reject)
    })
  } finally {
    try { fs.unlinkSync(tmpImg) } catch {}
    try { fs.unlinkSync(tmpPs)  } catch {}
  }
}

export function terminateOcr() {
  // no persistent worker — nothing to clean up
}
