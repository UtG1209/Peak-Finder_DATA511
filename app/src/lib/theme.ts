// Theme: light or dark. Follows the system setting until the user picks one with the toggle; the pick is stored in localStorage (never required:
// every storage call is in try/catch and the page renders fine without it). The chosen theme is the data-theme attribute on <html>, which styles/tokens.css reads.
// index.html sets the attribute in a tiny inline script before the stylesheet so there is no flash of the wrong theme; keep its logic in step with resolveTheme().
import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
export const THEME_KEY = 'peak-finder-theme'

// ---- pure parts (unit-tested) ----
export const parseTheme = (v: unknown): Theme | null => (v === 'light' || v === 'dark' ? v : null)
/** A stored choice wins; otherwise follow the system. */
export const resolveTheme = (stored: Theme | null, systemDark: boolean): Theme => stored ?? (systemDark ? 'dark' : 'light')
export const otherTheme = (t: Theme): Theme => (t === 'dark' ? 'light' : 'dark')

// ---- browser side ----
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function storedTheme(): Theme | null {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY))
  } catch {
    return null
  }
}
const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches

/** The theme in effect: what <html data-theme> says, else stored choice, else the system setting. */
export function getTheme(): Theme {
  const attr = typeof document !== 'undefined' ? parseTheme(document.documentElement.getAttribute('data-theme')) : null
  return attr ?? resolveTheme(storedTheme(), systemDark())
}

/** Apply a theme. `persist: false` applies it without remembering it (used when following the system). */
export function setTheme(theme: Theme, persist = true) {
  document.documentElement.setAttribute('data-theme', theme)
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* private mode or storage disabled: the choice just lasts until reload */
    }
  }
  notify()
}
export const toggleTheme = () => setTheme(otherTheme(getTheme()))

let watching = false
function watchSystem() {
  if (watching || typeof matchMedia !== 'function') return
  watching = true
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!storedTheme()) setTheme(resolveTheme(null, systemDark()), false) // only while the user has not chosen
  })
  addEventListener('storage', (e) => {
    if (e.key === THEME_KEY) setTheme(resolveTheme(parseTheme(e.newValue), systemDark()), false) // another tab changed it
  })
}

function subscribe(cb: () => void) {
  watchSystem()
  listeners.add(cb)
  return () => void listeners.delete(cb)
}

/** React hook: [theme, toggle, set]. */
export function useTheme(): readonly [Theme, () => void, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light' as Theme)
  return [theme, toggleTheme, setTheme] as const
}

/** Read a CSS custom property of the current theme (e.g. readToken('--map-land')) for canvas/WebGL code that cannot use var(). Call again after a theme change. */
export function readToken(name: string, root: HTMLElement = document.documentElement): string {
  return getComputedStyle(root).getPropertyValue(name.startsWith('--') ? name : `--${name}`).trim()
}
