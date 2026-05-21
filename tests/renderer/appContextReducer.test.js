// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { reducer } from '../../src/renderer/src/context/AppContext.jsx'

const baseState = { account: null, status: 'idle', notifications: [] }

describe('SET_ACCOUNT', () => {
  it('sets account to provided object', () => {
    const user = { email: 'a@b.com', name: 'A', photo: '', syncing: false, syncError: null }
    const next = reducer(baseState, { type: 'SET_ACCOUNT', account: user })
    expect(next.account).toEqual(user)
  })
  it('sets account to null on logout', () => {
    const state = { ...baseState, account: { email: 'a@b.com', name: 'A', photo: '', syncing: false, syncError: null } }
    const next = reducer(state, { type: 'SET_ACCOUNT', account: null })
    expect(next.account).toBeNull()
  })
})

describe('SET_SYNCING', () => {
  it('updates account.syncing when account exists', () => {
    const state = { ...baseState, account: { email: 'a@b.com', name: 'A', photo: '', syncing: false, syncError: null } }
    const next = reducer(state, { type: 'SET_SYNCING', syncing: true })
    expect(next.account.syncing).toBe(true)
  })
  it('leaves account null if account is null', () => {
    const next = reducer(baseState, { type: 'SET_SYNCING', syncing: true })
    expect(next.account).toBeNull()
  })
})

describe('SET_SYNC_ERROR', () => {
  it('updates account.syncError when account exists', () => {
    const state = { ...baseState, account: { email: 'a@b.com', name: 'A', photo: '', syncing: false, syncError: null } }
    const next = reducer(state, { type: 'SET_SYNC_ERROR', error: 'Network error' })
    expect(next.account.syncError).toBe('Network error')
  })
})

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
