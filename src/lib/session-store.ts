import type { Session } from '@/api/types'

/**
 * Fonte de verdade síncrona da sessão (token) para Axios, Router e Socket.
 * O perfil completo vive no cache do TanStack Query; aqui guardamos só o necessário para recuperar após refresh.
 */
type Listener = (s: Session | null, reason: 'login' | 'logout' | 'expired') => void
const KEY = 'nft-session'
const CART_KEY = 'nft-guest-cart'
const listeners = new Set<Listener>()

function read(): Session | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}
let current = read()

export const sessionStore = {
  get: () => current,
  set(s: Session) {
    current = s
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* noop */ }
    listeners.forEach((l) => l(s, 'login'))
  },
  clear(reason: 'logout' | 'expired' = 'logout') {
    if (!current) return
    current = null
    try { localStorage.removeItem(KEY) } catch { /* noop */ }
    listeners.forEach((l) => l(null, reason))
  },
  expire() { this.clear('expired') },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l) } },
  guestCartId() {
    try {
      let id = localStorage.getItem(CART_KEY)
      if (!id) { id = crypto.randomUUID(); localStorage.setItem(CART_KEY, id) }
      return id
    } catch { return 'ephemeral' }
  },
  /** Após login o carrinho do visitante é mesclado no servidor; um novo id evita reaproveitar itens. */
  rotateGuestCart() { try { localStorage.setItem(CART_KEY, crypto.randomUUID()) } catch { /* noop */ } },
}
