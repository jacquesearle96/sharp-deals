import { useCallback, useEffect, useState } from 'react'

/** Small settings kept on this device only. Each one survives a reload, and the app still works if storage is blocked. */
function usePref<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Private window or full storage: the choice lasts until the app closes.
    }
  }, [key, value])
  return [value, setValue] as const
}

export type Theme = 'system' | 'light' | 'dark'

/** Must match the key the inline script in index.html reads, which applies the theme before the first paint. */
export const THEME_KEY = 'sharp-deals:theme'

/** Light, dark, or whatever the phone is set to. Applied as data-theme on <html>; the colours live in index.css. */
export function useTheme() {
  const [theme, setTheme] = usePref<Theme>(THEME_KEY, 'system')
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    // The browser chrome and iPhone status bar follow the page background. For "system" the two tags in
    // index.html each keep their own colour and the browser picks by its media query.
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.dataset.initial ??= m.content
      m.content = theme === 'system' ? m.dataset.initial : bg
    })
  }, [theme])
  return [theme, setTheme] as const
}

/** Tabs hidden from the toolbar. Settings can never be hidden, so there is always a way back. */
export function useHiddenTabs<T extends string>() {
  const [hidden, setHidden] = usePref<T[]>('sharp-deals:hidden-tabs', [])
  const toggle = useCallback((tab: T) => setHidden((h) => (h.includes(tab) ? h.filter((t) => t !== tab) : [...h, tab])), [setHidden])
  return { hidden, toggle }
}
