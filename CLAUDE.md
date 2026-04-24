# Claritas

Electron app (Windows) que captura EMF do clipboard do Altium Designer, converte para SVG via Inkscape shell persistente, exibe prévia e salva com nome sequencial por projeto.

## Stack
- Electron 39 + React 19 + Vite (electron-vite)
- Tailwind CSS 3 (dark mode via `class`), shadcn/ui components
- electron-store para persistência, Vitest para testes
- Inkscape bundled em `resources/inkscape/`

## Arquitetura — Main Process
| Arquivo | Papel |
|---|---|
| `src/main/index.js` | BrowserWindow, IPC handlers, tray, global shortcut |
| `src/main/inkscapeShell.js` | Shell persistente (stdin/stdout) — evita cold-start |
| `src/main/conversionService.js` | EMF→SVG via shell, valida SVG, extrai metadata |
| `src/main/clipboardMonitor.js` | Polling do clipboard; dispara `preview-ready` IPC |
| `src/main/clipboardService.js` | Lê `CF_ENHMETAFILE` do clipboard Windows |
| `src/main/projectStore.js` | electron-store: projetos, settings, histórico de sessão |
| `src/main/saveService.js` | Gera filename sequencial, exporta SVG/PNG/JPG/PDF |
| `src/main/tray.js` | System tray, blink quando há prévia pendente |

## Arquitetura — Renderer
| Arquivo | Papel |
|---|---|
| `src/renderer/src/context/AppContext.jsx` | useReducer state machine: idle→converting→preview→saving→error |
| `src/renderer/src/App.jsx` | Layout raiz + roteamento main/settings |
| `src/renderer/src/components/ClipboardArea.jsx` | Drop zone ou spinner dependendo do estado |
| `src/renderer/src/components/PreviewArea.jsx` | SVG preview zoom/pan + botões Salvar/Descartar |
| `src/renderer/src/components/ClipGrid.jsx` | Grid de histórico da sessão |
| `src/renderer/src/components/Sidebar.jsx` | Lista de projetos, navegação |
| `src/renderer/src/components/Settings.jsx` | CRUD projetos, tema, shortcut, startup |
| `src/renderer/src/components/StatusBar.jsx` | Status do Inkscape shell |

## IPC Channels
`paste-schematic`, `save-svg`, `discard-svg`, `get-projects`, `add-project`, `update-project`, `delete-project`, `set-active-project`, `get-settings`, `update-settings`, `choose-directory`, `create-output-dir`, `get-history`, `get-init-data`, `get-login-item-settings`, `set-login-item-settings`

Eventos push do main→renderer: `shell-status`, `preview-ready`, `theme-changed`, `projects-updated`, `navigate-to`

## Estado atual
- Todas as 17 tasks do plano implementadas + extras (clipboard monitoring, global shortcut, múltiplos temas)
- 69 testes passando (`npm test`)
- Build funcional (`npm run build:unpack`)
- Temas: light, dark, system, snnabb, charcoal, black-moon, blue-moon

## Comandos
```bash
npm run dev        # dev com hot reload
npm test           # vitest run (69 testes)
npm run build:unpack  # build sem instalar
npm run dist       # build + installer NSIS
```

## Convenções
- Português no UI, inglês no código
- Sem comentários desnecessários no código
- shadcn/ui via `@/components/ui/*`
- Temas via classes CSS no `<html>`: `dark`, `theme-snnabb`, `theme-charcoal`, `theme-black-moon`, `theme-blue-moon`
