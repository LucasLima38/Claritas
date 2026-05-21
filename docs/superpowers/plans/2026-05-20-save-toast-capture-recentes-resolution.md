# Save Toast, Capture Recentes & Resolution Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a save toast notification, a Recentes panel in Capture mode, and a per-capture resolution picker (Baixa/Normal/Alta) to the Claritas Electron app.

**Architecture:** All three features reuse existing patterns. The toast uses a new `saveToast` field in the React `useReducer`-based `AppContext`. The Recentes panel extends the existing `ClipGrid` component with a `filter` prop. The resolution picker lives in `ImageEditor` local state and flows through to the `save-image` IPC handler via `sharp`.

**Tech Stack:** React 18, Electron, Vitest + Testing Library, `sharp` (already in main process), Tailwind CSS

---

## File Map

| File | Role |
|------|------|
| `src/renderer/src/context/AppContext.jsx` | Add `saveToast` state, `SHOW/HIDE_SAVE_TOAST` reducer cases, update `save` and `saveCapture` actions, add `resolution` param to `saveCapture` |
| `src/renderer/src/components/SaveToast.jsx` | **New** — overlay toast component, reads `state.saveToast`, handles auto-dismiss |
| `src/renderer/src/App.jsx` | Import and render `<SaveToast />` in root |
| `src/renderer/src/components/ClipGrid.jsx` | Add `filter?: 'clipboard' \| 'capture'` prop, filter entries, suppress `nextName` card, update guard |
| `src/renderer/src/components/CaptureTab.jsx` | Render `<ClipGrid filter="capture" />` in idle state |
| `src/renderer/src/components/ImageEditor.jsx` | Add `resolution` local state + pill selector UI, pass to `saveCapture` |
| `src/main/saveService.js` | Add `saveBuffer(buffer, outputDir, filename)` export |
| `src/main/index.js` | Add `applyResolution` helper, update `save-image` handler to accept `resolution` |
| `tests/renderer/appContextReducer.test.js` | Add tests for `SHOW_SAVE_TOAST` / `HIDE_SAVE_TOAST` |
| `tests/renderer/AppContext.notifications.test.jsx` | Add `saveToast: null` to `baseState` |
| `tests/renderer/CaptureTab.test.jsx` | Add test: renders `<ClipGrid>` in idle state |
| `tests/renderer/ImageEditor.test.jsx` | Add tests: resolution pill renders + passes to `saveCapture` |
| `tests/main/saveService.test.js` | Add tests for `saveBuffer` |

---

## Task 1: AppContext — saveToast state + reducer + updated actions

**Files:**
- Modify: `src/renderer/src/context/AppContext.jsx`
- Modify: `tests/renderer/appContextReducer.test.js`
- Modify: `tests/renderer/AppContext.notifications.test.jsx`

### Background

`AppContext.jsx` uses `useReducer`. The exported `reducer` function is tested directly in `appContextReducer.test.js`. The `initialState` object declares all state fields. Actions are in a `const actions = {}` block inside the provider.

Current `actions.save()` (Clipboard save) already calls `toast.success(...)` / `toast.error(...)` from `sonner`. We're replacing these with dispatches to the new toast state. Current `actions.saveCapture()` does the same and also needs a `resolution` parameter threaded through.

- [ ] **Step 1: Write failing reducer tests**

Open `tests/renderer/appContextReducer.test.js`. Add a `describe('saveToast actions', ...)` block:

```js
describe('saveToast actions', () => {
  it('SHOW_SAVE_TOAST sets saveToast payload', () => {
    const state = { saveToast: null }
    const payload = { message: 'Salvando…', type: 'saving' }
    const next = reducer(state, { type: 'SHOW_SAVE_TOAST', payload })
    expect(next.saveToast).toEqual(payload)
  })

  it('SHOW_SAVE_TOAST with subMessage', () => {
    const state = { saveToast: null }
    const payload = { message: 'Salvando…', subMessage: 'Enviando para o Drive', type: 'saving' }
    const next = reducer(state, { type: 'SHOW_SAVE_TOAST', payload })
    expect(next.saveToast).toEqual(payload)
  })

  it('HIDE_SAVE_TOAST sets saveToast to null', () => {
    const state = { saveToast: { message: 'Salvo!', type: 'success' } }
    const next = reducer(state, { type: 'HIDE_SAVE_TOAST' })
    expect(next.saveToast).toBeNull()
  })

  it('HIDE_SAVE_TOAST when already null is a no-op', () => {
    const state = { saveToast: null }
    const next = reducer(state, { type: 'HIDE_SAVE_TOAST' })
    expect(next.saveToast).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/renderer/appContextReducer.test.js
```

