// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock window.electronAPI before importing AppContext
beforeEach(() => {
  globalThis.window = globalThis.window ?? {}
  globalThis.window.electronAPI = {
    saveNotifications: vi.fn().mockResolvedValue({ ok: true }),
    getInitData: vi.fn().mockResolvedValue({}),
    onProjectsUpdated: vi.fn(() => () => {}),
    onThemeChanged: vi.fn(() => () => {}),
    onPreviewReady: vi.fn(() => () => {}),
    onUpdateAvailable: vi.fn(() => () => {}),
    onCaptureReady: vi.fn(() => () => {}),
    onCaptureCancelled: vi.fn(() => () => {}),
  }
})

import { reducer } from '../../src/renderer/src/context/AppContext'

const baseState = {
  status: 'idle',
  svgContent: null,
  svgMetadata: null,
  previewQueue: [],
  error: null,
  projects: [],
  activeProjectId: null,
  history: [],
  settings: {},
  dirMissing: false,
  dirMissingPath: null,
  exportFormat: 'svg',
  updateInfo: null,
  captureStatus: 'capture-idle',
  captureData: null,
  captureFormat: 'png',
  notifications: [],
}

describe('reducer — notifications', () => {
  it('INIT sets notifications from action (with notifications key)', () => {
    const notif = [{ id: '1', type: 'info', message: 'Hi', read: false, timestamp: 1 }]
    const next = reducer(baseState, {
      type: 'INIT',
      projects: [],
      activeProjectId: null,
      settings: {},
      history: [],
      notifications: notif,
    })
    expect(next.notifications).toEqual(notif)
  })

  it('INIT falls back to empty array when notifications key absent', () => {
    const next = reducer(baseState, {
      type: 'INIT',
      projects: [],
      activeProjectId: null,
      settings: {},
      history: [],
    })
    expect(next.notifications).toEqual([])
  })

  it('ADD_NOTIFICATION prepends new notification', () => {
    const existing = { id: 'old', type: 'info', message: 'Old', read: true, timestamp: 1 }
    const state = { ...baseState, notifications: [existing] }
    const newNotif = { id: 'new', type: 'error', message: 'New', read: false, timestamp: 2 }
    const next = reducer(state, { type: 'ADD_NOTIFICATION', notification: newNotif })
    expect(next.notifications[0]).toEqual(newNotif)
    expect(next.notifications[1]).toEqual(existing)
  })

  it('ADD_NOTIFICATION trims to 50 items', () => {
    const state = {
      ...baseState,
      notifications: Array.from({ length: 50 }, (_, i) => ({
        id: String(i), type: 'info', message: `m${i}`, read: false, timestamp: i,
      })),
    }
    const newNotif = { id: 'x', type: 'error', message: 'X', read: false, timestamp: 999 }
    const next = reducer(state, { type: 'ADD_NOTIFICATION', notification: newNotif })
    expect(next.notifications).toHaveLength(50)
    expect(next.notifications[0].id).toBe('x')
  })

  it('MARK_ALL_READ sets read: true on all notifications', () => {
    const state = {
      ...baseState,
      notifications: [
        { id: '1', type: 'error', message: 'A', read: false, timestamp: 1 },
        { id: '2', type: 'info', message: 'B', read: false, timestamp: 2 },
      ],
    }
    const next = reducer(state, { type: 'MARK_ALL_READ' })
    expect(next.notifications.every((n) => n.read === true)).toBe(true)
  })

  it('CLEAR_NOTIFICATIONS empties the array', () => {
    const state = {
      ...baseState,
      notifications: [{ id: '1', type: 'info', message: 'Hi', read: false, timestamp: 1 }],
    }
    const next = reducer(state, { type: 'CLEAR_NOTIFICATIONS' })
    expect(next.notifications).toEqual([])
  })
})
