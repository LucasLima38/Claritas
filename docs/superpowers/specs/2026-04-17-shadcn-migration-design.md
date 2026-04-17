# SchematicClip — shadcn/ui Migration + v1.0.0 Release

**Data:** 2026-04-17  
**Status:** Aprovado  
**Autor:** Vieira + Claude  

---

## 1. Objetivo

Migrar a UI do SchematicClip de Tailwind CSS customizado para shadcn/ui (estilo padrão), corrigir os bugs conhecidos, implementar os dois itens faltantes do spec original, e publicar o release v1.0.0 no GitHub.

**Fora do escopo:** migração para Tauri (planejada para v2.0).

---

## 2. Arquitetura

### O que muda

| Camada | Status | Detalhe |
|---|---|---|
| Main process (Node.js) | ✏️ Correções + features | 2 bugs + 2 features faltantes |
| Preload / IPC bridge | ✏️ Adição | `checkInkscapeVersion` |
| AppContext (estado) | ✅ Inalterado | Bugs já corrigidos |
| Componentes React | 🔄 Migração shadcn | Componente por componente |
| Tailwind config | ✏️ Adaptação | Variáveis CSS shadcn + tema zinc |

### O que não muda

- Arquitetura Electron (main + preload + renderer)
- State machine `useReducer` no AppContext
- Lógica IPC e handlers
- Serviços do main process (clipboardService, conversionService, saveService, projectStore, tray)
- Suite de testes Vitest

---

## 3. Bugs corrigidos

### Bug 1 — Projeto ativo nulo no startup

**Causa raiz:** `get-init-data` retorna `activeProjectId: null` diretamente da store sem fallback. Se o usuário tem projetos mas `activeProjectId` é null (sessão anterior com bug), o app inicia sem projeto ativo e o botão Salvar falha silenciosamente.

**Correção:** No handler `get-init-data`, se `activeProjectId` é null mas `projects.length > 0`, auto-ativar `projects[0].id` e persistir na store antes de retornar.

### Bug 2 — Erros de save destruíam o preview (já corrigido)

`SAVE_ERROR` reducer mantém `status: 'preview'` e exibe toast. SVG permanece disponível para nova tentativa.

---

## 4. Features faltantes do spec

### Feature 1 — Diálogo "Criar pasta?" ao salvar

**Spec original:** "Pasta de destino inexistente → Diálogo: 'Criar pasta?' ou 'Escolher outra pasta'"

**Implementação:**
1. Handler `save-svg` usa `checkOutputDir` antes de salvar
2. Se pasta não existe → retorna `{ dirMissing: true, outputDir }`
3. `save()` action detecta `dirMissing` → dispatcha `DIR_MISSING` com `outputDir`
4. Reducer `DIR_MISSING`: mantém `status: 'preview'`, adiciona `dirMissing: true` e `dirMissingPath` ao estado
5. `PreviewArea` observa `state.dirMissing` → renderiza `<AlertDialog>` shadcn com duas opções:
   - **Criar automaticamente** → chama IPC `createOutputDir` → dispatcha `CLEAR_DIR_MISSING` → retenta save
   - **Escolher outra pasta** → abre dialog de diretório → atualiza projeto → dispatcha `CLEAR_DIR_MISSING` → retenta save
6. Cancelar → dispatcha `CLEAR_DIR_MISSING`, volta ao preview normalmente

### Feature 2 — Status/versão do Inkscape em Configurações

**Spec original:** "Inkscape: path detectado automaticamente, status de versão"

**Implementação:**
1. Novo IPC `checkInkscapeVersion(path)` → roda `inkscape --version` → retorna `{ ok, version }` ou `{ ok: false, error }`
2. Settings exibe botão "Verificar" ao lado do campo de path
3. Resultado exibido como `<Badge>` colorido:
   - Verde: `Inkscape 1.3.2` 
   - Vermelho: `Não encontrado` ou `Caminho inválido`

---

## 5. Migração shadcn/ui

### Setup

```bash
npx shadcn@latest init
# tema: zinc, dark mode: class, CSS variables: yes
```

Componentes a instalar: `button`, `input`, `label`, `badge`, `separator`, `scroll-area`, `alert-dialog`, `tooltip`, `sonner`

### Dark mode

shadcn usa variáveis CSS (`--background`, `--foreground`, `--primary`, etc.) com classe `dark` no `<html>`. Compatível 100% com o sistema de tema atual (`applyTheme()` no AppContext).

### Toast

`Toast.jsx` customizado aposentado. Substituído por `<Toaster>` do `sonner` em `App.jsx`. AppContext passa a chamar `toast()` / `toast.error()` diretamente via `import { toast } from 'sonner'`.

### Ordem de migração (app sempre rodável)