Expected: FAIL — `SHOW_SAVE_TOAST` and `HIDE_SAVE_TOAST` are not in the reducer yet.

- [ ] **Step 3: Add `saveToast` to `initialState` and reducer**

In `src/renderer/src/context/AppContext.jsx`:

**3a. In `initialState`, add the new field** (look for where other state fields are declared, e.g., near `captureStatus`, and add):

```js
saveToast: null,
```

**3b. In the `reducer` function, add two new cases** (inside the `switch(action.type)` block):

```js
case 'SHOW_SAVE_TOAST':
  return { ...state, saveToast: action.payload }

case 'HIDE_SAVE_TOAST':
  return { ...state, saveToast: null }
```

- [ ] **Step 4: Run reducer tests to verify they pass**

```bash
npx vitest run tests/renderer/appContextReducer.test.js
```

Expected: All tests PASS (including the 4 new ones).

- [ ] **Step 5: Update `AppContext.notifications.test.jsx` — add `saveToast` to `baseState`**

Open `tests/renderer/AppContext.notifications.test.jsx`. Find the `baseState` object and add:

```js
saveToast: null,
```

Run to confirm no breakage:

```bash
npx vitest run tests/renderer/AppContext.notifications.test.jsx
```

Expected: All tests PASS.

- [ ] **Step 6: Update `actions.save` in `AppContext.jsx`**

Find the `actions.save` function (it calls `window.electronAPI.saveSVG` and currently does `toast.success(...)` / `toast.error(...)`).

Replace the toast calls as follows:

**Before calling `saveSVG`, dispatch saving state:**
```js
const driveEnabled = activeProject.outputMode === 'drive'
dispatch({
  type: 'SHOW_SAVE_TOAST',
  payload: {
    message: 'Salvando…',
    subMessage: driveEnabled ? 'Enviando para o Drive' : undefined,
    type: 'saving',
  },
})
```

**On success (where `toast.success(...)` currently is), replace with:**
```js
dispatch({
  type: 'SHOW_SAVE_TOAST',
  payload: { message: 'Salvo!', type: 'success' },
})
```

**On error (where `toast.error(...)` currently is), replace with:**
```js
dispatch({
  type: 'SHOW_SAVE_TOAST',
  payload: { message: err?.message ?? 'Erro ao salvar', type: 'error' },
})
```

Do NOT remove the `dispatch({ type: 'SAVE_START' })`, `dispatch({ type: 'SAVE_SUCCESS', ... })`, or `dispatch({ type: 'SAVE_ERROR' })` calls — those control other UI state and must remain.

- [ ] **Step 7: Update `actions.saveCapture` in `AppContext.jsx`**

Find `actions.saveCapture`. It currently takes `({ dataURL, format })`.

**7a. Add `resolution` parameter:**
```js
async saveCapture({ dataURL, format, resolution }) {
```

**7b. Pass `resolution` through to IPC call:**
```js
const result = await window.electronAPI.saveImage({ dataURL, projectId: activeProject.id, format, resolution })
```

**7c. Before calling `saveImage`, dispatch saving state:**
```js
const driveEnabled = activeProject.outputMode === 'drive'
dispatch({
  type: 'SHOW_SAVE_TOAST',
  payload: {
    message: 'Salvando…',
    subMessage: driveEnabled ? 'Enviando para o Drive' : undefined,
    type: 'saving',
  },
})
```

**7d. On success (where `toast.success(...)` currently is), replace with:**
```js
dispatch({
  type: 'SHOW_SAVE_TOAST',
  payload: { message: 'Salvo!', type: 'success' },
})
```

**7e. On error (where `toast.error(...)` currently is), replace with:**
```js
dispatch({
  type: 'SHOW_SAVE_TOAST',
  payload: { message: err?.message ?? 'Erro ao capturar', type: 'error' },
})
```

- [ ] **Step 8: Run the full test suite to make sure nothing broke**

```bash
npx vitest run
```

