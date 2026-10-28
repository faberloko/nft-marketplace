import { delay, http, HttpResponse, type DefaultBodyType, type StrictRequest } from 'msw'
import Decimal from 'decimal.js'
import { CATEGORIES, NETWORKS, WALLET_PROVIDERS, type ApiErrorBody, type Category, type CreateOrderBody, type ErrorCode, type Facets, type Network, type Nft, type NftSort, type NftTab, type WalletInput, type Wallet, type Collector } from '@/api/types'
import { API_URL } from '@/lib/env'
import { computeQuote, db, findNft, hydrateCart, persist, publicUser, quoteSignature, recalc, resetDb, sha256, SESSION_TTL_MS, uid, type DbOrder } from './db'
import { active, has, resetSeed, seededRandom, setScenarios, SCENARIOS } from './scenarios'
import { disconnectAll, dropUserConnections, emitNftUpdated, emitOrderUpdated, replay } from './socket'

const api = (p: string) => `${API_URL}${p}`
const fail = (status: number, code: ErrorCode, message: string, fields?: Record<string, string>, details?: unknown) =>
  HttpResponse.json<ApiErrorBody>({ error: { code, message, fields, details } }, { status })

/** Condições de rede simuladas antes de cada handler de negócio. */
async function network(route: string, opts: { catalog?: boolean; q?: string } = {}): Promise<Response | null> {
  if (has('offline')) return HttpResponse.error()
  let ms = 0
  if (has('instant')) ms = 0
  else if (has('slow')) ms = 2500
  else if (has('variable')) ms = 100 + Math.round(seededRandom() * 1900)
  else ms = 120 + Math.round(seededRandom() * 180)
  // Determinístico: buscas com termo de tamanho ímpar respondem depois das de tamanho par.
  if (opts.catalog && has('out-of-order')) ms = (opts.q?.length ?? 0) % 2 === 1 ? 1800 : 150
  if (ms) await delay(ms)
  if (has('flaky') && !db.state.firstHits[route]) {
    db.state.firstHits[route] = true; persist()
    return fail(503, 'TRANSIENT', 'Serviço temporariamente indisponível. Tente novamente.')
  }
  if (opts.catalog && has('server-error')) return fail(500, 'TRANSIENT', 'Erro interno ao consultar o catálogo.')
  return null
}

