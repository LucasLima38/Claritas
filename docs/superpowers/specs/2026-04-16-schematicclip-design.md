# SchematicClip — Design Document

**Data:** 2026-04-16  
**Status:** Aprovado  
**Autor:** Vieira (Engenheiro de Sistemas Embarcados) + Claude

---

## 1. Problema

Engenheiros que usam Altium Designer precisam gerar imagens SVG de esquemáticos elétricos para documentação técnica. O fluxo atual exige:

1. Copiar seleção no Altium
2. Abrir programa de vetorização (Affinity Designer, Illustrator ou Inkscape)
3. Colar e ajustar
4. Exportar SVG manualmente
5. Renomear e mover para a pasta correta

Repetir esse processo para dezenas de esquemáticos por projeto consome tempo significativo.

---

## 2. Solução

**SchematicClip** é um aplicativo desktop Electron que intercepta o `Ctrl+V`, detecta dados vetoriais EMF no clipboard (copiados do Altium), converte para SVG via Inkscape CLI, exibe uma prévia para confirmação e salva automaticamente na pasta do projeto com nome sequencial.

**Fluxo reduzido:**
1. Copiar no Altium (`Ctrl+C`)
2. `Ctrl+V` no SchematicClip
3. Confirmar a prévia → salvo como `BLDC_003.svg`

---

## 3. Decisões de Design

| Questão | Decisão | Justificativa |
|---|---|---|
| Plataforma | Electron 29 + React 18 | Visual moderno, Windows-first, ecossistema JS |
| Nomeação | Prefixo configurável + sequencial (`BLDC_001.svg`) | Organização por projeto sem digitação manual |
| Fluxo de save | Prévia antes de confirmar | Controle do usuário, evita saves acidentais |
| Layout | Janela completa com sidebar de projetos | Suporta múltiplos projetos, histórico visível |
| Tema | Segue `nativeTheme` do Windows (auto dark/light) | Zero configuração, consistência com o OS |
| Minimize | System tray — continua monitorando clipboard | Sempre disponível sem ocupar a barra de tarefas |
| Projetos | Múltiplos projetos com prefixo e pasta próprios | Cada projeto com sua organização independente |
| Engine EMF→SVG | Inkscape CLI (externo, já instalado) | Melhor parser EMF disponível; comunidade EDA confirma uso |

---

## 4. Contexto Técnico: Clipboard do Altium

Quando o usuário copia uma seleção no Altium Designer (`Ctrl+C`), o Windows clipboard recebe dois formatos simultaneamente:

- **Clipboard interno do Altium** — para operações Altium-para-Altium
- **`CF_ENHMETAFILE` (EMF)** — formato vetorial padrão do Windows, lido por qualquer aplicativo

O EMF armazena comandos de desenho (linhas, curvas, preenchimentos, texto) em vez de pixels. É por isso que Illustrator, Affinity Designer e Inkscape recebem o esquemático como vetores editáveis ao colar.

### Por que implementações customizadas falham

Bibliotecas como `libemf2svg` ignoram 31% dos registros EMF e têm bugs documentados com cores, texto e formas. Os problemas clássicos são:

