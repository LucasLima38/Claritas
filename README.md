# SchematicClip

> Paste a schematic from your EDA tool — get a clean SVG file.

SchematicClip is a Windows desktop app that sits in the system tray and converts schematic diagrams copied to the clipboard (as EMF) into high-quality SVG files, ready to embed in documentation, reports or presentations.

## Features

- **One-click conversion** — copy a schematic in your EDA tool, press the paste button, done
- **Project organisation** — group exports by project with a custom prefix and auto-incrementing counter (`BLDC_001.svg`, `BLDC_002.svg`, …)
- **EMF → SVG via Inkscape** — uses Inkscape's rendering engine for accurate vector output
- **System tray** — stays out of your way; accessible from the notification area at all times
- **7 themes** — Sistema, Claro, Escuro, Snnabb, Charcoal, Black Moon, Blue Moon
- **Behaviour settings** — launch on startup, start minimised, configure whether the close button hides or exits

## Requirements

- Windows 10/11
- [Inkscape](https://inkscape.org/) 1.x installed (the app will detect it automatically)

## Installation

Download `SchematicClip-1.0.0-portable.zip` from the [latest release](../../releases/latest), extract it and run `SchematicClip.exe`. No installer required.

## Usage

1. Open SchematicClip — it will appear in the system tray
2. In your EDA tool (KiCad, Altium, Eagle…), copy a schematic to the clipboard
3. Click the **Colar Esquemático** button in SchematicClip
4. Preview the generated SVG and click **Salvar** to save it to your project folder

## Development

**Prerequisites:** Node.js 18+, npm

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run dist
```

> **Note:** `npm run dist` requires Windows Developer Mode enabled (for symlink support in electron-builder's code-signing toolchain). Without it, use the portable build from `dist/win-unpacked`.

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop shell
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — renderer
- [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) — UI components
- [Inkscape CLI](https://inkscape.org/) — EMF → SVG conversion
- [electron-store](https://github.com/sindresorhus/electron-store) — persistent settings
- [Vitest](https://vitest.dev/) — unit tests

## License

MIT
