# Notifications Design

## Overview

Add a persistent notification center to Claritas. Notifications are triggered by app-level errors and system events, stored to disk, and accessed via a Dialog popup opened from the gear menu in the sidebar.

---

## UI Flow

1. User clicks the gear button at the bottom of the sidebar → `DropdownMenu` opens.
2. User clicks **Notificações** → `NotificationsDialog` opens (centered, modal).
3. Dialog shows a list of notifications with tabs: **Todos** / **Não lidos**.
4. Closing the dialog marks all currently visible notifications as read.
5. A small red dot on the **Notificações** menu item signals unread notifications (visible while the dropdown is open).

---

## Notification Types

| Type | Color | Events |
|------|-------|--------|
| `error` | Red | Conversion error, save error |
| `warning` | Amber | Output folder not found |
| `info` | Blue | Update available |

Each notification has:
```ts
{
  id: string           // crypto.randomUUID()
  type: 'error' | 'warning' | 'info'
  message: string
  read: boolean
  timestamp: number    // Date.now()
}
```

---

## Events → Notifications

| Trigger | Type | Message |
|---------|------|---------|
| Conversion fails | `error` | `"Erro de conversão: <detail>"` |
| Save fails | `error` | `"Erro ao salvar: <detail>"` |
| Output folder missing | `warning` | `"Pasta de saída não encontrada: <path>"` |
| Update available | `info` | `"Nova versão <version> disponível"` |

---

## State

Added to `AppContext` initial state:

```js
notifications: []   // Notification[]
```

New actions:
- `addNotification(notification)` — prepends to array, trims to last 50
- `markAllRead()` — sets `read: true` on all entries
- `clearNotifications()` — empties the array

Derived selector (used for the unread badge):
```js
const unreadCount = state.notifications.filter(n => !n.read).length
```

---

## Persistence

- Stored in `electron-store` under key `notifications` (array, max 50).
- Loaded in `getInitData` alongside projects and settings.
- Saved on every `addNotification` and `clearNotifications` action via an IPC call (`save-notifications`).

---

## Components

### `NotificationsDialog` (`src/renderer/src/components/NotificationsDialog.jsx`)

- Wraps Radix `<Dialog>` (already in project).
- Props: `open: bool`, `onOpenChange: fn`, `notifications: Notification[]`, `onMarkAllRead: fn`, `onClear: fn`.
- Two tabs rendered with simple filter — no external tab library needed.
- `onOpenChange` triggers `markAllRead()` when closing (i.e., when `open` goes from `true` to `false`).

### Changes to `Sidebar.jsx`

- Remove `disabled` from the Notificações `DropdownMenuItem`.
- Add `onClick={() => onOpenNotifications()}` to that item.
- Add a small red dot (`w-2 h-2 rounded-full bg-destructive`) inside the item when `unreadCount > 0`.
- New prop: `onOpenNotifications: fn`.

### Changes to `App.jsx`

- Add state: `const [notifOpen, setNotifOpen] = useState(false)`.
- Pass `onOpenNotifications={() => setNotifOpen(true)}` to `<Sidebar>`.
- Render `<NotificationsDialog open={notifOpen} onOpenChange={setNotifOpen} ... />`.
- Wire existing `onUpdateAvailable` handler to also call `actions.addNotification(...)`.

### Changes to `AppContext.jsx`

- Add `notifications` to `initialState`.
- Add reducer cases: `ADD_NOTIFICATION`, `MARK_ALL_READ`, `CLEAR_NOTIFICATIONS`.
- Add corresponding action creators.

### Changes to `src/main/index.js`

- Add IPC handler `save-notifications` — receives the array and writes to store.

### Changes to `src/main/projectStore.js`

- Add `getNotifications()` and `saveNotifications(list)` helpers.
- Include `notifications` in `getInitData` response.

---

## IPC

| Channel | Direction | Payload |
|---------|-----------|---------|
| `save-notifications` | renderer → main | `Notification[]` |

`notifications` added to `get-init-data` response (already called at startup).

---

## Error integration points

Existing IPC events that need to call `addNotification` on the renderer side:

| Event | Where handled currently |
|-------|------------------------|
| Conversion error | `AppContext` reducer (`CONVERSION_ERROR`) |
| Save error | `AppContext` reducer (`SAVE_ERROR`) |
| Dir missing | `AppContext` reducer (`DIR_MISSING`) |
| Update available | `App.jsx` `onUpdateAvailable` handler |

Each of these already updates UI state — the change is to also dispatch `ADD_NOTIFICATION` alongside the existing dispatch.

---

## Persistence limit

Maximum **50** notifications. When `addNotification` is called and the array already has 50 items, the oldest (last in the array) is dropped before prepending the new one.

---

## Out of scope

- Per-notification actions (clicking a notification does nothing beyond marking it read on dialog close).
- Notification sound or OS-level toast.
- Filtering by type.
- Pagination.