- Tudo preto → cores de fill não processadas (`libemf2svg` Issue #31)
- Objetos invisíveis → elementos sem fill/stroke (`Inkscape` Bug #1607805)
- Símbolos faltando → registros EMF ignorados
- Texto corrompido → problemas de encoding e espaçamento

**Solução:** usar o Inkscape como engine de conversão, que é a ferramenta mais madura e a mesma usada manualmente pelos engenheiros hoje (via EEVblog workflow documentado).

---

## 5. Arquitetura

### 5.1 Camadas

```
┌─────────────────────────────────────────────────┐
│  UI Layer (Renderer Process — React + Tailwind)  │
│  Sidebar · PreviewArea · ClipGrid · Settings     │
├─────────────────────────────────────────────────┤
│            IPC (ipcMain / ipcRenderer)            │
├─────────────────────────────────────────────────┤
│   Core Layer (Main Process — Node.js)            │
│  ClipboardService · ConversionService            │
│  SaveService · ProjectStore · TrayManager        │
├─────────────────────────────────────────────────┤
│  Native Layer (Windows)                          │
│  Inkscape CLI · System Tray · Filesystem         │
├─────────────────────────────────────────────────┤
│  Data Layer (AppData)                            │
│  projects.json · settings.json · history.json   │
└─────────────────────────────────────────────────┘
```

### 5.2 Serviços do Main Process

| Serviço | Responsabilidade |
|---|---|
| `ClipboardService` | Detecta e lê `CF_ENHMETAFILE` do clipboard |
| `ConversionService` | Grava EMF em temp, chama Inkscape CLI, retorna SVG |
| `SaveService` | Gera nome sequencial, copia SVG para pasta do projeto |
| `ProjectStore` | Persiste projetos, contadores e settings via `electron-store` |
| `TrayManager` | Cria e atualiza ícone da bandeja, menu de contexto |

---

## 6. Fluxo Principal (Happy Path)

```
Ctrl+C no Altium
  └─ clipboard → CF_ENHMETAFILE (bytes EMF)

Ctrl+V no SchematicClip
  └─ ClipboardService.readBuffer('CF_ENHMETAFILE') → Buffer

  └─ ConversionService:
       1. Salva buffer em %TEMP%\schclip_<uuid>.emf
       2. Spawn: inkscape --export-filename=out.svg input.emf
       3. Timeout: 15 segundos
       4. Lê out.svg → string SVG

  └─ ipcMain emite 'svg-ready' → Renderer exibe prévia
       - Dimensões, tamanho do arquivo, tempo de conversão

Usuário clica "Salvar"
  └─ SaveService:
       1. Gera nome: {prefixo}{contador:03d}.svg  → BLDC_003.svg
       2. fs.copyFile(tempSvg, projeto.pasta/nome)
       3. Incrementa contador no ProjectStore
       4. Apaga temporários

  └─ UI: atualiza grid de histórico, status bar
```

---

## 7. Estados do Aplicativo

```
Idle ──(Ctrl+V + EMF detectado)──► Converting
                                        │
                        ┌───────────────┤
                        │               │
                    (erro)         (SVG pronto)
                        │               │
                        ▼               ▼
                      Error          Preview
                        │               │
                    (dismiss)    (Salvar / Descartar)
                        │               │
                        └──────┬────────┘
                               ▼
                             Idle
```

---

## 8. Tratamento de Erros

| Cenário | Comportamento |
|---|---|
| Clipboard sem EMF | Toast: "Nenhum esquemático vetorial encontrado no clipboard." |
| Inkscape não encontrado | Banner persistente com botão "Configurar caminho do Inkscape" |
| Inkscape timeout (>15s) | Mata processo filho, exibe erro com "Tentar novamente" |
| SVG gerado em branco/inválido | Mostra prévia em branco com aviso explicativo |
| Pasta de destino inexistente | Diálogo: "Criar pasta?" ou "Escolher outra pasta" |
| Sem permissão de escrita | Erro claro: "Sem permissão. Escolha outra pasta de saída." |

---

## 9. UX — Telas

### Tela Principal (Idle)
- **Sidebar**: lista de projetos com ponto colorido identificador; projeto ativo destacado
- **Toolbar**: botão "Colar Ctrl+V" primário; botão "Pasta de saída"; display da pasta atual
- **Drop zone**: instrução visual centralizada
- **Grid de recentes**: miniaturas dos SVGs salvos na sessão com nome, tamanho e hora
- **Status bar**: indicador de monitoramento ativo, contador de SVGs do dia, próximo nome de arquivo

### Tela Principal (Preview)
- **Preview area** com borda azul: SVG renderizado, metadados (dimensão, KB, tempo)
- **Toolbar** muda para: botão "Salvar" (verde) e "Descartar"
- **Status bar**: "Aguardando confirmação..."

### Configurações
- **Projetos**: lista editável com nome, prefixo, pasta de saída e botões editar/excluir
- **Inkscape**: path detectado automaticamente, status de versão, botão para alterar
- **Aparência**: informação sobre tema automático do Windows

### System Tray
- Ícone sempre visível na bandeja
- Menu: projeto ativo (com bullet colorido), trocar projeto, abrir janela, sair

---

## 10. Persistência de Dados

### `%APPDATA%\SchematicClip\projects.json`
```json
{
  "activeProjectId": "motor-bldc",
  "projects": [
    {
      "id": "motor-bldc",
      "name": "Motor BLDC",
      "prefix": "BLDC_",
      "outputDir": "D:\\Projetos\\Motor_BLDC\\docs\\imgs",
      "counter": 3,
      "color": "#2f81f7"
    }
  ]
}
```

### `%APPDATA%\SchematicClip\settings.json`
```json
{
  "inkscapePath": "C:\\Program Files\\Inkscape\\bin\\inkscape.exe",
  "conversionTimeout": 15000,
  "startMinimized": false
}
```

### `%APPDATA%\SchematicClip\history.json`
```json
{
  "entries": [
    {
      "id": "uuid",
      "filename": "BLDC_003.svg",
      "fullPath": "D:\\...",
      "projectId": "motor-bldc",
      "timestamp": "2026-04-16T14:32:00Z",
      "sizeBytes": 48230
    }
  ]
}
```

---

## 11. Stack Técnico

| Pacote | Versão | Função |
|---|---|---|
| `electron` | 29.x | Shell desktop |
| `react` + `react-dom` | 18.x | UI do Renderer |
| `vite` + `electron-vite` | latest | Build |
| `tailwindcss` | 3.x | Estilos utilitários |
| `lucide-react` | latest | Ícones |
| `electron-store` | 9.x | Persistência JSON no AppData |
| `electron-builder` | latest | Gera instalador `.exe` (NSIS) |

**Dependência externa obrigatória:** Inkscape 1.x instalado no Windows.  
**Detecção automática:** registro `HKLM\SOFTWARE\Inkscape` ou path padrão `C:\Program Files\Inkscape\bin\inkscape.exe`.

---

## 12. Estrutura de Arquivos do Projeto

```
schematicclip/
├── src/
│   ├── main/
│   │   ├── index.js              # Entry point do Main Process
│   │   ├── clipboardService.js   # Lê CF_ENHMETAFILE
│   │   ├── conversionService.js  # Chama Inkscape CLI
│   │   ├── saveService.js        # Nome sequencial + salvar
│   │   ├── projectStore.js       # electron-store wrapper
│   │   └── tray.js               # System tray
│   ├── renderer/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── Sidebar.jsx
│   │       ├── ClipboardArea.jsx
│   │       ├── PreviewArea.jsx
│   │       ├── ClipGrid.jsx
│   │       └── Settings.jsx
│   └── preload/
│       └── preload.js            # Bridge IPC segura
├── assets/
│   └── icon.png
├── package.json
└── electron-builder.yml
```

---

## 13. Fora do Escopo (v1)

- Exportação para PNG ou PDF
- Hotkeys globais (fora do app)
- Sincronização em nuvem
- Suporte a macOS/Linux
- Edição do SVG dentro do app
- Histórico persistente entre sessões (apenas sessão atual)
