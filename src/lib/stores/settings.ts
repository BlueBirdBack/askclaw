import { writable } from 'svelte/store'

const STORAGE_KEY = 'askclaw_settings'

interface Settings {
  fontSize: number // percentage, 100 = default
}

const defaults: Settings = {
  fontSize: 100,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>
      return { ...defaults, ...parsed }
    }
  } catch {
    // ignore
  }
  return { ...defaults }
}

function applyFontSize(pct: number) {
  document.documentElement.style.fontSize = `${pct}%`
}

const initial = load()
applyFontSize(initial.fontSize)

export const settings = writable<Settings>(initial)

settings.subscribe((val) => {
  applyFontSize(val.fontSize)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  } catch {
    // ignore
  }
})
