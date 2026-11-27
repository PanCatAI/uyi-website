import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

if (typeof window !== 'undefined') {
  if (typeof window.localStorage?.setItem !== 'function') {
    const ls = createMemoryStorage()
    Object.defineProperty(window, 'localStorage', { value: ls, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  }
  if (typeof window.sessionStorage?.setItem !== 'function') {
    const ss = createMemoryStorage()
    Object.defineProperty(window, 'sessionStorage', { value: ss, configurable: true })
    Object.defineProperty(globalThis, 'sessionStorage', { value: ss, configurable: true })
  }
}

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  window.localStorage.clear()
})

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom does not implement PointerEvent (used by @base-ui/react Checkbox) or elementFromPoint (used by input-otp).
if (typeof window !== 'undefined' && !window.PointerEvent) {
  Object.defineProperty(window, 'PointerEvent', {
    value: window.MouseEvent,
    configurable: true,
  })
}

if (typeof window !== 'undefined') {
  window.scrollTo = () => {}
}

if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null
}
