import { spawn } from 'child_process'
import os from 'os'
import path from 'path'
import fs from 'fs'

// PowerShell script that calls Windows.Media.Ocr (built-in WinRT engine).
// No downloads required — uses whatever language packs Windows has installed.
const PS_SCRIPT = String.raw`
param([string]$ImagePath)

Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Generic helper to block on IAsyncOperation<T> using reflection
function Await($AsyncOp) {
  $type   = $AsyncOp.GetType().GetGenericArguments()[0]
  $method = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 }
  )[0].MakeGenericMethod($type)
  $task = $method.Invoke($null, @($AsyncOp))
  $task.Wait() | Out-Null
  $task.Result
}

# Load WinRT namespaces
[void][Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]

$file    = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath))
$stream  = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read))
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream))
$bitmap  = Await ($decoder.GetSoftwareBitmapAsync())

# Try pt-BR first, fall back to user's profile languages
$lang   = [Windows.Globalization.Language]::new('pt-BR')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if (-not $engine) {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if (-not $engine) { exit 1 }

$result = Await ($engine.RecognizeAsync($bitmap))
($result.Lines | ForEach-Object { $_.Text }) -join "`n"
`

export async function recognizeDataURL(dataURL) {
  const base64  = dataURL.replace(/^data:image\/\w+;base64,/, '')
  const ts      = Date.now()
  const tmpImg  = path.join(os.tmpdir(), `claritas-ocr-${ts}.png`)
  const tmpPs   = path.join(os.tmpdir(), `claritas-ocr-${ts}.ps1`)

  // UTF-8 BOM so PowerShell 5.1 reads it correctly
  const bom = Buffer.from('﻿', 'utf8')
  fs.writeFileSync(tmpImg, Buffer.from(base64, 'base64'))
  fs.writeFileSync(tmpPs,  Buffer.concat([bom, Buffer.from(PS_SCRIPT, 'utf8')]))

  try {
    return await new Promise((resolve, reject) => {
      const proc = spawn('powershell.exe', [
        '-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', tmpPs, '-ImagePath', tmpImg,
      ])

      let stdout = '', stderr = ''
      proc.stdout.on('data', d => { stdout += d })
      proc.stderr.on('data', d => { stderr += d })
      proc.on('close', code => {
        if (code !== 0) reject(new Error(stderr.trim() || `PowerShell exited ${code}`))
        else resolve(stdout.trim())
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
