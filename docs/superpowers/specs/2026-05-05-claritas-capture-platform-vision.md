# Claritas — Visão: Plataforma de Captura Geral

> **Status:** Documento de visão / roadmap futuro. Ainda não há plano de implementação.
> Quando for implementar, invocar o skill `superpowers:brainstorming` para detalhar cada sub-projeto individualmente.

---

## Visão Geral

O Claritas evolui de uma ferramenta especializada em esquemáticos Altium para uma **plataforma de captura geral**, mantendo a organização por projetos como pilar central. Tudo que for capturado — esquemáticos, screenshots, vídeos — é salvo automaticamente na pasta do projeto ativo com nomenclatura sequencial predefinida.

A interface passa a ser organizada em **três abas principais**:

| Aba | Descrição |
|---|---|
| **Clipboard** | Comportamento atual: captura EMF do Altium → SVG/PNG/JPG/PDF |
| **Captura** | Printscreen de região/janela/tela cheia com ferramentas de anotação |
| **Gravação** | Gravação de vídeo da tela com controles de start/stop/pause |

---

## Sub-Projeto 1 — Reestruturação em Abas (UI)

**Escopo:** Refatorar o layout atual para suportar navegação por abas sem quebrar o fluxo existente da aba Clipboard.

**Pontos-chave:**
- Sidebar e sistema de projetos permanecem iguais para todas as abas
- A aba Clipboard é o estado atual, movida para uma das três abas
- As abas Captura e Gravação ficam como stubs (placeholders) até serem implementadas
- ClipGrid (histórico da sessão) evolui para mostrar arquivos de qualquer aba, com um filtro por tipo

---

## Sub-Projeto 2 — Aba de Captura de Tela

**Referências:** Snagit, ShareX, Greenshot, Lightshot.

**Features previstas:**

### Modos de captura
- Região (arrastar seleção com mouse)
- Janela ativa
- Tela cheia (monitor específico em setups multi-monitor)
- Atalho global configurável (igual ao existente para clipboard)

### Ferramentas de anotação (pós-captura)
Toolbar flutuante sobre a imagem capturada antes de salvar:

| Ferramenta | Descrição |
|---|---|
| Seta | Apontar elementos na imagem |
| Retângulo / Elipse | Destacar áreas |
| Linha | Traçado livre de segmentos |
| Pincel | Desenho livre |
| Texto | Inserir legenda/anotação |
| Highlight | Marca-texto semi-transparente |
| Borracha | Apagar anotações |
| Crop | Recortar a captura |
| Contador (número) | Numerar passos (1, 2, 3…) |

Atalho `Ctrl+Z` / `Ctrl+Y` para desfazer/refazer.

### Exportação
- Formatos: PNG, JPG
- Salva no diretório do projeto ativo com prefixo+contador sequencial (mesma lógica existente)
- Opção de copiar para clipboard antes de salvar

### Notas técnicas
- API Electron: `desktopCapturer` para captura de tela; `screen` para enumerar monitores
- Anotações desenhadas em `<canvas>` no renderer antes do save
- A imagem final é `canvas.toDataURL()` → `sharp` no main process para salvar PNG/JPG otimizado

---

## Sub-Projeto 3 — Aba de Gravação de Vídeo

**Referências:** OBS Studio (fluxo básico), Snagit Recording, ShareX Recording.

**Features previstas:**

### Modos de gravação
- Tela cheia (monitor selecionado)
- Região específica (definida antes de iniciar)
- Janela ativa

### Controles
- Start / Pause / Stop via toolbar flutuante minimizada durante a gravação
- Cronômetro visível no overlay
- Atalho global para iniciar/pausar/parar sem precisar focar o Claritas

### Exportação
- Formato: MP4 (H.264) — compatibilidade universal
- GIF animado (opcional, resolução reduzida) — útil para documentação
- Salva no diretório do projeto ativo com prefixo+contador sequencial

### Notas técnicas
- API Electron: `desktopCapturer` com `MediaRecorder` API no renderer
- Container MP4 via `MediaRecorder` com codec `video/webm;codecs=vp9` → conversão para MP4 via `ffmpeg` (bundled, semelhante ao Inkscape atual)
- ffmpeg como binário bundled em `resources/ffmpeg/` + extraResources no electron-builder

---

## Organização de Arquivos (continuidade)

O sistema de projetos existente (prefixo + contador + pasta de destino) se expande naturalmente:

```
Projeto "PCB-REV2"  
├── prefix: "PCB-REV2_"  
├── outputDir: "D:/Projetos/PCB-REV2/capturas"  
└── counter: compartilhado entre todas as abas (ou contadores separados por tipo — a definir)
```

**Questão em aberto:** contador único por projeto ou um contador por tipo de arquivo (esquemático / imagem / vídeo)? A decidir durante o brainstorming do Sub-Projeto 2.

---

## Ordem de Implementação Sugerida

1. **Sub-Projeto 1** — Reestruturação em abas (pequeno, sem risco de regressão)
2. **Sub-Projeto 2** — Aba de captura + anotações (maior valor imediato)
3. **Sub-Projeto 3** — Aba de gravação (maior complexidade técnica, deixar por último)

---

## O que NÃO está no escopo (por ora)

- Captura com atraso (timer)
- Upload automático para cloud (S3, Drive, etc.)
- OCR sobre capturas
- Editor de imagens completo (não é Photoshop)
- Áudio na gravação (microfone / sistema)
