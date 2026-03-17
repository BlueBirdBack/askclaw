import { writable } from 'svelte/store'

const STORAGE_KEY = 'askclaw_token'

function readInitialToken(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(STORAGE_KEY) ?? ''
}

function createAuthTokenStore() {
  const { subscribe, set } = writable(readInitialToken())

  return {
    subscribe,
    clearToken() {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY)
      }

      set('')
    },
    setToken(value: string) {
      const nextValue = value.trim()

      if (typeof window !== 'undefined') {
        if (nextValue) {
          window.localStorage.setItem(STORAGE_KEY, nextValue)
        } else {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      }

      set(nextValue)
    },
  }
}

export const authToken = createAuthTokenStore()
