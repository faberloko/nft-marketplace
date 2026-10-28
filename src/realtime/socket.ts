import type { Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import type { Cart, Nft, NftPage, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/types'
import { cartOwner, keys } from '@/api/queries'
import { sessionStore } from '@/lib/session-store'
import { announce } from '@/lib/announcer'
import { SOCKET_URL } from '@/lib/env'

export type ConnState = 'connecting' | 'connected' | 'disconnected'
let state: ConnState = 'connecting'
const stateListeners = new Set<() => void>()
const setState = (s: ConnState) => { state = s; stateListeners.forEach((l) => l()) }
export const connection = {
  get: () => state,
  subscribe: (l: () => void) => { stateListeners.add(l); return () => { stateListeners.delete(l) } },
}

/** Deduplicação por eventId e ordenação por versão do recurso: nunca regride nem reaplica efeitos. */
const seen = new Set<string>()
const versions = new Map<string, number>()
function accept(e: { eventId: string; resource: { type: string; id: string }; version: number }, cachedVersion?: number) {
  if (seen.has(e.eventId)) return false
  seen.add(e.eventId)
  if (seen.size > 500) seen.delete(seen.values().next().value!)
  const k = `${e.resource.type}:${e.resource.id}`
  const current = Math.max(versions.get(k) ?? 0, cachedVersion ?? 0)
  if (e.version <= current) return false
  versions.set(k, e.version)
  return true
}

function applyNft(qc: QueryClient, nft: Nft) {
  qc.setQueryData<Nft>(keys.nft(nft.id), (old) => (old && old.version >= nft.version ? old : nft))
  qc.setQueriesData<NftPage>({ queryKey: ['nfts'], predicate: (q) => q.queryKey[1] !== 'featured' }, (old) =>
    old?.items ? { ...old, items: old.items.map((n) => (n.id === nft.id && n.version < nft.version ? nft : n)) } : old)
  qc.setQueryData<Nft[]>(keys.featured, (old) => old?.map((n) => (n.id === nft.id && n.version < nft.version ? nft : n)))
  const cart = qc.getQueryData<Cart>(keys.cart(cartOwner()))
  if (cart?.items.some((i) => i.nftId === nft.id)) {
    // O carrinho e a cotação são recalculados pela API (fonte de verdade dos valores).
    qc.invalidateQueries({ queryKey: keys.cart(cartOwner()) })
    announce(`Atualização em tempo real: ${nft.name} teve preço ou disponibilidade alterados. O resumo foi atualizado.`, 'assertive')
  }
}

let socket: Socket | null = null
let everConnected = false

/** Liga o ciclo de vida do socket à sessão: cada usuário tem a própria conexão; a anterior é liberada. */
export async function startRealtime(qc: QueryClient) {
  // Import dinâmico: engine.io captura window.WebSocket ao carregar; precisa ocorrer após o MSW aplicar o interceptor.
  const { io } = await import('socket.io-client')
  const connect = () => {
    socket?.removeAllListeners(); socket?.disconnect()
    seen.clear(); versions.clear(); everConnected = false
    const session = sessionStore.get()
    const userId = session?.user.id ?? null
    setState('connecting')
    const s = io(SOCKET_URL, {
      transports: ['websocket'], // o binding do MSW só implementa o transporte websocket
      query: session ? { token: session.token } : {},
      reconnectionDelay: 500, reconnectionDelayMax: 3000,
    })
    socket = s
    s.on('connect', () => {
      setState('connected')
      // Toda (re)conexão reconcilia com REST os recursos ativos: eventos emitidos enquanto desconectado não são reenviados.
      qc.invalidateQueries({ refetchType: 'active' })
      if (everConnected) announce('Conexão em tempo real restabelecida. Dados sincronizados.')
      everConnected = true
    })
    s.on('disconnect', () => { setState('disconnected') })
    s.on('connect_error', () => setState('disconnected'))
    s.on('nft.updated', (e: NftUpdatedEvent) => {
      if (!accept(e, qc.getQueryData<Nft>(keys.nft(e.resource.id))?.version)) return
      applyNft(qc, e.data)
    })
    s.on('order.updated', (e: OrderUpdatedEvent) => {
      // Defesa em profundidade: eventos de outra sessão/usuário são ignorados.
      if (!userId || e.userId !== userId || sessionStore.get()?.user.id !== userId) return
      const key = keys.order(userId, e.resource.id)
      if (!accept(e, qc.getQueryData<Order>(key)?.version)) return
      qc.setQueryData<Order>(key, (old) => (old && old.version >= e.version ? old : e.data))
      qc.invalidateQueries({ queryKey: keys.pendingOrders(userId) })
      if (e.data.status === 'confirmed') { qc.invalidateQueries({ queryKey: keys.cart(cartOwner()) }); announce('Pagamento confirmado!') }
      if (e.data.status === 'declined') announce(`Pagamento recusado: ${e.data.declineReason ?? ''}`, 'assertive')
    })
  }
  connect()
  const unsub = sessionStore.subscribe(() => connect())
  return () => { unsub(); socket?.removeAllListeners(); socket?.disconnect(); socket = null }
}
