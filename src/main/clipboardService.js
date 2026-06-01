import { spawn } from 'child_process'

// ── Why not electron.clipboard.readBuffer('CF_ENHMETAFILE')? ─────────────────
//
// Electron's clipboard.readBuffer(name) calls RegisterClipboardFormat(name)
// which always allocates a *new custom* format ID in the range 0xC000–0xFFFF.
// CF_ENHMETAFILE is a Windows predefined system format with the fixed integer
// ID 14. RegisterClipboardFormat("CF_ENHMETAFILE") returns a DIFFERENT ID and
// reads the wrong (empty) clipboard slot no matter what Altium writes.
//
// The only reliable approach is to call GetClipboardData(14) directly via the
// Win32 API. We do this through a PowerShell process using inline C# P/Invoke,
// which avoids any native addon or external npm dependency.
// ─────────────────────────────────────────────────────────────────────────────

const PS_SCRIPT = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class EMFReader {
    [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr h);
    [DllImport("user32.dll")] static extern bool CloseClipboard();
    [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint f);
    [DllImport("user32.dll")] static extern bool IsClipboardFormatAvailable(uint f);
    [DllImport("gdi32.dll")]  static extern uint GetEnhMetaFileBits(IntPtr h, uint n, byte[] b);
    [DllImport("gdi32.dll")]  static extern bool DeleteEnhMetaFile(IntPtr h);
    public static string Read() {
        if (!IsClipboardFormatAvailable(14)) return string.Empty;
        if (!OpenClipboard(IntPtr.Zero)) return string.Empty;
        try {
            IntPtr h = GetClipboardData(14);
            if (h == IntPtr.Zero) return string.Empty;
            uint n = GetEnhMetaFileBits(h, 0, null);
            if (n == 0) return string.Empty;
            byte[] d = new byte[n];
            GetEnhMetaFileBits(h, n, d);
            return Convert.ToBase64String(d);
        } finally { CloseClipboard(); }
    }
}
'@ -Language CSharp
[EMFReader]::Read()
`.trim()

// Encode as UTF-16LE base64 for -EncodedCommand — avoids all quoting/newline
// issues when embedding a multi-line script in a command string.
const PS_ENCODED = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64')

/**
 * Reads CF_ENHMETAFILE (Windows system clipboard format ID 14) via a
 * PowerShell subprocess using Win32 P/Invoke.
 * Returns a Buffer of raw EMF bytes, or null if not present / on error.
 */
export function readEMF() {
  return new Promise((resolve) => {
    let stdout = ''
    let settled = false

    function done(result) {
      if (settled) return
      settled = true
      resolve(result)
    }

    const proc = spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', PS_ENCODED],
      { windowsHide: true }
    )

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString() })

    proc.on('close', (code) => {
      clearTimeout(timer)
      const trimmed = stdout.trim()
      if (!trimmed || code !== 0) return done(null)
      try {
        done(Buffer.from(trimmed, 'base64'))
      } catch {
        done(null)
      }
    })

    proc.on('error', () => {
      clearTimeout(timer)
      done(null)
    })

    // Safety timeout — kill PowerShell if it hangs
    const timer = setTimeout(() => {
      proc.kill()
      done(null)
    }, 10000)
  })
}