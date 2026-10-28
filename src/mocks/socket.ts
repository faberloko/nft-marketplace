import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { Nft, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/types'
import { db, persist } from './db'
import { SOCKET_URL } from '@/lib/env'

/**
 * Servidor Socket.IO simulado via MSW WebSocket + @mswjs/socket.io-binding.
 * Transporte: apenas "websocket" (o binding não implementa long-polling). Sem namespaces/rooms:
 * o roteamento por usuário é feito aqui, pelo token enviado na query do handshake.
 */
type Conn = { userId: string | null; io: ReturnType<typeof toSocketIo>; close: () => void; ping: number }
const conns = new Set<Conn>()
const history: (NftUpdatedEvent | OrderUpdatedEvent)[] = []

export const realtime = ws.link(`${SOCKET_URL}/socket.io/*`)

export const socketHandler = realtime.addEventListener('connection', (connection) => {
  const token = new URL(connection.client.url).searchParams.get('token')
  const session = token ? db.state.sessions[token] : undefined
  const userId = session && session.expiresAt > Date.now() ? session.userId : null
  const io = toSocketIo(connection)
  // Heartbeat engine.io ("2" = ping) para o cliente não derrubar a conexão por pingTimeout.
  const ping = window.setInterval(() => connection.client.send('2'), 20_000)
  const conn: Conn = { userId, io, ping, close: () => connection.client.close() }
  conns.add(conn)
  connection.client.addEventListener('close', () => { window.clearInterval(ping); conns.delete(conn) })
})

function nextId() { db.state.eventSeq += 1; persist(); return `evt-${db.state.eventSeq}` }

export function emitNftUpdated(nft: Nft) {
  const event: NftUpdatedEvent = { eventId: nextId(), type: 'nft.updated', resource: { type: 'nft', id: nft.id }, version: nft.version, data: structuredClone(nft), emittedAt: new Date().toISOString() }
  history.push(event)
  conns.forEach((c) => c.io.client.emit('nft.updated', event))
}
export function emitOrderUpdated(order: Order & { userId: string }) {
  const { userId, ...publicOrder } = order as Order & { userId: string; settleAt?: number; idemKey?: string; bodyHash?: string }
  delete (publicOrder as Record<string, unknown>).settleAt
  delete (publicOrder as Record<string, unknown>).idemKey
  delete (publicOrder as Record<string, unknown>).bodyHash
  const event: OrderUpdatedEvent = { eventId: nextId(), type: 'order.updated', resource: { type: 'order', id: order.id }, version: order.version, userId, data: publicOrder, emittedAt: new Date().toISOString() }
  history.push(event)
  // Isolamento: eventos de pedido só vão para conexões do dono.
  conns.forEach((c) => { if (c.userId === userId) c.io.client.emit('order.updated', event) })
}

/** Reemite o último evento (duplicado) ou um evento antigo com versão inferior (stale). */
export function replay(mode: 'duplicate' | 'stale') {
  const last = history.filter((e) => e.type === 'nft.updated').at(-1) as NftUpdatedEvent | undefined
  if (!last) return false
  const event: NftUpdatedEvent = mode === 'duplicate' ? last
    : { ...last, eventId: `evt-stale-${last.eventId}`, version: last.version - 1, data: { ...last.data, version: last.version - 1, editions: last.data.editions.map((e) => ({ ...e, priceEth: '999.00' })), priceEth: '999.00' } }
  conns.forEach((c) => c.io.client.emit('nft.updated', event))
  return true
}
export function disconnectAll() { conns.forEach((c) => c.close()) }
export function dropUserConnections(userId: string) { conns.forEach((c) => { if (c.userId === userId) c.close() }) }