Expected: All 171+ tests pass (the notifications tests, reducer tests, and any existing save-action tests should still pass).

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/context/AppContext.jsx tests/renderer/appContextReducer.test.js tests/renderer/AppContext.notifications.test.jsx
git commit -m "feat: add saveToast state to AppContext with SHOW/HIDE_SAVE_TOAST reducer and updated save actions"
```

---

## Task 2: SaveToast component + App.jsx

**Files:**
- Create: `src/renderer/src/components/SaveToast.jsx`
- Modify: `src/renderer/src/App.jsx`

### Background

`App.jsx` already renders `<Toaster richColors position="bottom-center" />` from `sonner` for other in-app toasts. The new `SaveToast` is a separate component for save-specific feedback only — it reads `state.saveToast` from `useApp()` and handles its own lifecycle. It overlays the UI in the bottom-right corner and does NOT replace the `<Toaster>` (other non-save toasts still use sonner).

The `useApp()` hook is exported from `../context/AppContext`. The test environment is `jsdom`.

- [ ] **Step 1: Write a failing test for `SaveToast`**

Create `tests/renderer/SaveToast.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import * as AppContext from '../../src/renderer/src/context/AppContext'
import SaveToast from '../../src/renderer/src/components/SaveToast'

vi.mock('../../src/renderer/src/context/AppContext', () => ({
  useApp: vi.fn(),
}))

function setup(saveToast) {
  const dispatch = vi.fn()
  vi.mocked(AppContext.useApp).mockReturnValue({ state: { saveToast }, dispatch })
  return { dispatch }
}

