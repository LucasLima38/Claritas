# Claritas Screenshot Tab — Design Spec

> **Pré-requisito:** Sub-Project 1 (reestruturação da UI em abas) deve estar completo antes deste sub-projeto.

---

## 1. Visão geral

Adicionar à aba **Captura** do Claritas:

1. **Seletor de modo de captura** — Região, Janela ativa, Tela cheia, com suporte multi-monitor
2. **Delay de captura** — Sem delay / 3s / 5s / 10s; overlay de contagem regressiva
3. **Editor de imagem** — Nível Snagit: 14 ferramentas de anotação em canvas react-konva
4. **OCR** — Tesseract.js em Web Worker; painel lateral editável

A aba de gravação de vídeo/áudio permanece fora do escopo deste sub-projeto.

---

## 2. Arquitetura

### Novos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/main/screenshotService.js` | desktopCapturer: captura região/janela/tela; cria a janela de countdown; retorna dataURL |
| `src/main/countdownOverlay.js` | Cria/destrói a BrowserWindow frameless, always-on-top, click-through do countdown |
| `src/renderer/src/components/CaptureTab.jsx` | Coordena os dois modos: **initial** (seletor + botão) e **editor** (pós-captura) |
| `src/renderer/src/components/CaptureControls.jsx` | Botões de modo (Região/Janela/Tela cheia), dropdown de delay, botão "Capturar agora" |
| `src/renderer/src/components/ImageEditor.jsx` | Stage react-konva + lógica de ferramentas; renderiza `EditorToolbar` e `OcrPanel` |
| `src/renderer/src/components/EditorToolbar.jsx` | Barra horizontal de ferramentas: shadcn `ToggleGroup` + seletor de cor + espessura + undo/redo |
| `src/renderer/src/components/OcrPanel.jsx` | Integração Tesseract.js + painel lateral com textarea editável |
| `src/renderer/overlay/countdown.html` | Página do countdown overlay (HTML autônomo, sem bundler) |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/main/index.js` | Registrar handlers IPC: `capture-screen`, `cancel-capture` |
| `src/main/saveService.js` | Suporte a salvar PNG/JPG a partir de dataURL (além de SVG) |
| `src/renderer/src/context/AppContext.jsx` | Novos estados: `capture-idle`, `capture-countdown`, `capture-editor` |

---

## 3. Fluxo de captura

```
Usuário clica "Capturar agora"
  │
  ├─ delay = 0 → screenshotService.capture() diretamente
  │
  └─ delay > 0
       ├─ main oculta janela principal (win.hide())
       ├─ countdownOverlay.show(delay)  ← overlay full-screen
       │     mostra 3… 2… 1… com IPC tick a cada segundo
       │     ESC → cancel-capture → destrói overlay, mostra janela
       └─ ao chegar em 0 → screenshotService.capture() → overlay.destroy()
                                                          → win.show()
```

**Modo Região:** abre uma janela de seleção de área (BrowserWindow transparente, fullscreen, cursor crosshair). O usuário arrasta para selecionar; ao soltar o mouse, coordenadas são enviadas para `screenshotService` que faz crop.

**Modo Janela ativa:** usa `desktopCapturer.getSources({ types: ['window'] })` + `screen.getCursorScreenPoint()` para identificar a janela em foco antes do countdown.

**Modo Tela cheia:** captura o monitor onde a janela do Claritas está (`screen.getDisplayMatching(win.getBounds())`), com fallback para o monitor primário.

---

## 4. IPC channels novos

| Canal | Direção | Payload |
|---|---|---|
| `capture-screen` | renderer → main | `{ mode: 'region'\|'window'\|'fullscreen', delay: number, monitorId?: number }` |
| `capture-ready` | main → renderer | `{ dataURL: string, width: number, height: number }` |
| `capture-cancelled` | main → renderer | — |
| `countdown-tick` | main → overlay | `{ remaining: number }` |
| `cancel-capture` | renderer → main | — |

---

## 5. Editor de imagem — Ferramentas

### Camadas do Stage (react-konva)

```
Stage
 ├── Layer 0 — imagem base (Konva.Image, não editável)
 └── Layer 1 — anotações (objetos Konva adicionados pelas ferramentas)