| # | Componente | Shadcn usado |
|---|---|---|
| 1 | `Toast.jsx` → aposentado | Sonner `<Toaster>` em App.jsx |
| 2 | `InkscapeBanner.jsx` | `Button variant="link"` |
| 3 | `StatusBar.jsx` | Tokens CSS vars apenas |
| 4 | `Toolbar.jsx` | `Button` (default, outline, ghost) |
| 5 | `PreviewArea.jsx` | `Button`, `Badge` |
| 6 | `ClipboardArea.jsx` | `Button` |
| 7 | `Sidebar.jsx` | `Button variant="ghost"`, `Badge`, `Separator` |
| 8 | `ClipGrid.jsx` | `Badge` |
| 9 | `Settings.jsx` | `Input`, `Label`, `Button`, `AlertDialog`, `Badge` (inkscape status) |
| 10 | `App.jsx` | `<Toaster>` |

---

## 6. Testes

### Suite existente (40 testes)
Todos devem permanecer passando após as alterações.

### Novos testes

| Teste | Arquivo | Valida |
|---|---|---|
| `get-init-data`: `activeProjectId` null + projetos existentes → retorna primeiro projeto ativo | `projectStore.test.js` | Bug 1 fix |
| `checkInkscapeVersion`: path válido → retorna versão parseada | `conversionService.test.js` | Feature 2 |
| `checkInkscapeVersion`: path inválido → retorna `{ ok: false }` | `conversionService.test.js` | Feature 2 |
| `save-svg`: dir inexistente → retorna `{ dirMissing: true }` | `saveService.test.js` | Feature 1 |

---

## 7. Release v1.0.0

### Build

```bash
npm run dist   # electron-builder → NSIS installer + portable zip
```

### Assets do release GitHub

- `SchematicClip-Setup-1.0.0.exe` — instalador NSIS
- `SchematicClip-1.0.0-portable.zip` — versão portátil

### Release notes

```markdown
## SchematicClip v1.0.0

Converte esquemáticos do Altium Designer para SVG em 3 cliques.

### Requisitos
- Windows 10 / 11
- [Inkscape 1.x](https://inkscape.org/release/) instalado

### Funcionalidades
- Clipboard EMF → SVG via Inkscape CLI
- Múltiplos projetos com prefixo e pasta configuráveis
- Nomeação sequencial automática (BLDC_001.svg, BLDC_002.svg…)
- Preview com metadados antes de salvar
- Diálogo para criar pasta de saída automaticamente
- System tray — app sempre disponível
- Tema Claro / Escuro / Sistema
- Histórico de SVGs da sessão atual

### Instalação
Execute o instalador e siga as instruções. Na primeira execução,
configure o caminho do Inkscape em Configurações → Inkscape.
```

### Tag e publicação

```bash
git tag v1.0.0
git push origin v1.0.0
# Criar release no GitHub com os assets e release notes acima
```

---

## 8. Arquivos modificados

### Main process
- `src/main/index.js` — fix bug 1 (get-init-data fallback), feature 1 (dirMissing), feature 2 (checkInkscapeVersion IPC)
- `src/main/conversionService.js` — adicionar `checkInkscapeVersion()`
- `src/main/saveService.js` — restaurar `checkOutputDir` antes do save (para dirMissing)

### Preload
- `src/preload/index.js` — expor `checkInkscapeVersion`

### Renderer
- `src/renderer/src/App.jsx` — adicionar `<Toaster>`
- `src/renderer/src/context/AppContext.jsx` — substituir dispatch toast por `toast()` do sonner
- `src/renderer/src/components/Toast.jsx` — **deletar**
- `src/renderer/src/components/InkscapeBanner.jsx` — shadcn tokens
- `src/renderer/src/components/StatusBar.jsx` — shadcn tokens
- `src/renderer/src/components/Toolbar.jsx` — `<Button>`
- `src/renderer/src/components/PreviewArea.jsx` — `<Button>`, `<Badge>`
- `src/renderer/src/components/ClipboardArea.jsx` — `<Button>`
- `src/renderer/src/components/Sidebar.jsx` — `<Button>`, `<Badge>`, `<Separator>`
- `src/renderer/src/components/ClipGrid.jsx` — `<Badge>`
- `src/renderer/src/components/Settings.jsx` — `<Input>`, `<Label>`, `<Button>`, `<AlertDialog>`, `<Badge>`

### Testes
- `tests/main/projectStore.test.js` — 1 novo teste
- `tests/main/conversionService.test.js` — 2 novos testes
- `tests/main/saveService.test.js` — 1 novo teste

### Config
- `tailwind.config.js` — variáveis CSS shadcn, fonte padrão shadcn (Geist ou Inter)
- `src/renderer/src/index.css` — variáveis CSS shadcn (light + dark)
