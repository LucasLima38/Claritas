# Lightbox Viewer — Design Spec

## Overview

When the user clicks a card in the Recentes grid, a floating dialog opens showing the file at full quality with navigation between history entries.

## User-Facing Behavior

- Click any card in the Recentes grid → opens the lightbox viewer
- Viewer shows the file preview (image for SVG/PNG/JPG; thumbnail PNG for PDF)
- Navigate between history entries with on-screen ← → arrows or keyboard ArrowLeft/ArrowRight
- Arrows are disabled at the first and last entry
- Esc key closes the dialog (handled natively by shadcn Dialog)
- Footer actions: Copiar arquivo, Ir para a pasta, Deletar
- Deleting the current entry:
  - If it was the only entry → dialog closes
  - Otherwise → selectedIndex stays the same (now points to the next entry); if it was the last entry, index decrements by 1

## Architecture

### Files changed

| File | Change |
|------|--------|
| `src/renderer/src/components/ui/dialog.jsx` | New — shadcn Dialog component (add via `npx shadcn@latest add dialog`) |
| `src/renderer/src/components/LightboxModal.jsx` | New — the viewer dialog component |
| `src/renderer/src/components/ClipGrid.jsx` | Modified — adds `selectedIndex` state, click handlers on cards, renders `<LightboxModal>` |

No changes to `AppContext.jsx`, no new IPC channels.

### State

`selectedIndex` lives in `ClipGrid` as local React state (`useState(null)`). `null` = closed. An integer index into `state.history` = open on that entry.

The index tracks position in `state.history` (the array in AppContext). When the history array changes after a delete, the index is adjusted before the next render.

### LightboxModal props

```js
LightboxModal({
  entries,       // state.history — full array
  index,         // integer | null
  onClose,       // () => void
  onNavigate,    // (newIndex) => void
  onDelete,      // (entry) => void — calls actions.deleteHistoryEntry, then adjusts index
})
```

## Component Design — LightboxModal

Uses `Dialog`, `DialogContent` from shadcn/ui (`@/components/ui/dialog`).

### Overlay

Override the default overlay opacity by passing `className="bg-black/50"` to `DialogOverlay` (or via the `overlayClassName` prop if the project's dialog wrapper supports it). The app remains partially visible behind the dialog.

### Layout

```
┌─────────────────────────────────────┐
│ SCH_001.svg              [1 / 5]  ✕ │  ← header
├─────────────────────────────────────┤
│                                     │
│   ‹        [   image   ]        ›   │  ← image area (flex-1, min-h-0)
│                                     │
├─────────────────────────────────────┤
│ 14:32 · 48.2 KB   [Copiar] [Pasta] [Del] │  ← footer
└─────────────────────────────────────┘
```

- Dialog width: `max-w-2xl` (672px), height auto with `max-h-[85vh]`
- Image area: `flex-1 min-h-0 flex items-center justify-center bg-muted/30`
- Image element: `max-w-full max-h-full object-contain` (fills the area without overflow)
- Navigation arrows: `Button variant="ghost" size="icon"` positioned absolute left/right center of the image area; `disabled` at boundaries
- File counter (1 / 5) in header, muted text

### Image source logic

```js
const entry = entries[index]
const isPdf = entry.filename.endsWith('.pdf')
const src = isPdf
  ? toFileUrl(entry.thumbPath)   // PNG thumbnail stored in userData/thumbs/
  : toFileUrl(entry.fullPath)    // actual file via localfile:// protocol
```

If `isPdf && !entry.thumbPath` → show `<FileText>` icon fallback (same as ClipCard).

### Keyboard navigation

```js
useEffect(() => {
  if (index === null) return
  function handleKey(e) {
    if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    if (e.key === 'ArrowRight' && index < entries.length - 1) onNavigate(index + 1)
  }
  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [index, entries.length, onNavigate])
```

### Footer actions

- **Copiar arquivo**: calls `window.electronAPI.copyFileToClipboard({ fullPath: entry.fullPath })` + `toast.success`
- **Ir para a pasta**: calls `window.electronAPI.showInFolder({ fullPath: entry.fullPath })`
- **Deletar**: calls `onDelete(entry)` which internally calls `actions.deleteHistoryEntry(entry)` and adjusts index in ClipGrid

## Changes to ClipGrid

```jsx
const [selectedIndex, setSelectedIndex] = useState(null)

// On ClipCard: add onClick={() => setSelectedIndex(i)} to the Card element
// (ClipCard receives onOpen prop)

// Delete handler passed to LightboxModal:
function handleLightboxDelete(entry) {
  const idx = state.history.findIndex(e => e.id === entry.id)
  actions.deleteHistoryEntry(entry)
  // After deletion, history will have one fewer item
  if (state.history.length === 1) {
    setSelectedIndex(null)
  } else if (idx >= state.history.length - 1) {
    setSelectedIndex(idx - 1)
  }
  // else selectedIndex stays the same — now points to next entry
}

// Render at bottom of component:
<LightboxModal
  entries={state.history}
  index={selectedIndex}
  onClose={() => setSelectedIndex(null)}
  onNavigate={setSelectedIndex}
  onDelete={handleLightboxDelete}
/>
```

## Testing

- Unit tests are not required for this UI-only component (no business logic, no IPC changes)
- Manual testing covers: open modal, navigate forward/backward, keyboard nav, delete first/middle/last entry, delete only entry, PDF thumbnail display, fallback icon when thumbPath missing

## Out of Scope

- Zoom/pan within the modal
- Drag-to-reorder from the modal
- Sharing or exporting from the modal
