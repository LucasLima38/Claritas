# i18n Language Selector — Design Spec
Date: 2026-06-02

## Overview
Add a language selector dropdown to the Claritas website (`gh-pages` branch), making English the official default language and supporting 6 languages via an inline JS translation system.

## Languages
| Code | Display name | Flag |
|------|-------------|------|
| `en` | English | 🇺🇸 |
| `pt-BR` | Português (BR) | 🇧🇷 |
| `es` | Español | 🇪🇸 |
| `fr` | Francês | 🇫🇷 |
| `de` | Deutsch | 🇩🇪 |
| `zh-CN` | 中文 | 🇨🇳 |

## UI Component
A dropdown button positioned in `header-right`, to the left of the `.theme-pills`.

```
[🇺🇸 EN ▾]   [Claritas | Dark]   [↓ Download]
```

- Button shows: flag emoji + language code + chevron (`🇺🇸 EN ▾`)
- Click opens a panel listing all 6 options (flag + display name)
- Active language is highlighted
- Closes on outside click or selection

## Translation System
- All translatable elements receive `data-i18n="key"` attributes
- A `TRANSLATIONS` object embedded in the HTML holds all strings for all 6 languages
- `setLanguage(lang)` function: swaps all `[data-i18n]` text, updates `<html lang>`, `<title>`, and saves to `localStorage('claritas-lang')`
- Default language: `en`

## Translation Coverage
| Area | Keys |
|------|------|
| `<title>` + `<meta description>` | `meta.title`, `meta.description` |
| Nav links | `nav.overview`, `nav.clipboard`, `nav.capture`, `nav.drive`, `nav.kofi` |
| Hero badge | `hero.badge` |
| Hero heading + subheading | `hero.title`, `hero.titleAccent`, `hero.sub` |
| Hero CTAs | `hero.download`, `hero.github` |
| Feature sections (4x) | `feature[N].eyebrow`, `feature[N].title`, `feature[N].desc` |
| Steps/walkthrough | `step[N].title`, `step[N].desc` |
| Ko-fi section | `kofi.heading`, `kofi.sub`, `kofi.btn` |
| Footer | `footer.copy` |

**Not translated:** Claritas, Altium Designer, SVG, EMF, Google Drive, keyboard shortcuts.

## Persistence & Initialization
Inline script before `<body>` (alongside existing theme script):
```js
var l = localStorage.getItem('claritas-lang') || 'en';
document.documentElement.setAttribute('lang', l);
```
No `navigator.language` auto-detection — user always starts with `en` unless they previously selected another language.

## Files Changed
- `index.html` — sole file: add `data-i18n` attributes, `TRANSLATIONS` object, `setLanguage()` function, dropdown HTML + CSS
- `privacy.html` — translate static strings (minimal)
