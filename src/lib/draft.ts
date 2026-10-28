import { useCallback, useState } from 'react'

/** Rascunho persistido em sessionStorage (cupom, rede, dados do checkout) para retomar após expiração/refresh. */
export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = sessionStorage.getItem(key); return raw ? { ...initial, ...JSON.parse(raw) } : initial } catch { return initial }
  })
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      try { sessionStorage.setItem(key, JSON.stringify(v)) } catch { /* noop */ }
      return v
    })
  }, [key])
  return [value, set] as const
}
export function clearDraft(key: string) { try { sessionStorage.removeItem(key) } catch { /* noop */ } }
export const COUPON_KEY = 'nft-coupon'
export const CHECKOUT_KEY = 'nft-checkout'