```

### Ferramentas da toolbar (ordem esquerda→direita)

| # | Ícone | Nome | Tipo Konva | Comportamento |
|---|---|---|---|---|
| 1 | `MousePointer` | Cursor/Selecionar | — | Seleciona e move anotações existentes; handles de resize |
| 2 | `ArrowUpRight` | Seta | `Konva.Arrow` | mousedown→drag→mouseup define pontos; seta no final |
| 3 | `Square` | Retângulo | `Konva.Rect` | rubber-band; stroke configurável |
| 4 | `Circle` | Elipse | `Konva.Ellipse` | rubber-band |
| 5 | `Minus` | Linha | `Konva.Line` | dois pontos |
| 6 | `Pen` | Pincel livre | `Konva.Line` | points acumulados no mousemove; closed=false |
| 7 | `Type` | Texto | `Konva.Text` | clique cria textbox inline; Enter confirma |
| 8 | `Highlighter` | Highlight | `Konva.Rect` | fill com opacity 0.35, sem stroke |
| 9 | `Eraser` | Borracha | — | remove anotação sob o cursor (hit-test) |
| 10 | `Hash` | Contador | `Konva.Group` | círculo + número auto-incrementado por captura |
| 11 | `ScanFace` | Blur | `Konva.Image` + filter | `Konva.Filters.Blur` aplicado a crop da região |
| 12 | `Crop` | Crop | — | seleção de área; redimensiona Stage e imagem |
| 13 | `Maximize` | Redimensionar | — | abre dialog com campos W×H + lock aspect ratio |
| 14 | `Scan` | OCR | — | abre/fecha o OcrPanel |

**Separador visual** entre ferramenta 13 e 14 (OCR é funcional, não desenho).

### Controles adicionais na toolbar

- Seletor de cor (popover com paleta + input hex) — afeta stroke/fill da ferramenta ativa
- Seletor de espessura (slider 1–20px)
- Botão Desfazer (`Ctrl+Z`) / Refazer (`Ctrl+Y`)

### Histórico de undo/redo

Estado das anotações mantido como array imutável em `useState`. Cada mudança empurra um snapshot. Limite: 50 snapshots.

---

## 6. OCR — Painel lateral

### Integração Tesseract.js

- Worker instanciado no mount do `ImageEditor` (não do `OcrPanel`), mantido vivo enquanto o editor estiver aberto; passado como prop ao `OcrPanel`. Isso evita recriar o worker ao abrir/fechar o painel
- Idioma: `por+eng` (português + inglês)
- No primeiro uso: download do modelo (~10 MB) com barra de progresso no painel
- Timeout: 30s; erro amigável se exceder
- Worker é terminado no unmount do `ImageEditor` (ao descartar ou salvar a imagem)

### UI do painel

```
┌─────────────────────────────┐
│ Texto extraído  [● pronto]  │  ← header shadcn Card
│─────────────────────────────│
│ [textarea editável, flex-1] │  ← shadcn Textarea resize-none
│─────────────────────────────│
│ [Copiar]  [Limpar]          │  ← shadcn Button variant=outline / ghost
└─────────────────────────────┘
```

- Largura fixa: 280px, coluna à direita do canvas
- Se o canvas + painel não caber, o canvas scroll horizontalmente
- Estado do texto: local ao `OcrPanel`, não persiste entre sessões

---

## 7. UI — Barra de ação inferior

```
[filename: PCB-REV2_0042.png]    [Descartar]  [Salvar PNG ▼]
```

- Filename gerado pelo `saveService` com o projeto ativo (mesma lógica dos SVGs, extensão `.png`)
- Botão "Salvar PNG" com dropdown `DropdownMenu` para escolher PNG / JPG
- Discard retorna ao modo `capture-idle` descartando o dataURL e anotações

---

## 8. Tema e estilização

- **Todo o componente usa shadcn/ui** — `Button`, `ToggleGroup`, `DropdownMenu`, `Card`, `Textarea`, `Popover`, `Slider`, `Select`
- **Cores respeitam as CSS variables dos temas do Claritas** (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, etc.)
- O Stage Konva recebe `background: hsl(var(--muted))` via wrapper `div`
- Toolbar usa `bg-background border-b border-border` (adaptável a todos os temas)
- O overlay de countdown é uma página HTML standalone que lê o tema via `ipcRenderer.invoke('get-settings')` (canal existente) e aplica a classe de tema no `<html>` (`dark`, `theme-snnabb`, etc.)

---

## 9. Dependências novas

```bash
npm install react-konva konva tesseract.js
```

| Pacote | Versão mínima | Uso |
|---|---|---|
| `react-konva` | ^18 | Canvas 2D declarativo para o editor |
| `konva` | ^9 | Runtime Konva (peer dep do react-konva) |
| `tesseract.js` | ^5 | OCR no renderer via Web Worker |

---

## 10. Tratamento de erros

| Situação | Comportamento |
|---|---|
| `desktopCapturer` sem permissão (macOS) | Toast de erro; não se aplica ao Windows target |
| Inkscape shell não iniciado | Não afeta a aba de captura (independente) |
| Tesseract timeout (>30s) | Mensagem "OCR demorou muito. Tente novamente." no painel |
| Tesseract sem texto detectado | Mensagem "Nenhum texto encontrado na imagem." |
| Captura cancelada via ESC | `capture-cancelled` IPC → retorna a `capture-idle` sem toast |
| Salvar falhou (sem projeto ativo) | Toast "Selecione um projeto antes de salvar" |

---

## 11. Testes

- `screenshotService.test.js` — mock de `desktopCapturer`, verificar dataURL retornado, verificar crop de região
- `saveService.test.js` — adicionar caso de test: salvar PNG/JPG de dataURL
- `ImageEditor.test.jsx` — Vitest + React Testing Library: montar componente, verificar toolbar, clicar ferramenta seta, verificar que Stage recebe o objeto Konva correto
- `OcrPanel.test.jsx` — mock de `tesseract.js`, verificar estados: loading → pronto → texto exibido → copiar → limpar

---

## 12. Não está no escopo

- Gravação de vídeo/áudio (sub-projeto separado)
- Upload para nuvem / compartilhamento
- Anotações colaborativas
- Histórico persistente de screenshots entre sessões (apenas a sessão atual, como os SVGs)
- Captura agendada / recorrente
