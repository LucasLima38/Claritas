# Output Mode: Local vs Drive — Design Spec

**Date:** 2026-05-19  
**Status:** Approved

---

## Overview

Each project currently requires a local output folder (`outputDir`) and optionally uploads to Google Drive after saving locally. This spec adds an exclusive `outputMode` field so users can choose either local-only or Drive-only output per project.

---

## Data Model

### New field on project object
```js
outputMode: 'local' | 'drive'   // default: 'local'
```

### Migration (transparent)
- Existing projects that already have `outputDir` set → treated as `outputMode: 'local'` (no stored field needed — absence defaults to `'local'`)
- Existing projects that have `driveFolderId` but no `outputDir` → `outputMode: 'drive'`
- No migration script required; defaults handle backward compatibility

### History entry additions (Drive-only)
```js
{
  // existing fields...
  fullPath: null,                    // no local file
  driveFileUrl: '<Drive file URL>',  // direct link to uploaded file
}
```

---

## UI — Project Form (Settings.jsx)

### Toggle control
A segmented toggle labeled **"Destino de saída"** appears above the destination fields:

```
Destino de saída
  ○ Local   ● Drive
```

Implemented as two buttons (or radio-style) setting `form.outputMode`.

### Mode: Local (default)
- Shows: `Pasta de saída` input + `Explorar` button
- Hides: `DriveProjectSection`

### Mode: Drive
- Hides: `Pasta de saída` field
- Shows: `DriveProjectSection` inline, with label changed from  
  `"Pasta no Google Drive (opcional)"` → `"Pasta no Google Drive"`

### Validation (submitForm)
| Mode  | Required fields |
|-------|----------------|
| local | `name`, `prefix`, `outputDir` |
| drive | `name`, `prefix`, `driveFolderId` (must already be linked) |

### Mode switching behavior
When the user toggles between modes, values from the inactive mode are preserved in the form state but not shown or validated. On save, only the active mode's fields are written to the project — the other mode's field is cleared (`outputDir: ''` when saving in Drive mode; `driveFolderId/driveFolderUrl: null` when saving in Local mode).

---

## Main Process — Save Handlers

### Handler: `save-svg` and `save-image`

Both handlers check `project.outputMode` (defaulting to `'local'` when absent).

#### Mode: local (current behavior, simplified)
1. `checkOutputDir(project.outputDir)` — return error if missing
2. Write file to `project.outputDir`
3. Increment counter, record history entry with `fullPath`
4. *(Drive parallel upload removed — local mode has no Drive folder)*

#### Mode: drive
1. Verify `project.driveFolderId` is set
2. Generate filename using prefix + counter
3. Write file to OS temp directory (`os.tmpdir()`)
4. Upload temp file to Drive folder (`uploadFileToDriveFolder`)
5. Delete temp file (`fs.unlink`)
6. Increment counter, record history entry with `fullPath: null, driveFileUrl: <upload result URL>`
7. On upload error → return error, do not increment counter, clean up temp

---

## History UI Adaptations

History entries are identified as Drive-only when `entry.fullPath === null`.

| Action | Local entry | Drive-only entry |
|--------|-------------|-----------------|
| Miniatura | shown | shown (generated before temp deletion) |
| Abrir no Explorer | shown | **hidden** |
| Copiar arquivo | shown | **hidden** |
| Abrir no Drive | shown if `driveFileUrl` | **always shown** (primary action) |

The "Abrir no Drive" button uses an `ExternalLink` icon and calls `window.electronAPI.openExternal(entry.driveFileUrl)`.

---

## Out of Scope

- Simultaneous local + Drive output (additive mode) — not in this spec
- Syncing Drive-only files back to local
- Per-export mode override (mode is per-project, not per-save)
