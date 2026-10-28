import Decimal from 'decimal.js'
import type { Cart, CartItem, Network, Nft, Order, Quote, QuoteLine, User, Wallet } from '@/api/types'
import { buildNfts, coupons, networkFees, seedUsers, seedWallets, SEED_PASSWORD, type DbUser } from './fixtures'

/** Estado único do servidor simulado. Tudo que REST e Socket.IO expõem sai daqui. */
export type DbOrder = Order & { userId: string; settleAt: number; idemKey: string; bodyHash: string }
export interface DbState {
  nfts: Nft[]
  users: DbUser[]
  sessions: Record<string, { userId: string; expiresAt: number }>
  favorites: Record<string, string[]>
  carts: Record<string, CartItem[]> // chave: user:<id> ou guest:<cartId>
  wallets: Record<string, Wallet[]>
  quotes: Record<string, Quote & { cartKey: string; couponCode: string | null }>
  orders: Record<string, DbOrder>
  idempotency: Record<string, string> // userId:key -> orderId
  eventSeq: number
  firstHits: Record<string, boolean>
}
const KEY = 'nft-mock-db-v2'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 8

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
export function recalc(nft: Nft) {
  // Preço de vitrine acompanha a edição padrão (1/50); só muda quando essa edição muda.
  nft.priceEth = nft.editions.find((e) => e.id === nft.defaultEditionId)?.priceEth ?? nft.priceEth
  nft.totalAvailable = nft.editions.reduce((s, e) => s + e.available, 0)
  return nft
}
async function seed(): Promise<DbState> {
  const users: DbUser[] = []
  for (const u of seedUsers) users.push({ ...u, passwordHash: await sha256(u.salt + SEED_PASSWORD) })
  return {
    nfts: buildNfts().map(recalc), users, sessions: {}, favorites: { 'user-ana': ['nft-2', 'nft-5'] },
    carts: {}, wallets: structuredClone(seedWallets), quotes: {}, orders: {}, idempotency: {},
    eventSeq: 0, firstHits: {},
  }
}
export const db = { state: null as unknown as DbState }
export async function loadDb() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { db.state = JSON.parse(raw); return }
  } catch { /* corrompido: reseed */ }
  await resetDb()
}
export async function resetDb() { db.state = await seed(); persist() }
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(db.state)) } catch { /* quota */ } }

export const uid = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`
export const publicUser = (u: DbUser): User => ({ id: u.id, name: u.name, username: u.username, email: u.email, ensName: u.ensName, walletNickname: u.walletNickname, avatarUrl: u.avatarUrl })
export const findNft = (id: string) => db.state.nfts.find((n) => n.id === id)

export function hydrateCart(key: string, id: string): Cart {
  const items = (db.state.carts[key] ?? []).flatMap((it): CartItem[] => {
    const nft = findNft(it.nftId)
    const ed = nft?.editions.find((e) => e.id === it.editionId)
    if (!nft || !ed) return []
    return [{
      nftId: it.nftId, editionId: it.editionId, quantity: it.quantity, name: nft.name, tokenId: nft.tokenId, image: nft.thumb, editionLabel: ed.label,
      unitPriceEth: ed.priceEth, available: ed.available, maxPerOrder: ed.maxPerOrder, nftVersion: nft.version,
      previousPriceEth: it.unitPriceEth !== ed.priceEth ? it.unitPriceEth : undefined,
    }]
  })
  return { id, items, updatedAt: new Date().toISOString() }
}

export type CouponError = 'COUPON_INVALID' | 'COUPON_EXPIRED'
export function computeQuote(cartKey: string, network: Network, couponCode: string | null): { quote: Quote; couponError?: CouponError } {
  const issues: string[] = []
  const lines: QuoteLine[] = (db.state.carts[cartKey] ?? []).flatMap((it) => {
    const nft = findNft(it.nftId)
    const ed = nft?.editions.find((e) => e.id === it.editionId)
    if (!nft || !ed) return []
    let issue: QuoteLine['issue']
    if (ed.available === 0) { issue = 'SOLD_OUT'; issues.push(`${nft.name} (${ed.label}) esgotou.`) }
    else if (it.quantity > ed.available) { issue = 'INSUFFICIENT'; issues.push(`${nft.name} (${ed.label}) tem apenas ${ed.available} disponível(is).`) }
    if (it.unitPriceEth !== ed.priceEth) {
      issue = issue ?? 'PRICE_CHANGED'
      issues.push(`Preço de ${nft.name} mudou de ${it.unitPriceEth} para ${ed.priceEth} ETH.`)
    }
    return [{ nftId: nft.id, editionId: ed.id, name: nft.name, tokenId: nft.tokenId, editionLabel: ed.label, image: nft.thumb, quantity: it.quantity, unitPriceEth: ed.priceEth, lineTotalEth: new Decimal(ed.priceEth).mul(it.quantity).toFixed(), available: ed.available, issue }]
  })
  const subtotal = lines.reduce((s, l) => s.add(l.lineTotalEth), new Decimal(0))
  let discount = new Decimal(0)
  let couponError: CouponError | undefined
  let coupon: Quote['coupon'] = null
  if (couponCode) {
    const c = coupons[couponCode.toUpperCase()]
    if (!c) couponError = 'COUPON_INVALID'
    else if (new Date(c.expiresAt).getTime() < Date.now()) couponError = 'COUPON_EXPIRED'
    else {
      discount = c.kind === 'percent' ? subtotal.mul(c.value).div(100) : Decimal.min(new Decimal(c.value), subtotal)
      coupon = { code: couponCode.toUpperCase(), description: c.description }
    }
  }
  const fee = lines.length ? new Decimal(networkFees[network]) : new Decimal(0)
  const now = Date.now()
  const quote: Quote = {
    id: uid('quote'), network, lines,
    subtotalEth: subtotal.toFixed(), discountEth: discount.toDecimalPlaces(8).toFixed(), networkFeeEth: fee.toFixed(),
    totalEth: subtotal.sub(discount.toDecimalPlaces(8)).add(fee).toFixed(), coupon, issues,
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 10 * 60_000).toISOString(),
  }
  return { quote, couponError }
}
/** Assinatura dos valores relevantes para confirmar: muda se preço, estoque, cupom ou taxa mudarem. */
export const quoteSignature = (q: Quote) =>
  JSON.stringify([q.network, q.totalEth, q.coupon?.code ?? null, q.lines.map((l) => [l.editionId, l.quantity, l.unitPriceEth, l.available >= l.quantity])])
