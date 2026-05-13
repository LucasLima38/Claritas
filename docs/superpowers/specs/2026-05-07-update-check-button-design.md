# Update Check Button — Design Spec

**Goal:** Adicionar um botão na title bar ao lado do nome "Claritas" que permite verificar manualmente se há uma nova versão disponível no GitHub.

**Architecture:** Extender o `electron-updater` já configurado. O botão aciona `autoUpdater.checkForUpdates()` via IPC. O resultado (sem atualização ou atualização disponível) é comunicado de volta ao renderer via eventos IPC.

**Tech Stack:** electron-updater (já presente), React state, lucide-react icons, IPC main↔renderer existente.

---

## Fluxo

1. Usuário clica o botão → renderer envia `check-for-updates` via IPC.
2. Main chama `autoUpdater.checkForUpdates()`.
3. Se não há atualização: main envia evento `update-not-available` → renderer mostra checkmark verde por 2,5 s.
4. Se há atualização: `electron-updater` faz download → ao concluir dispara `update-downloaded` → main envia `update-available` → toast já existente em `App.jsx` cuida do resto.
5. Se erro: renderer volta para idle silenciosamente (erro já logado no console pelo handler existente).

---

## UI

**Posição:** lado direito da title bar, substituindo o spacer atual (`div h-7 w-7`). Mantém "Claritas" centralizado.

**Tamanho/estilo:** `ghost`, `h-7 w-7`, `app-region-no-drag` — idêntico ao botão da sidebar.

**Estados do botão:**

| Estado | Ícone | Cor | Duração |
|--------|-------|-----|---------|
| `idle` | `RefreshCw` | muted-foreground | — |
| `checking` | `RefreshCw` girando (`animate-spin`) | muted-foreground | até resposta |
| `upToDate` | `Check` | green-500 | 2,5 s → volta a idle |

Quando há atualização disponível, o botão volta a `idle` e o toast existente assume a interação.

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/main/updateService.js` | Handler IPC `check-for-updates`; evento `update-not-available` para o renderer |
| `src/preload/index.js` | Expor `checkForUpdates()` e `onUpdateNotAvailable(cb)` |
| `src/renderer/src/App.jsx` | Botão na title bar + máquina de estado `idle / checking / upToDate` |

---

## Fora de escopo

- Exibir número da versão disponível no botão/tooltip.
- Checagem via fetch direto na GitHub API (mantemos electron-updater como única fonte).
- Alterar intervalo de checagem automática (permanece 1 h).