describe('SaveToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when saveToast is null', () => {
    setup(null)
    const { container } = render(<SaveToast />)
    expect(container.firstChild).toBeNull()
  })

  it('renders saving state with spinner text', () => {
    setup({ message: 'Salvando…', type: 'saving' })
    render(<SaveToast />)
    expect(screen.getByText('Salvando…')).toBeTruthy()
  })

  it('renders saving state with subMessage', () => {
    setup({ message: 'Salvando…', subMessage: 'Enviando para o Drive', type: 'saving' })
    render(<SaveToast />)
    expect(screen.getByText('Enviando para o Drive')).toBeTruthy()
  })

  it('renders success state', () => {
    setup({ message: 'Salvo!', type: 'success' })
    render(<SaveToast />)
    expect(screen.getByText('Salvo!')).toBeTruthy()
  })

  it('auto-dismisses success after 2000ms', () => {
    const { dispatch } = setup({ message: 'Salvo!', type: 'success' })
    render(<SaveToast />)
    act(() => vi.advanceTimersByTime(2000))
    expect(dispatch).toHaveBeenCalledWith({ type: 'HIDE_SAVE_TOAST' })
  })

  it('auto-dismisses error after 4000ms', () => {
    const { dispatch } = setup({ message: 'Erro!', type: 'error' })
    render(<SaveToast />)
    act(() => vi.advanceTimersByTime(3999))
    expect(dispatch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(dispatch).toHaveBeenCalledWith({ type: 'HIDE_SAVE_TOAST' })
  })

  it('does not auto-dismiss saving state', () => {
    const { dispatch } = setup({ message: 'Salvando…', type: 'saving' })
    render(<SaveToast />)
    act(() => vi.advanceTimersByTime(10000))
    expect(dispatch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/renderer/SaveToast.test.jsx
```

Expected: FAIL — `SaveToast.jsx` does not exist yet.

- [ ] **Step 3: Create `SaveToast.jsx`**

Create `src/renderer/src/components/SaveToast.jsx`:

```jsx
import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

export default function SaveToast() {
  const { state, dispatch } = useApp()
  const toast = state.saveToast

  useEffect(() => {
    if (!toast) return
    if (toast.type === 'success') {
      const t = setTimeout(() => dispatch({ type: 'HIDE_SAVE_TOAST' }), 2000)
      return () => clearTimeout(t)
    }
    if (toast.type === 'error') {
      const t = setTimeout(() => dispatch({ type: 'HIDE_SAVE_TOAST' }), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (!toast) return null

  const bgColor =
    toast.type === 'success'
      ? 'bg-green-600'
      : toast.type === 'error'
        ? 'bg-red-600'
        : 'bg-gray-900'

  const icon =
    toast.type === 'success'
      ? '✓'
      : toast.type === 'error'
        ? '✕'
        : null

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-start gap-2 rounded-lg px-4 py-3 text-white shadow-lg animate-in slide-in-from-bottom-2 fade-in ${bgColor}`}
      style={{ minWidth: '220px', maxWidth: '320px' }}
    >
      {toast.type === 'saving' && (
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {icon && (
        <span className="mt-0.5 shrink-0 text-sm font-bold">{icon}</span>
      )}
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-tight">{toast.message}</span>
        {toast.subMessage && (
          <span className="mt-0.5 text-xs opacity-80">{toast.subMessage}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the SaveToast tests to verify they pass**

```bash
npx vitest run tests/renderer/SaveToast.test.jsx
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Add `SaveToast` to `App.jsx`**

Open `src/renderer/src/App.jsx`. 

**5a.** Add import near other component imports:
```js
import SaveToast from './components/SaveToast'
```

**5b.** In the return JSX, add `<SaveToast />` inside the root `div` (alongside the existing `<Toaster />` — do not remove `<Toaster />`):
```jsx
<SaveToast />
```

- [ ] **Step 6: Verify existing App tests still pass**

```bash
npx vitest run tests/renderer/App.test.jsx
```

Expected: All tests PASS.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/SaveToast.jsx src/renderer/src/App.jsx tests/renderer/SaveToast.test.jsx
git commit -m "feat: add SaveToast overlay component and render in App root"
```

---

## Task 3: ClipGrid filter prop + CaptureTab Recentes panel

**Files:**
- Modify: `src/renderer/src/components/ClipGrid.jsx`
- Modify: `src/renderer/src/components/CaptureTab.jsx`
- Modify: `tests/renderer/CaptureTab.test.jsx`

### Background

`ClipGrid` currently renders ALL `state.history` entries. It shows a "próximo arquivo previsto" placeholder card based on `nextName` (derived from `activeProject.prefix` and `counter`). When `filter="capture"`, we show only image entries and suppress the `nextName` card.

`CaptureTab` has three render branches:
- `captureStatus === 'capture-editor'` → renders `<ImageEditor />`
- `captureStatus === 'capture-countdown'` → renders a spinner
- default (idle) → renders `<CaptureControls />` inside a flex column div

The Recentes panel goes below `<CaptureControls />` in the idle branch.

`ClipGrid` is already mocked in `CaptureTab.test.jsx` — check what mock is there and update the test to assert it's rendered.

- [ ] **Step 1: Write a failing test for the `filter` prop in `ClipGrid`**

Open `tests/renderer/ClipGrid.test.jsx` (or the file that tests ClipGrid — check for it with Glob `tests/renderer/ClipGrid*`). Add tests for the `filter` prop:

```js
describe('filter prop', () => {
  it('filter="capture" shows only image entries', () => {
    const history = [
      { id: '1', filename: 'file.svg', url: '/f.svg', driveUrl: null },
      { id: '2', filename: 'screen.png', url: '/s.png', driveUrl: null },
      { id: '3', filename: 'doc.pdf', url: '/d.pdf', driveUrl: null },
      { id: '4', filename: 'photo.jpg', url: '/p.jpg', driveUrl: null },
    ]
    // mock useApp to return this history, activeProject with no prefix/counter
    // render <ClipGrid filter="capture" />
    // assert screen.png and photo.jpg cards render
    // assert file.svg and doc.pdf cards do NOT render
  })

  it('filter="clipboard" shows only svg/pdf entries', () => {
    // same history, render <ClipGrid filter="clipboard" />
    // assert file.svg and doc.pdf render
    // assert screen.png and photo.jpg do NOT render
  })

  it('filter="capture" with no image entries renders nothing', () => {
    // history has only svg entries
    // render <ClipGrid filter="capture" />
    // container.firstChild should be null
  })
})
```

Write the actual test implementation using the same mock pattern as the existing tests in that file (check how `useApp` is mocked there — it likely uses `vi.mock` + `vi.mocked(AppContext.useApp).mockReturnValue(...)`).

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run tests/renderer/ClipGrid.test.jsx
```

Expected: FAIL on the new filter tests.

- [ ] **Step 3: Update `ClipGrid.jsx` to accept and apply the `filter` prop**

Open `src/renderer/src/components/ClipGrid.jsx`.

**3a.** Change the function signature from:
```js
export default function ClipGrid() {
```
to:
```js
export default function ClipGrid({ filter }) {
```

**3b.** After deriving `state.history`, add filtered entries:
```js
const entries = filter
  ? state.history.filter((e) =>
      filter === 'capture'
        ? /\.(png|jpe?g|webp)$/i.test(e.filename)
        : /\.(svg|pdf)$/i.test(e.filename)
    )
  : state.history
```

**3c.** Replace every reference to `state.history` that renders cards with `entries` (there will be a `.map()` call and possibly a length check — update all of them).

**3d.** Update the guard condition. Currently it looks like:
```js
if (state.history.length === 0 && !nextName) return null
```

Replace with:
```js
if (entries.length === 0 && (filter === 'capture' || !nextName)) return null
```

**3e.** Find where `nextName` is used to render the "próximo arquivo previsto" placeholder card. Wrap it so it only renders when there is no `filter`:
```jsx
{!filter && nextName && (
  // existing next-file placeholder card JSX
)}
```

**3f.** In the lightbox delete handler (`handleLightboxDelete` or similar), the index lookup uses `state.history`. Update it to use `entries`:
```js
// Change from:
const idx = state.history.findIndex(...)
// To:
const idx = entries.findIndex(...)
```

- [ ] **Step 4: Run ClipGrid tests to verify filter tests pass**

```bash
npx vitest run tests/renderer/ClipGrid.test.jsx
```

Expected: All tests PASS.

- [ ] **Step 5: Write a failing test for CaptureTab rendering ClipGrid**

Open `tests/renderer/CaptureTab.test.jsx`. Check how `ClipGrid` is mocked — it should be in the `vi.mock` section at the top. If it's not mocked, add:

```js
vi.mock('../../src/renderer/src/components/ClipGrid', () => ({
  default: vi.fn(() => <div data-testid="clip-grid" />),
}))
```

Add a test:
```js
it('renders ClipGrid with filter="capture" in idle state', () => {
  setup('idle') // or whatever the default/idle captureStatus value is
  render(<CaptureTab />)
  const grid = screen.getByTestId('clip-grid')
  expect(grid).toBeTruthy()
})
```

To verify the `filter` prop is passed, you can also check:
```js
import ClipGrid from '../../src/renderer/src/components/ClipGrid'
// ...
expect(vi.mocked(ClipGrid)).toHaveBeenCalledWith(
  expect.objectContaining({ filter: 'capture' }),
  expect.anything()
)
```

- [ ] **Step 6: Run CaptureTab test to verify it fails**

```bash
npx vitest run tests/renderer/CaptureTab.test.jsx
```

Expected: FAIL — ClipGrid not rendered in CaptureTab yet.

- [ ] **Step 7: Update `CaptureTab.jsx` to render `<ClipGrid filter="capture" />`**

Open `src/renderer/src/components/CaptureTab.jsx`.

**7a.** Add import at the top:
```js
import ClipGrid from './ClipGrid'
```

**7b.** Find the default (idle) render branch. It renders `<CaptureControls />` inside something like:
```jsx
<div className="flex flex-col flex-1">
  <CaptureControls />
</div>
```

Add `<ClipGrid filter="capture" />` after `<CaptureControls />`:
```jsx
<div className="flex flex-col flex-1">
  <CaptureControls />
  <ClipGrid filter="capture" />
</div>
```

- [ ] **Step 8: Run CaptureTab tests to verify they pass**

```bash
npx vitest run tests/renderer/CaptureTab.test.jsx
```

Expected: All tests PASS.

- [ ] **Step 9: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/renderer/src/components/ClipGrid.jsx src/renderer/src/components/CaptureTab.jsx tests/renderer/CaptureTab.test.jsx
git commit -m "feat: add filter prop to ClipGrid and render capture Recentes panel in CaptureTab"
```

---

## Task 4: ImageEditor — resolution state + pill selector UI

**Files:**
- Modify: `src/renderer/src/components/ImageEditor.jsx`
- Modify: `tests/renderer/ImageEditor.test.jsx`

### Background

`ImageEditor` is a Konva-based component. Its bottom controls bar currently has: dimension text on the left, then Descartar + format dropdown + save button on the right. The resolution pill group goes between the left dimension area and the right action buttons.

`handleSave` currently calls `actions.saveCapture({ dataURL, format: captureFormat })`. It needs to also pass `resolution`.

The resolution state is local: `const [resolution, setResolution] = useState('normal')`. It resets to `'normal'` automatically every time a new ImageEditor session starts (because ImageEditor unmounts/remounts between captures).

IPC values use English lowercase: `'low'` / `'normal'` / `'high'`. UI labels: Baixa / Normal / Alta.

- [ ] **Step 1: Write failing tests for the resolution pill**

Open `tests/renderer/ImageEditor.test.jsx`. Add:

```js
describe('resolution picker', () => {
  it('renders Baixa, Normal, Alta pill buttons', () => {
    // render ImageEditor with standard mock setup
    expect(screen.getByRole('button', { name: 'Baixa' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Normal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Alta' })).toBeTruthy()
  })

  it('Normal is selected by default (has active class)', () => {
    // render ImageEditor
    const normalBtn = screen.getByRole('button', { name: 'Normal' })
    // active state: check for 'text-green-600' or a data-active attribute
    expect(normalBtn.className).toContain('text-green-600')
  })

  it('clicking Alta selects Alta', () => {
    // render ImageEditor
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }))
    expect(screen.getByRole('button', { name: 'Alta' }).className).toContain('text-green-600')
    expect(screen.getByRole('button', { name: 'Normal' }).className).not.toContain('text-green-600')
  })

  it('passes resolution to saveCapture on save', async () => {
    const mockSaveCapture = vi.fn()
    // mock actions.saveCapture = mockSaveCapture in useApp mock
    // render ImageEditor, click Alta, then click Capturar
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }))
    fireEvent.click(screen.getByRole('button', { name: /Capturar/i }))
    await waitFor(() => {
      expect(mockSaveCapture).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: 'high' })
      )
    })
  })

  it('passes resolution=low when Baixa selected', async () => {
    const mockSaveCapture = vi.fn()
    // similar setup
    fireEvent.click(screen.getByRole('button', { name: 'Baixa' }))
    fireEvent.click(screen.getByRole('button', { name: /Capturar/i }))
    await waitFor(() => {
      expect(mockSaveCapture).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: 'low' })
      )
    })
  })
})
```

Use the existing mock setup pattern from the test file (check how `useApp` and Konva are mocked before writing these tests).

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run tests/renderer/ImageEditor.test.jsx
```

