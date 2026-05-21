# Claritas

> Paste a schematic from your EDA tool — get a clean SVG, PNG, JPG or PDF, saved to Google Drive.

Claritas is a Windows desktop app for engineers that monitors the clipboard for schematic diagrams (EMF/SVG format), converts them to high-quality vector or raster files, and syncs everything to Google Drive — organized by project.

## Features

### Clipboard Mode
- **Auto-monitoring** — detects schematics on the clipboard automatically
- **Multiple export formats** — save as SVG, PNG, JPG or PDF
- **EMF → SVG via libemf2svg** — accurate vector rendering with no external dependencies
- **Preview queue** — copy multiple schematics; each queues up after save or discard
- **Annotation tools** — draw, highlight and annotate before saving
- **Save indicator** — animated confirmation toast on every save

### Capture Mode
- **Screenshot capture** — region selection, active window, or full screen
- **Delay timer** — capture after 0, 3, 5 or 10 seconds
- **Full annotation editor** — draw, highlight, add text, undo/redo
- **OCR** — select any region to extract text using the Windows built-in engine (no download required)
- **Resolution selector** — choose low/normal/high output resolution before saving
- **Save indicator** — animated confirmation toast on every save
- **Recentes panel** — thumbnail gallery of your recent captures

### Google Drive Integration
- **Sign in with Google** — OAuth 2.0 PKCE flow, no password stored
- **Drive sync** — save files directly to a per-project folder on Drive
- **Share files** — share Drive files directly from the Recentes panel
- **Lightbox viewer** — full-screen preview with zoom/pan

### App
- **Project organization** — group files by project (`BLDC_001.svg`, `BLDC_002.svg`, …)
- **Output mode per project** — save locally, to Google Drive, or both
- **8 themes** — System, Black Moon, Blue Moon, Charcoal, Claritas, Light, Dark, Snnabb
- **Auto-update** — checks for updates automatically; installs on restart
- **System tray** — stays out of your way; blinks when a new capture is ready
- **Global shortcut** — `Ctrl+Shift+V` (configurable)

## Requirements

- Windows 10/11

## Installation

Download the latest installer from the [Releases](https://github.com/LucasLima38/Claritas/releases/latest) page and run it.

## Development

**Prerequisites:** Node.js 20+, npm

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build installer
npm run dist
```

> **libemf2svg:** The EMF conversion feature requires the `libemf2svg` binaries bundled in `resources/libemf2svg/`.
> These are included in the repository and no extra setup is needed.

## Google OAuth

Claritas uses Google OAuth 2.0 (Desktop app / PKCE — no client secret embedded in the app).
The `CLIENT_ID` in `src/main/authService.js` is intentionally public.

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop shell
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — renderer
- [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) — UI
- [Google APIs](https://github.com/googleapis/google-api-nodejs-client) — Drive + OAuth
- [libemf2svg](https://github.com/kakwa/libemf2svg) — EMF → SVG conversion
- [electron-store](https://github.com/sindresorhus/electron-store) — persistent settings
- [electron-updater](https://www.electron.build/auto-update) — auto-update via GitHub Releases
- [Vitest](https://vitest.dev/) — unit tests

## License

[MIT](LICENSE)
