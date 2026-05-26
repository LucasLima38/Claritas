import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import translations from '../../src/renderer/src/locales/pt-BR/translation.json'

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

const stableT = (key, vars) => {
  const value = resolvePath(translations, key)
  if (value === undefined) return key
  if (vars && typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{{${k}}}`))
  }
  return value
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: { language: 'pt-BR', changeLanguage: vi.fn() },
  }),
  Trans: ({ i18nKey, children }) => children ?? i18nKey,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// jsdom doesn't implement ResizeObserver — provide a no-op stub
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Allow @testing-library/dom to detect vitest fake timers
// (it checks for `jest` global; vitest uses vi instead)
if (typeof globalThis.jest === 'undefined') {
  globalThis.jest = vi
}

afterEach(() => {
  vi.useRealTimers()
})