function auth(request: StrictRequest<DefaultBodyType>) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  const s = token ? db.state.sessions[token] : undefined
  if (!token || !s) return { error: fail(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.') }
  if (s.expiresAt < Date.now()) return { error: fail(401, 'UNAUTHENTICATED', 'Sua sessão expirou. Entre novamente.') }
  const user = db.state.users.find((u) => u.id === s.userId)!
  return { user, token }
}
function cartKey(request: StrictRequest<DefaultBodyType>) {
  const a = auth(request)
  if (a.user) return { key: `user:${a.user.id}`, id: a.user.id, userId: a.user.id }
  const guest = request.headers.get('x-cart-id')
  return guest ? { key: `guest:${guest}`, id: guest, userId: null } : null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ENS = /^[a-z0-9-]{3,30}$/
/** Campos obrigatórios do frame "Pagamento" (Observação é opcional). */
function collectorIssues(c: Partial<Collector> | undefined) {
  const f: Record<string, string> = {}
  if (!c?.displayName?.trim()) f.displayName = 'Informe o nome de exibição.'
  if (!c?.username || !/^[a-z0-9_]{3,20}$/.test(c.username)) f.username = 'Use 3–20 letras minúsculas, números ou _.'
  if (!c?.profileName?.trim()) f.profileName = 'Informe o nome do perfil.'
  if (!c?.email || !EMAIL.test(c.email)) f.email = 'E-mail inválido.'
  if (!c?.ensName || !ENS.test(c.ensName)) f.ensName = 'Use 3–30 letras minúsculas, números ou hífen.'
  if (!c?.referralCode?.trim()) f.referralCode = 'Informe o código de indicação.'
  if (c?.note && c.note.length > 500) f.note = 'Máximo de 500 caracteres.'
  return f
}
function passwordIssue(p: string) {
  if (!p || p.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Z]/.test(p) || !/\d/.test(p)) return 'Use ao menos uma letra maiúscula e um número.'
  return null
}

async function createSession(userId: string, guestCartId: string | null) {
  const token = `tok-${crypto.randomUUID()}`
  const expiresAt = Date.now() + SESSION_TTL_MS
  db.state.sessions[token] = { userId, expiresAt }
  // Preserva os itens do visitante ao autenticar (merge respeitando limite e disponibilidade).
  if (guestCartId) {
    const guest = db.state.carts[`guest:${guestCartId}`] ?? []
    const mine = (db.state.carts[`user:${userId}`] ??= [])
    for (const g of guest) {
      const ed = findNft(g.nftId)?.editions.find((e) => e.id === g.editionId)
      if (!ed) continue
      const ex = mine.find((m) => m.editionId === g.editionId)
      const cap = Math.min(ed.available, ed.maxPerOrder)
      if (ex) ex.quantity = Math.min(cap, ex.quantity + g.quantity)
      else mine.push({ ...g, quantity: Math.min(cap, g.quantity) })
    }
    delete db.state.carts[`guest:${guestCartId}`]
  }
  persist()
  const user = db.state.users.find((u) => u.id === userId)!
  return { user: publicUser(user), token, expiresAt: new Date(expiresAt).toISOString() }
}

/**
 * Filtra e ordena o catálogo. As contagens (facets) de coleção e rede consideram os demais filtros,
 * mas não o próprio filtro de coleção/rede — como nos marketplaces reais.
 */
function filterNfts(url: URL): { list: Nft[]; facets: Facets } {
  const q = url.searchParams.get('q')?.trim().toLowerCase()
  const cats = url.searchParams.get('category')?.split(',').filter(Boolean) as Category[] | undefined
  const nets = url.searchParams.get('network')?.split(',').filter(Boolean) as Network[] | undefined
  const min = url.searchParams.get('minPrice'); const max = url.searchParams.get('maxPrice')
  const availability = url.searchParams.get('availability')
  const tab = (url.searchParams.get('tab') ?? 'todos') as NftTab
  const sort = (url.searchParams.get('sort') ?? 'recent') as NftSort
  const all = has('empty') ? [] : db.state.nfts
  const newest = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12).map((n) => n.id)
  const base = all.filter((n) => {
    if (q && !`${n.name} ${n.collection} ${n.artist.name} ${n.attributes.join(' ')}`.toLowerCase().includes(q)) return false
    if (min && new Decimal(n.priceEth).lt(min)) return false
    if (max && new Decimal(n.priceEth).gt(max)) return false
    if (availability === 'available' && n.totalAvailable === 0) return false
    if (availability === 'soldout' && n.totalAvailable > 0) return false
    if (tab === 'novos' && !newest.includes(n.id)) return false
    if (tab === 'em-alta' && n.sales < 60) return false
    return true
  })
  const byCat = base.filter((n) => !nets?.length || nets.includes(n.network))
  const byNet = base.filter((n) => !cats?.length || cats.includes(n.category))
  const facets: Facets = {
    categories: Object.fromEntries(CATEGORIES.map((c) => [c.value, byCat.filter((n) => n.category === c.value).length])) as Facets['categories'],
    networks: Object.fromEntries(NETWORKS.map((c) => [c.value, byNet.filter((n) => n.network === c.value).length])) as Facets['networks'],
    priceRange: {
      min: all.length ? Decimal.min(...all.map((n) => new Decimal(n.priceEth))).toFixed(2) : '0',
      max: all.length ? Decimal.max(...all.map((n) => new Decimal(n.priceEth))).toFixed(2) : '0',
    },
  }
  const cmp: Record<NftSort, (a: Nft, b: Nft) => number> = {
    recent: (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    price_asc: (a, b) => new Decimal(a.priceEth).cmp(b.priceEth) || a.id.localeCompare(b.id),
    price_desc: (a, b) => new Decimal(b.priceEth).cmp(a.priceEth) || a.id.localeCompare(b.id),
    popular: (a, b) => b.sales - a.sales || a.id.localeCompare(b.id),
  }
  const list = base.filter((n) => (!cats?.length || cats.includes(n.category)) && (!nets?.length || nets.includes(n.network)))
  return { list: list.sort(cmp[sort] ?? cmp.recent), facets }
}

/** Mudança de catálogo: altera DB, incrementa versão e emite nft.updated (REST e evento refletem o mesmo estado). */
function mutateNft(nftId: string, change: { editionId?: string; priceEth?: string; available?: number }) {
  const nft = findNft(nftId)
  if (!nft) return null
  const ed = nft.editions.find((e) => e.id === change.editionId) ?? nft.editions[0]
  if (change.priceEth !== undefined) ed.priceEth = new Decimal(change.priceEth).toFixed(2)
  if (change.available !== undefined) ed.available = Math.max(0, change.available)
  nft.version += 1
  recalc(nft); persist(); emitNftUpdated(nft)
  return nft
}

function settle(order: DbOrder) {
  if (order.status !== 'pending') return
  const cartK = `user:${order.userId}`
  let declineReason: string | null = has('payment-declined') ? 'Pagamento recusado pela carteira (saldo insuficiente na simulação).' : null
  if (!declineReason) {
    for (const l of order.quote.lines) {
      const ed = findNft(l.nftId)?.editions.find((e) => e.id === l.editionId)
      if (!ed || ed.available < l.quantity) { declineReason = `${l.name} não tem mais disponibilidade.`; break }
    }
  }
  order.settledAt = new Date().toISOString()
  order.version += 1
  if (declineReason) {
    order.status = 'declined'; order.declineReason = declineReason
  } else {
    order.status = 'confirmed'
    order.txHash = `0x${(order.id + 'abcdef0123456789').repeat(4).replace(/[^a-f0-9]/g, '').slice(0, 64).padEnd(64, '0')}`
    order.explorerUrl = `https://etherscan.io/tx/${order.txHash}?simulated=1`
    const cart = db.state.carts[cartK] ?? []
    for (const l of order.quote.lines) {
      const nft = findNft(l.nftId)!
      const ed = nft.editions.find((e) => e.id === l.editionId)!
      ed.available -= l.quantity; nft.version += 1; recalc(nft); emitNftUpdated(nft)
      // Remove do carrinho apenas a quantidade comprada.
      const item = cart.find((c) => c.editionId === l.editionId)
      if (item) item.quantity -= l.quantity
    }
    db.state.carts[cartK] = cart.filter((c) => c.quantity > 0)
  }
  persist(); emitOrderUpdated(order)
}
export function settleDueOrders() {
  if (!db.state) return
  Object.values(db.state.orders).forEach((o) => { if (o.status === 'pending' && o.settleAt <= Date.now()) settle(o) })
}
const publicOrder = (o: DbOrder) => {
  const { userId: _u, settleAt: _s, idemKey: _i, bodyHash: _b, ...rest } = o
  return rest
}

export const handlers = [
  // ---------- Controle dos mocks (cenários, reset, eventos) ----------
  http.get(api('/__mock/scenarios'), () => HttpResponse.json({ available: SCENARIOS, active: [...active.set] })),
  http.post(api('/__mock/scenarios'), async ({ request }) => {
    const { names } = (await request.json()) as { names: string[] }
    setScenarios(names); return HttpResponse.json({ active: [...active.set] })
  }),
  http.post(api('/__mock/reset'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { scenarios?: string[] }
    await resetDb(); resetSeed(); setScenarios(body.scenarios ?? ['default']); disconnectAll()
    return HttpResponse.json({ ok: true })
  }),
  http.post(api('/__mock/expire-sessions'), () => {
    Object.values(db.state.sessions).forEach((s) => { s.expiresAt = 0 }); persist()
    return HttpResponse.json({ ok: true })
  }),
  http.post(api('/__mock/nft-update'), async ({ request }) => {
    const body = (await request.json()) as { nftId: string; editionId?: string; priceEth?: string; available?: number }
    const nft = mutateNft(body.nftId, body)
    return nft ? HttpResponse.json(nft) : fail(404, 'NOT_FOUND', 'NFT não encontrado.')
  }),
  http.post(api('/__mock/replay'), async ({ request }) => {
    const { mode } = (await request.json()) as { mode: 'duplicate' | 'stale' }
    return HttpResponse.json({ ok: replay(mode) })
  }),
  http.post(api('/__mock/disconnect'), () => { disconnectAll(); return HttpResponse.json({ ok: true }) }),
  http.post(api('/__mock/settle'), () => {
    Object.values(db.state.orders).forEach((o) => { if (o.status === 'pending') settle(o) })
    return HttpResponse.json({ ok: true })
  }),

  // ---------- Sessão e conta ----------
  http.post(api('/auth/signup'), async ({ request }) => {
    const r = await network('signup'); if (r) return r
    const b = (await request.json()) as { name?: string; email?: string; username?: string; password?: string }
    const fields: Record<string, string> = {}
    if (!b.username || !/^[a-z0-9_]{3,20}$/.test(b.username)) fields.username = 'Use 3–20 letras minúsculas, números ou _.'
    if (!b.email || !EMAIL.test(b.email)) fields.email = 'E-mail inválido.'
    const pw = passwordIssue(b.password ?? ''); if (pw) fields.password = pw
    if (Object.keys(fields).length) return fail(422, 'VALIDATION', 'Revise os campos destacados.', fields)
    const conflicts: Record<string, string> = {}
    if (db.state.users.some((u) => u.email.toLowerCase() === b.email!.toLowerCase())) conflicts.email = 'Este e-mail já está cadastrado.'
    if (db.state.users.some((u) => u.username === b.username)) conflicts.username = 'Este usuário já existe.'
    if (Object.keys(conflicts).length) return fail(409, 'CONFLICT', 'Conta já existente.', conflicts)
    const salt = crypto.randomUUID()
    const id = uid('user')
    db.state.users.push({ id, name: b.name?.trim() || b.username!, username: b.username!, email: b.email!.toLowerCase(), ensName: '', walletNickname: '', avatarUrl: null, salt, passwordHash: await sha256(salt + b.password) })
    db.state.wallets[id] = []
    return HttpResponse.json(await createSession(id, request.headers.get('x-cart-id')), { status: 201 })
  }),
  http.post(api('/auth/login'), async ({ request }) => {
    const r = await network('login'); if (r) return r
    const b = (await request.json()) as { email?: string; password?: string }
    const fields: Record<string, string> = {}
    if (!b.email || !EMAIL.test(b.email)) fields.email = 'E-mail inválido.'
    if (!b.password) fields.password = 'Informe a senha.'
    if (Object.keys(fields).length) return fail(422, 'VALIDATION', 'Revise os campos destacados.', fields)
    const user = db.state.users.find((u) => u.email === b.email!.toLowerCase())
    if (!user || (await sha256(user.salt + b.password)) !== user.passwordHash) return fail(401, 'UNAUTHENTICATED', 'E-mail ou senha incorretos.')
    return HttpResponse.json(await createSession(user.id, request.headers.get('x-cart-id')))
  }),
  http.get(api('/session'), async ({ request }) => {
    const r = await network('session'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    const s = db.state.sessions[a.token]
    return HttpResponse.json({ user: publicUser(a.user), token: a.token, expiresAt: new Date(s.expiresAt).toISOString() })
  }),
  http.post(api('/auth/logout'), ({ request }) => {
    const a = auth(request)
    if (a.token) { delete db.state.sessions[a.token]; persist(); if (a.user) dropUserConnections(a.user.id) }
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------- NFTs ----------
  http.get(api('/nfts'), async ({ request }) => {
    const r = await network('nfts', { catalog: true, q: new URL(request.url).searchParams.get('q') ?? '' }); if (r) return r
    const url = new URL(request.url)
    const { list, facets } = filterNfts(url)
    const pageSize = Math.min(48, Math.max(1, Number(url.searchParams.get('pageSize') ?? 9)))
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
    const page = Math.min(totalPages, Math.max(1, Number(url.searchParams.get('page') ?? 1)))
    return HttpResponse.json({ items: list.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: list.length, totalPages, facets })
  }),
  http.get(api('/nfts/featured'), async () => {
    const r = await network('featured', { catalog: true }); if (r) return r
    return HttpResponse.json(has('empty') ? [] : db.state.nfts.filter((n) => n.featured))
  }),
  http.get(api('/nfts/:id'), async ({ params }) => {
    const r = await network('nft', { catalog: true }); if (r) return r
    const nft = findNft(String(params.id))
    return nft ? HttpResponse.json(nft) : fail(404, 'NOT_FOUND', 'NFT não encontrado.')
  }),

  // ---------- Favoritos ----------
  http.get(api('/favorites'), async ({ request }) => {
    const r = await network('favorites'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    return HttpResponse.json(db.state.favorites[a.user.id] ?? [])
  }),
  ...(['put', 'delete'] as const).map((method) => http[method](api('/favorites/:nftId'), async ({ request, params }) => {
    const r = await network('favorite-mut'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    if (has('favorite-fail')) return fail(500, 'TRANSIENT', 'Não foi possível atualizar os favoritos.')
    const nft = findNft(String(params.nftId)); if (!nft) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
    const list = new Set(db.state.favorites[a.user.id] ?? [])
    const had = list.has(nft.id)
    if (method === 'put' && !had) { list.add(nft.id); nft.likes += 1 }
    if (method === 'delete' && had) { list.delete(nft.id); nft.likes -= 1 }
    db.state.favorites[a.user.id] = [...list]; persist()
    return HttpResponse.json([...list])
  })),

  // ---------- Carrinho ----------
  http.get(api('/cart'), async ({ request }) => {
    const r = await network('cart'); if (r) return r
    const c = cartKey(request); if (!c) return HttpResponse.json({ id: 'none', items: [], updatedAt: new Date().toISOString() })
    return HttpResponse.json(hydrateCart(c.key, c.id))
  }),
  http.post(api('/cart/items'), async ({ request }) => {
    const r = await network('cart-add'); if (r) return r
    const c = cartKey(request); if (!c) return fail(422, 'VALIDATION', 'Carrinho não identificado.')
    const b = (await request.json()) as { nftId: string; editionId: string; quantity: number }
    const nft = findNft(b.nftId); const ed = nft?.editions.find((e) => e.id === b.editionId)
    if (!nft || !ed) return fail(404, 'NOT_FOUND', 'Edição não encontrada.')
    if (!Number.isInteger(b.quantity) || b.quantity < 1) return fail(422, 'VALIDATION', 'Quantidade inválida.', { quantity: 'Quantidade deve ser um inteiro ≥ 1.' })
    const items = (db.state.carts[c.key] ??= [])
    const ex = items.find((i) => i.editionId === ed.id)
    const nextQty = (ex?.quantity ?? 0) + b.quantity
    const cap = Math.min(ed.available, ed.maxPerOrder)
    if (ed.available === 0) return fail(409, 'OUT_OF_STOCK', 'Edição esgotada.')
    if (nextQty > cap) return fail(409, 'OUT_OF_STOCK', `Limite de ${cap} unidade(s) para esta edição.`, { quantity: `Máximo ${cap}.` }, { max: cap })
    if (ex) { ex.quantity = nextQty; ex.unitPriceEth = ed.priceEth }
    else items.push({ nftId: nft.id, editionId: ed.id, quantity: b.quantity, unitPriceEth: ed.priceEth } as never)
    persist()
    return HttpResponse.json(hydrateCart(c.key, c.id), { status: 201 })
  }),
  http.patch(api('/cart/items/:editionId'), async ({ request, params }) => {
    const r = await network('cart-update'); if (r) return r
    const c = cartKey(request); if (!c) return fail(422, 'VALIDATION', 'Carrinho não identificado.')
    const { quantity } = (await request.json()) as { quantity: number }
    const item = db.state.carts[c.key]?.find((i) => i.editionId === params.editionId)
    if (!item) return fail(404, 'NOT_FOUND', 'Item não está no carrinho.')
    const ed = findNft(item.nftId)!.editions.find((e) => e.id === item.editionId)!
    const cap = Math.min(ed.available, ed.maxPerOrder)
    if (!Number.isInteger(quantity) || quantity < 1) return fail(422, 'VALIDATION', 'Quantidade inválida.')
    if (quantity > cap) return fail(409, 'OUT_OF_STOCK', `Limite de ${cap} unidade(s) para esta edição.`, undefined, { max: cap })
    item.quantity = quantity; persist()
    return HttpResponse.json(hydrateCart(c.key, c.id))
  }),
  http.delete(api('/cart/items/:editionId'), async ({ request, params }) => {
    const r = await network('cart-remove'); if (r) return r
    const c = cartKey(request); if (!c) return fail(422, 'VALIDATION', 'Carrinho não identificado.')
    db.state.carts[c.key] = (db.state.carts[c.key] ?? []).filter((i) => i.editionId !== params.editionId); persist()
    return HttpResponse.json(hydrateCart(c.key, c.id))
  }),
  /** Usuário reconhece preços/disponibilidade atuais: fixa preço aceito e reduz quantidades ao disponível. */
  http.post(api('/cart/acknowledge'), async ({ request }) => {
    const r = await network('cart-ack'); if (r) return r
    const c = cartKey(request); if (!c) return fail(422, 'VALIDATION', 'Carrinho não identificado.')
    db.state.carts[c.key] = (db.state.carts[c.key] ?? []).flatMap((it) => {
      const ed = findNft(it.nftId)?.editions.find((e) => e.id === it.editionId)
      if (!ed || ed.available === 0) return []
      return [{ ...it, unitPriceEth: ed.priceEth, quantity: Math.min(it.quantity, ed.available, ed.maxPerOrder) }]
    })
    persist()
    return HttpResponse.json(hydrateCart(c.key, c.id))
  }),

  // ---------- Cotação ----------
  http.post(api('/quote'), async ({ request }) => {
    const r = await network('quote'); if (r) return r
    const c = cartKey(request); if (!c) return fail(422, 'VALIDATION', 'Carrinho não identificado.')
    const b = (await request.json()) as { network?: Network; coupon?: string | null }
    const { quote, couponError } = computeQuote(c.key, b.network ?? 'ethereum', b.coupon?.trim() || null)
    if (couponError) return fail(422, couponError, couponError === 'COUPON_EXPIRED' ? 'Este cupom expirou.' : 'Cupom inválido.', { coupon: couponError === 'COUPON_EXPIRED' ? 'Cupom expirado.' : 'Cupom inválido.' })
    db.state.quotes[quote.id] = { ...quote, cartKey: c.key, couponCode: quote.coupon?.code ?? null }; persist()
    return HttpResponse.json(quote)
  }),

  // ---------- Pedidos ----------
  http.post(api('/orders'), async ({ request }) => {
    const r = await network('order-create'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    const key = request.headers.get('idempotency-key')
    if (!key) return fail(422, 'VALIDATION', 'Idempotency-Key é obrigatório.')
    const body = (await request.json()) as CreateOrderBody
    const bodyHash = JSON.stringify([body.quoteId, body.walletId, body.network, body.provider, body.collector])
    const idemKey = `${a.user.id}:${key}`
    const existingId = db.state.idempotency[idemKey]
    if (existingId) {
      const existing = db.state.orders[existingId]
      if (existing.bodyHash !== bodyHash) return fail(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      return HttpResponse.json(publicOrder(existing), { status: 200 })
    }
    const fields: Record<string, string> = {}
    Object.assign(fields, collectorIssues(body.collector))
    if (!WALLET_PROVIDERS.some((p) => p.value === body.provider)) fields.provider = 'Selecione a carteira para conectar.'
    if (!NETWORKS.some((n) => n.value === body.network)) fields.network = 'Selecione uma rede.'
    if (Object.keys(fields).length) return fail(422, 'VALIDATION', 'Revise os dados do colecionador.', fields)
    const wallet = db.state.wallets[a.user.id]?.find((w) => w.id === body.walletId)
    if (!wallet) return fail(422, 'VALIDATION', 'Selecione uma carteira cadastrada.', { walletId: 'Carteira inválida.' })
    const stored = db.state.quotes[body.quoteId]
    if (!stored || stored.cartKey !== `user:${a.user.id}`) return fail(409, 'QUOTE_STALE', 'Cotação inexistente ou expirada.', undefined, { quote: null })

    // Cenários: o catálogo muda na primeira tentativa de confirmação.
    const first = stored.lines[0]
    if (first && has('price-change-checkout') && !db.state.firstHits['price-change']) {
      db.state.firstHits['price-change'] = true
      mutateNft(first.nftId, { editionId: first.editionId, priceEth: new Decimal(first.unitPriceEth).mul('1.15').toFixed(2) })
    }
    if (first && has('sold-out-checkout') && !db.state.firstHits['sold-out']) {
      db.state.firstHits['sold-out'] = true
      mutateNft(first.nftId, { editionId: first.editionId, available: 0 })
    }
    const { quote: fresh } = computeQuote(stored.cartKey, body.network, stored.couponCode)
    if (new Date(stored.expiresAt).getTime() < Date.now() || quoteSignature(fresh) !== quoteSignature(stored) || fresh.issues.length) {
      db.state.quotes[fresh.id] = { ...fresh, cartKey: stored.cartKey, couponCode: stored.couponCode }; persist()
      const code = fresh.lines.some((l) => l.issue === 'SOLD_OUT' || l.issue === 'INSUFFICIENT') ? 'OUT_OF_STOCK' : 'QUOTE_STALE'
      return fail(409, code, 'Preço, disponibilidade ou taxas mudaram. Revise a nova cotação.', undefined, { quote: fresh })
    }
    const order: DbOrder = {
      id: uid('order'), status: 'pending', createdAt: new Date().toISOString(), settledAt: null, version: 1,
      quote: structuredClone(stored), walletAddress: wallet.address, walletProvider: body.provider, network: body.network,
      collector: { ...body.collector, email: body.collector.email.trim().toLowerCase() }, txHash: null, explorerUrl: null, declineReason: null,
      userId: a.user.id, settleAt: Date.now() + (has('instant') ? 1000 : 3000), idemKey: key, bodyHash,
    }
    delete (order.quote as Partial<typeof stored>).cartKey
    delete (order.quote as Partial<typeof stored>).couponCode
    db.state.orders[order.id] = order
    db.state.idempotency[idemKey] = order.id
    persist()
    if (has('order-timeout') && !db.state.firstHits['order-timeout']) {
      db.state.firstHits['order-timeout'] = true; persist()
      await delay(15_000) // pedido já criado; o cliente atinge timeout e reenviará com a mesma chave
    }
    return HttpResponse.json(publicOrder(order), { status: 201 })
  }),
  http.get(api('/orders'), async ({ request }) => {
    const r = await network('orders'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    settleDueOrders()
    const status = new URL(request.url).searchParams.get('status')
    const list = Object.values(db.state.orders).filter((o) => o.userId === a.user.id && (!status || o.status === status))
    return HttpResponse.json(list.map(publicOrder).sort((x, y) => y.createdAt.localeCompare(x.createdAt)))
  }),
  http.get(api('/orders/:id'), async ({ request, params }) => {
    const r = await network('order'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    settleDueOrders()
    const o = db.state.orders[String(params.id)]
    // Pedido de outro usuário responde 404 para não revelar existência.
    if (!o || o.userId !== a.user.id) return fail(404, 'NOT_FOUND', 'Pedido não encontrado.')
    return HttpResponse.json(publicOrder(o))
  }),

  // ---------- Perfil ----------
  http.get(api('/profile'), async ({ request }) => {
    const r = await network('profile'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    return HttpResponse.json(publicUser(a.user))
  }),
  http.patch(api('/profile'), async ({ request }) => {
    const r = await network('profile-update'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    const b = (await request.json()) as { name?: string; username?: string; email?: string; ensName?: string; walletNickname?: string }
    const fields: Record<string, string> = {}
    if (b.name !== undefined && !b.name.trim()) fields.name = 'Informe seu nome.'
    if (b.username !== undefined && !/^[a-z0-9_]{3,20}$/.test(b.username)) fields.username = 'Use 3–20 letras minúsculas, números ou _.'
    if (b.email !== undefined && !EMAIL.test(b.email)) fields.email = 'E-mail inválido.'
    if (b.ensName !== undefined && !ENS.test(b.ensName)) fields.ensName = 'Use 3–30 letras minúsculas, números ou hífen.'
    if (b.walletNickname !== undefined && !b.walletNickname.trim()) fields.walletNickname = 'Informe um apelido para a carteira.'
    if (Object.keys(fields).length) return fail(422, 'VALIDATION', 'Revise os campos destacados.', fields)
    if (b.email && db.state.users.some((u) => u.id !== a.user.id && u.email === b.email!.toLowerCase())) return fail(409, 'CONFLICT', 'E-mail em uso.', { email: 'Este e-mail já está em uso.' })
    if (b.username && db.state.users.some((u) => u.id !== a.user.id && u.username === b.username)) return fail(409, 'CONFLICT', 'Usuário em uso.', { username: 'Este usuário já existe.' })
    Object.assign(a.user, { ...b, email: b.email?.toLowerCase() ?? a.user.email, name: b.name?.trim() ?? a.user.name }); persist()
    return HttpResponse.json(publicUser(a.user))
  }),
  http.post(api('/profile/avatar'), async ({ request }) => {
    const r = await network('avatar'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    const { dataUrl } = (await request.json()) as { dataUrl?: string }
    if (!dataUrl?.startsWith('data:image/')) return fail(422, 'VALIDATION', 'Envie uma imagem PNG, JPG ou WebP.', { avatar: 'Formato inválido.' })
    if (dataUrl.length > 400_000) return fail(422, 'VALIDATION', 'Imagem muito grande.', { avatar: 'Máximo de ~300 KB após o redimensionamento.' })
    a.user.avatarUrl = dataUrl; persist()
    return HttpResponse.json(publicUser(a.user))
  }),
  http.delete(api('/profile/avatar'), async ({ request }) => {
    const r = await network('avatar'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    a.user.avatarUrl = null; persist()
    return HttpResponse.json(publicUser(a.user))
  }),
  http.post(api('/profile/password'), async ({ request }) => {
    const r = await network('password'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    const b = (await request.json()) as { currentPassword?: string; newPassword?: string }
    if ((await sha256(a.user.salt + (b.currentPassword ?? ''))) !== a.user.passwordHash) return fail(422, 'VALIDATION', 'Senha atual incorreta.', { currentPassword: 'Senha atual incorreta.' })
    const pw = passwordIssue(b.newPassword ?? ''); if (pw) return fail(422, 'VALIDATION', pw, { newPassword: pw })
    if (b.newPassword === b.currentPassword) return fail(422, 'VALIDATION', 'A nova senha deve ser diferente.', { newPassword: 'A nova senha deve ser diferente da atual.' })
    a.user.salt = crypto.randomUUID(); a.user.passwordHash = await sha256(a.user.salt + b.newPassword); persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------- Carteiras ----------
  http.get(api('/wallets'), async ({ request }) => {
    const r = await network('wallets'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    return HttpResponse.json(db.state.wallets[a.user.id] ?? [])
  }),
  ...(['post', 'patch'] as const).map((method) => http[method](api(method === 'post' ? '/wallets' : '/wallets/:id'), async ({ request, params }) => {
    const r = await network('wallet-save'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    const b = (await request.json()) as Partial<WalletInput>
    const list = (db.state.wallets[a.user.id] ??= [])
    const target = method === 'patch' ? list.find((w) => w.id === params.id) : undefined
    if (method === 'patch' && !target) return fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
    const fields: Record<string, string> = {}
    if (!b.displayName?.trim()) fields.displayName = 'Informe o nome de exibição.'
    if (!b.nickname?.trim()) fields.nickname = 'Informe um apelido para a carteira.'
    if (!b.network || !NETWORKS.some((n) => n.value === b.network)) fields.network = 'Selecione uma rede.'
    if (!b.profileName?.trim()) fields.profileName = 'Informe o nome do perfil.'
    if (!b.address || !ADDRESS.test(b.address)) fields.address = 'Endereço deve ter 0x seguido de 40 caracteres hexadecimais.'
    if (b.secondaryAddress && !ADDRESS.test(b.secondaryAddress) && !/^[a-z0-9-]+(.[a-z0-9-]+)*.eth$/.test(b.secondaryAddress)) fields.secondaryAddress = 'Use um endereço 0x ou um nome .eth.'
    if (!b.provider || !WALLET_PROVIDERS.some((p) => p.value === b.provider)) fields.provider = 'Selecione uma carteira.'
    if (!b.referralCode?.trim()) fields.referralCode = 'Informe o código de indicação.'
    if (!b.email || !EMAIL.test(b.email)) fields.email = 'E-mail inválido.'
    if (!b.ensName || !ENS.test(b.ensName)) fields.ensName = 'Use 3–30 letras minúsculas, números ou hífen.'
    if (!b.kind || !['primary', 'secondary'].includes(b.kind)) fields.kind = 'Selecione o tipo.'
    if (Object.keys(fields).length) return fail(422, 'VALIDATION', 'Revise os campos destacados.', fields)
    if (list.some((w) => w !== target && w.kind === b.kind)) return fail(409, 'CONFLICT', 'Já existe uma carteira deste tipo.', { kind: `Você já tem uma carteira ${b.kind === 'primary' ? 'principal' : 'secundária'}.` })
    if (list.some((w) => w !== target && w.address.toLowerCase() === b.address!.toLowerCase())) return fail(409, 'CONFLICT', 'Endereço já cadastrado.', { address: 'Este endereço já está cadastrado.' })
    const saved: Wallet = {
      id: target?.id ?? uid('wallet'), kind: b.kind!, displayName: b.displayName!.trim(), nickname: b.nickname!.trim(), network: b.network!,
      profileName: b.profileName!.trim(), address: b.address!, secondaryAddress: b.secondaryAddress?.trim() ?? '', provider: b.provider!,
      referralCode: b.referralCode!.trim(), email: b.email!.trim().toLowerCase(), ensName: b.ensName!, updatedAt: new Date().toISOString(),
    }
    if (target) Object.assign(target, saved); else list.push(saved)
    persist()
    return HttpResponse.json(saved, { status: target ? 200 : 201 })
  })),
  http.post(api('/wallets/:id/connect'), async ({ request, params }) => {
    const r = await network('wallet-connect'); if (r) return r
    const a = auth(request); if (a.error) return a.error
    const w = db.state.wallets[a.user.id]?.find((x) => x.id === params.id)
    if (!w) return fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
    await delay(has('instant') ? 0 : 600)
    if (has('wallet-reject')) return fail(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    const { network: net } = (await request.json()) as { network: Network }
    return HttpResponse.json({ walletId: w.id, address: w.address, network: net, connectedAt: new Date().toISOString() })
  }),

  http.all(api('/*'), () => fail(404, 'NOT_FOUND', 'Rota inexistente.')),
]
