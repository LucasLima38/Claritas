# Claritas

> Paste a schematic from your EDA tool — get a clean SVG, PNG, JPG or PDF file.

Claritas is a Windows desktop app that sits in the system tray and monitors the clipboard for schematic diagrams (EMF format). When a schematic is detected, it converts it automatically to a high-quality vector file, shows a zoomable preview, and lets you save it with a sequential filename — ready to embed in documentation, reports or presentations.

## Features

- **Auto-monitoring** — Claritas detects schematics on the clipboard automatically; no button needed
- **Preview queue** — copy multiple schematics in sequence; each capture queues up and is shown one at a time after save or discard
- **Global shortcut** — bring the window to the foreground from anywhere with `Ctrl+Shift+V` (configurable)
- **Multiple export formats** — save as SVG, PNG, JPG or PDF
- **Project organisation** — group exports by project with a custom prefix and auto-incrementing counter (`BLDC_001.svg`, `BLDC_002.svg`, …); switch active project from the sidebar or Settings
- **Zoomable preview** — pan and zoom the schematic before saving; fit-to-view with one click
- **Recent files** — thumbnail gallery of files saved in the current session, with right-click menu to copy, open in folder or delete; refresh button syncs the list with the actual files on disk
- **Auto-update** — notifies you when a new version is available and installs it on restart
- **EMF → SVG via Inkscape** — uses Inkscape's rendering engine for accurate vector output
- **System tray** — stays out of your way; blinks when a new schematic is ready
- **8 themes** — System, Black Moon, Blue Moon, Charcoal, Claritas, Light, Dark, Snnabb
- **Behaviour settings** — launch on startup, start minimised, configure whether the close button hides or exits

## Requirements

- Windows 10/11

## Installation

Download `Claritas-Setup-1.2.0.exe` from the [latest release](../../releases/latest) and run the installer.

## Usage

1. Open Claritas — it will appear in the system tray
2. In your EDA tool (Altium Designer, KiCad, Eagle…), select a portion of your schematic and copy it (`Ctrl+C`)
3. Claritas detects the clipboard automatically and shows a preview
4. Choose the export format (SVG, PNG, JPG or PDF), then click **Salvar**

## Development

**Prerequisites:** Node.js 18+, npm

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

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop shell
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — renderer
- [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) — UI components
- [Inkscape CLI](https://inkscape.org/) — EMF → SVG conversion
- [electron-store](https://github.com/sindresorhus/electron-store) — persistent settings
- [electron-updater](https://www.electron.build/auto-update) — auto-update via GitHub Releases
- [Vitest](https://vitest.dev/) — unit tests

## License

MIT