Expected: FAIL — resolution buttons don't exist yet.

- [ ] **Step 3: Add `resolution` state and pill UI to `ImageEditor.jsx`**

Open `src/renderer/src/components/ImageEditor.jsx`.

**3a.** Add `resolution` state at the top of the component (with other `useState` calls):
```js
const [resolution, setResolution] = useState('normal')
```

**3b.** Find the bottom controls bar. It has a `div` with the action buttons. Add the pill group JSX before the action buttons:

```jsx
{/* Resolution picker */}
<div className="flex items-center gap-2">
  <span className="text-xs text-muted-foreground">Resolução</span>
  <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
    {[
      { value: 'low', label: 'Baixa' },
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'Alta' },
    ].map(({ value, label }) => (
      <button
        key={value}
        type="button"
        onClick={() => setResolution(value)}
        className={`text-[11px] font-semibold px-2 py-1 rounded transition-all ${
          resolution === value
            ? 'bg-background text-green-600 shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
</div>
```

**3c.** Find `handleSave` and update the `saveCapture` call to pass `resolution`:
```js
// Change from:
actions.saveCapture({ dataURL, format: captureFormat })
// To:
actions.saveCapture({ dataURL, format: captureFormat, resolution })
```

- [ ] **Step 4: Run ImageEditor tests to verify they pass**

```bash
npx vitest run tests/renderer/ImageEditor.test.jsx
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/ImageEditor.jsx tests/renderer/ImageEditor.test.jsx
git commit -m "feat: add resolution picker (Baixa/Normal/Alta) to ImageEditor controls bar"
```

---

## Task 5: Main process — saveBuffer + applyResolution + save-image handler update

**Files:**
- Modify: `src/main/saveService.js`
- Modify: `src/main/index.js`
- Modify: `tests/main/saveService.test.js`

### Background

`saveService.js` exports `saveImage(dataURL, outputDir, filename)` which strips the base64 header, decodes to a Buffer, and calls `fsp.writeFile`. We need a new `saveBuffer(buffer, outputDir, filename)` that takes an already-decoded Buffer (because `applyResolution` will process the buffer before saving).

`index.js` handles the `save-image` IPC event. The handler takes `{ dataURL, projectId, format }`. After this task it takes `{ dataURL, projectId, format, resolution }`. The handler has two code paths:
- **Drive path** (lines ~691–744): saves to temp dir via `saveImage`, then uploads to Drive; also builds a thumbnail directly from the base64 data.
- **Local path** (lines ~746–770): calls `saveImage(dataURL, project.outputDir, filename)`.

Both paths need updating to: extract buffer → `applyResolution` → `saveBuffer` (instead of `saveImage`).

`sharp` is already imported/available in `index.js`. If it's `require`d, keep that pattern; if it's imported at the top, use that.

- [ ] **Step 1: Write a failing test for `saveBuffer`**

Open `tests/main/saveService.test.js`. Add a `describe('saveBuffer', ...)` block:

```js
describe('saveBuffer', () => {
  it('writes buffer to disk and returns full path', async () => {
    const { saveBuffer } = await import('../../src/main/saveService.js')
    const buf = Buffer.from('fake-image-data')
    const result = await saveBuffer(buf, '/tmp/out', 'screen.png')
    expect(fsp.writeFile).toHaveBeenCalledWith('/tmp/out/screen.png', buf)
    expect(result).toBe('/tmp/out/screen.png')
  })

  it('creates output directory if it does not exist', async () => {
    const { saveBuffer } = await import('../../src/main/saveService.js')
    const buf = Buffer.from('data')
    await saveBuffer(buf, '/new/dir', 'img.jpg')
    expect(fsp.mkdir).toHaveBeenCalledWith('/new/dir', { recursive: true })
  })

  it('throws on writeFile error', async () => {
    const { saveBuffer } = await import('../../src/main/saveService.js')
    fsp.writeFile.mockRejectedValueOnce(Object.assign(new Error('disk full'), { code: 'ENOSPC' }))
    await expect(saveBuffer(Buffer.from('x'), '/tmp', 'f.png')).rejects.toThrow('ENOSPC')
  })
})
```

Check the existing test file for how `fsp` is mocked (it uses `vi.mock('fs', ...)` — the mock exposes `fsp` as a named export from the mock or assigns it to a variable in the test scope). Use the same pattern.

- [ ] **Step 2: Run to verify failing**

```bash
npx vitest run tests/main/saveService.test.js
```

Expected: FAIL — `saveBuffer` is not exported yet.

- [ ] **Step 3: Add `saveBuffer` to `saveService.js`**

Open `src/main/saveService.js`. Add the following export (after `saveImage`):

```js
export async function saveBuffer(buffer, outputDir, filename) {
  await fsp.mkdir(outputDir, { recursive: true })
  const fullPath = path.join(outputDir, filename)
  try {
    await fsp.writeFile(fullPath, buffer)
  } catch (err) {
    const code = err.code ?? 'WRITE_ERROR'
    throw new Error(`${code}: ${err.message}`)
  }
  return fullPath
}
```

- [ ] **Step 4: Run saveService tests to verify they pass**

```bash
npx vitest run tests/main/saveService.test.js
```

Expected: All tests PASS including the new `saveBuffer` tests.

- [ ] **Step 5: Write a failing test for `applyResolution` in `index.js`**

Check if `index.js` has a test file (Glob `tests/main/index*`). If there is one, add to it. If not, create `tests/main/applyResolution.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sharp
const mockSharpInstance = {
  metadata: vi.fn(),
  resize: vi.fn(),
  toBuffer: vi.fn(),
}
mockSharpInstance.resize.mockReturnValue(mockSharpInstance)
vi.mock('sharp', () => ({
  default: vi.fn(() => mockSharpInstance),
}))

// Import applyResolution — it's NOT exported, so we need to test via saveImage IPC
// Actually, test it indirectly through integration, OR extract it as a named export.
// Simplest: export it from index.js for testing, or copy the logic into a separate helper.
```

Since `applyResolution` is a private helper inside `index.js`, the cleanest testable approach is to **extract it into `saveService.js`** instead, where it can be easily exported and tested.

Update the plan: implement `applyResolution` in `saveService.js` and export it.

Write the test in `tests/main/saveService.test.js`:

```js
describe('applyResolution', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns buffer unchanged for normal resolution', async () => {
    const { applyResolution } = await import('../../src/main/saveService.js')
    const buf = Buffer.from('data')
    const result = await applyResolution(buf, 'image/png', 'normal')
    expect(result).toBe(buf)
  })

  it('returns buffer unchanged when resolution is undefined', async () => {
    const { applyResolution } = await import('../../src/main/saveService.js')
    const buf = Buffer.from('data')
    const result = await applyResolution(buf, 'image/png', undefined)
    expect(result).toBe(buf)
  })

  it('calls sharp.resize with 0.5x for low resolution', async () => {
    // mock sharp at module level — see below for pattern
    const sharpMock = vi.fn(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 1000, height: 800 }),
      resize: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized')),
    }))
    vi.doMock('sharp', () => ({ default: sharpMock }))
    vi.resetModules()
    const { applyResolution } = await import('../../src/main/saveService.js')
    const buf = Buffer.from('data')
    await applyResolution(buf, 'image/png', 'low')
    const instance = sharpMock.mock.results[1].value // second call is the resize call
    expect(instance.resize).toHaveBeenCalledWith(500, 400)
  })

  it('calls sharp.resize with 2x for high resolution', async () => {
    const sharpMock = vi.fn(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 1000, height: 800 }),
      resize: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized')),
    }))
    vi.doMock('sharp', () => ({ default: sharpMock }))
    vi.resetModules()
    const { applyResolution } = await import('../../src/main/saveService.js')
    const buf = Buffer.from('data')
    await applyResolution(buf, 'image/png', 'high')
    const instance = sharpMock.mock.results[1].value
    expect(instance.resize).toHaveBeenCalledWith(2000, 1600)
  })
})
```

- [ ] **Step 6: Run to verify failing**

```bash
npx vitest run tests/main/saveService.test.js
```

Expected: FAIL — `applyResolution` not exported yet.

- [ ] **Step 7: Add `applyResolution` to `saveService.js`**

Open `src/main/saveService.js`. Add the import for `sharp` at the top (check if it's already there; if not):

```js
import sharp from 'sharp'
```

Then add the export:

```js
export async function applyResolution(buffer, mimeType, resolution) {
  if (resolution === 'normal' || !resolution) return buffer
  const factor = resolution === 'high' ? 2 : 0.5
  const metadata = await sharp(buffer).metadata()
  return sharp(buffer)
    .resize(Math.round(metadata.width * factor), Math.round(metadata.height * factor))
    .toBuffer()
}
```

- [ ] **Step 8: Run saveService tests to verify all pass**

```bash
npx vitest run tests/main/saveService.test.js
```

Expected: All tests PASS.

- [ ] **Step 9: Update `save-image` IPC handler in `index.js`**

Open `src/main/index.js`. Find the `save-image` handler (around line 682).

**9a.** Add `saveBuffer` and `applyResolution` to the import from `saveService.js`:
```js
// Find the existing import line, e.g.:
import { generateFilename, saveImage, ... } from './saveService.js'
// Add saveBuffer and applyResolution:
import { generateFilename, saveImage, saveBuffer, applyResolution, ... } from './saveService.js'
```

**9b.** Update the handler signature to destructure `resolution`:
```js
// Change from:
ipcMain.handle('save-image', async (event, { dataURL, projectId, format }) => {
// To:
ipcMain.handle('save-image', async (event, { dataURL, projectId, format, resolution }) => {
```

**9c. Drive path** — find where it calls `saveImage(dataURL, os.tmpdir(), filename)` to write a temp file. Replace it with the buffer-based approach:

```js
// Extract buffer from dataURL (same decoding as saveImage does internally):
const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '')
const rawBuffer = Buffer.from(base64Data, 'base64')
const processedBuffer = await applyResolution(rawBuffer, `image/${format}`, resolution)

// Write the processed buffer to temp dir:
const tempPath = await saveBuffer(processedBuffer, os.tmpdir(), filename)
```

The thumbnail path (which also derives from base64Data) may already have its own extraction. Make sure the thumbnail still uses the raw dataURL/base64 (thumbnails should NOT be resolution-scaled — they're small previews). Only the saved file goes through `applyResolution`.

**9d. Local path** — find where it calls `saveImage(dataURL, project.outputDir, filename)`. Replace with:

```js
const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '')
const rawBuffer = Buffer.from(base64Data, 'base64')
const processedBuffer = await applyResolution(rawBuffer, `image/${format}`, resolution)
const fullPath = await saveBuffer(processedBuffer, project.outputDir, filename)
```

Note: in the local path, `saveImage` previously returned `fullPath` — make sure `fullPath` is still captured for use in the response/history entry below.

- [ ] **Step 10: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS. If `index.js` has existing IPC handler tests that test `save-image`, check them — they may need `resolution` added to their mock calls (default `undefined` is fine since `applyResolution` treats `undefined` as `normal`).

- [ ] **Step 11: Commit**

```bash
git add src/main/saveService.js src/main/index.js tests/main/saveService.test.js
git commit -m "feat: add saveBuffer and applyResolution to saveService, update save-image handler to apply resolution via sharp"
```

---

## Final Verification

- [ ] Run the complete test suite one more time:

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Start the app and manually verify:**

```bash
npm run dev
```

Check:
1. **Save Toast (Clipboard):** Open a project, draw something, click Salvar → saving spinner appears → success toast appears, auto-dismisses after 2s
2. **Save Toast (Capture):** Switch to Capture tab, take a capture, click Capturar → saving spinner → success toast
3. **Capture Recentes:** After saving a capture, switch away and back — the Recentes panel appears below CaptureControls with the captured image thumbnails
4. **Resolution Picker:** In Capture editor, switch to Alta, save — file on disk should be 2× the original dimensions (verify with an image viewer that shows pixel dimensions)
5. **Drive projects:** On a Drive-enabled project, Salvar shows the "Enviando para o Drive" sub-text in the saving toast
