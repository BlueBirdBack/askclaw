import { writable } from 'svelte/store'

const STORAGE_KEY = 'askclaw_token'
const REDACTED = '[REDACTED]'

// This SPA keeps the bridge bearer token in localStorage because the bridge expects
// explicit Authorization headers from the browser. That is an XSS tradeoff, so the
// token must never be logged or echoed back in user-visible errors.
let currentToken = readInitialToken()

export function redactSensitiveAuth(value: string): string {
  let nextValue = value

  if (currentToken) {
    nextValue = nextValue.split(currentToken).join(REDACTED)
  }

  return nextValue
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(/([?&](?:token|auth_token)=)[^&\s]+/gi, `$1${REDACTED}`)
    .replace(/(["']?(?:token|authToken|authorization)["']?\s*[:=]\s*["']?)([^"',\s]+)(["']?)/gi, `$1${REDACTED}$3`)
}

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

      currentToken = ''
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

      currentToken = nextValue
      set(nextValue)
    },
  }
}

export const authToken = createAuthTokenStore()
