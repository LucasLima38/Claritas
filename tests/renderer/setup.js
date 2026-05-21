import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'

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
