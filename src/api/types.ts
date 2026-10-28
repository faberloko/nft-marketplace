/** Contratos compartilhados entre MSW (servidor simulado), Axios, Query e UI. Valores ETH sempre como string decimal. */
export type Eth = string

export type ErrorCode =
  | 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'
  | 'OUT_OF_STOCK' | 'QUOTE_STALE' | 'IDEMPOTENCY_CONFLICT' | 'COUPON_INVALID' | 'COUPON_EXPIRED'
  | 'WALLET_REJECTED' | 'TRANSIENT' | 'NETWORK' | 'TIMEOUT'

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; fields?: Record<string, string>; details?: unknown }
}

/** Coleções exatamente como no Figma (filtro lateral "Coleções"). */
export type Category = 'arte-digital' | 'fotografia' | 'musica' | 'arte-3d' | 'colecionaveis' | 'generativa' | 'jogos' | 'assinaturas' | 'utilidade'
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'arte-digital', label: 'Arte digital' }, { value: 'fotografia', label: 'Fotografia' },
  { value: 'musica', label: 'Música' }, { value: 'arte-3d', label: 'Arte 3D' },
  { value: 'colecionaveis', label: 'Colecionáveis' }, { value: 'generativa', label: 'Generativa' },
  { value: 'jogos', label: 'Jogos' }, { value: 'assinaturas', label: 'Assinaturas' },
  { value: 'utilidade', label: 'Utilidade' },
]
export type Network = 'ethereum' | 'polygon' | 'solana'
export const NETWORKS: { value: Network; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' }, { value: 'polygon', label: 'Polygon' }, { value: 'solana', label: 'Solana' },
]

export interface Artist { id: string; name: string; avatar: string }
/** Edições do Figma: 1/1, 1/10, 1/50 e ABERTA. */
export interface Edition { id: string; label: string; priceEth: Eth; available: number; maxPerOrder: number }
export interface Nft {
  id: string; tokenId: string; name: string; description: string; details: string[]
  collection: string; attributes: string[]; category: Category; network: Network; artist: Artist
  image: string; thumb: string; gallery: string[]; createdAt: string; featured: boolean
  badge: 'RARO' | null; rating: number; reviews: number
  editions: Edition[]
  /** Preço de vitrine (edição padrão 1/50) e preço anterior riscado, quando houver. */
  priceEth: Eth; compareAtEth: Eth | null
  defaultEditionId: string; totalAvailable: number; likes: number; sales: number; version: number
}
export type NftSort = 'recent' | 'price_asc' | 'price_desc' | 'popular'
/** Abas do catálogo: Todos os NFTs, Novos lançamentos, Em alta. */
export type NftTab = 'todos' | 'novos' | 'em-alta'
export interface NftListParams {
  q?: string; category?: Category[]; network?: Network[]; minPrice?: string; maxPrice?: string
  availability?: 'available' | 'soldout'; tab?: NftTab; sort?: NftSort; page?: number; pageSize?: number
}
export interface Facets { categories: Record<Category, number>; networks: Record<Network, number>; priceRange: { min: Eth; max: Eth } }
export interface Paginated<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
export type NftPage = Paginated<Nft> & { facets: Facets }

export interface User {
  id: string; name: string; username: string; email: string; ensName: string; walletNickname: string; avatarUrl: string | null
}
export interface Session { user: User; token: string; expiresAt: string }

export interface CartItem {
  nftId: string; editionId: string; quantity: number
  name: string; tokenId: string; image: string; editionLabel: string; unitPriceEth: Eth; available: number; maxPerOrder: number
  nftVersion: number
  /** Preço aceito pelo usuário quando diferente do atual (alteração ainda não reconhecida). */
  previousPriceEth?: Eth
}
export interface Cart { id: string; items: CartItem[]; updatedAt: string }

export interface QuoteLine {
  nftId: string; editionId: string; name: string; tokenId: string; editionLabel: string; image: string
  quantity: number; unitPriceEth: Eth; lineTotalEth: Eth; available: number; issue?: 'PRICE_CHANGED' | 'INSUFFICIENT' | 'SOLD_OUT'
}
export interface Quote {
  id: string; network: Network; lines: QuoteLine[]
  subtotalEth: Eth; discountEth: Eth; networkFeeEth: Eth; totalEth: Eth
  coupon: { code: string; description: string } | null
  issues: string[]; createdAt: string; expiresAt: string
}

export type WalletKind = 'primary' | 'secondary'
export type WalletProvider = 'metamask' | 'coinbase' | 'walletconnect'
export const WALLET_PROVIDERS: { value: WalletProvider; label: string }[] = [
  { value: 'walletconnect', label: 'WalletConnect' }, { value: 'metamask', label: 'MetaMask' }, { value: 'coinbase', label: 'Coinbase Wallet' },
]

/** Dados do colecionador enviados no pagamento (campos do frame "Pagamento"). */
export interface Collector {
  displayName: string; username: string; profileName: string; email: string; ensName: string
  referralCode: string; note: string
}
export type OrderStatus = 'pending' | 'confirmed' | 'declined'
export interface Order {
  id: string; status: OrderStatus; createdAt: string; settledAt: string | null; version: number
  quote: Quote; walletAddress: string; walletProvider: WalletProvider; network: Network
  collector: Collector
  txHash: string | null; explorerUrl: string | null; declineReason: string | null
}
export interface CreateOrderBody {
  quoteId: string; walletId: string; network: Network; provider: WalletProvider; collector: Collector
}

/** Carteira com os campos do frame "Carteiras". */
export interface Wallet {
  id: string; kind: WalletKind; displayName: string; nickname: string; network: Network; profileName: string
  address: string; secondaryAddress: string; provider: WalletProvider; referralCode: string; email: string; ensName: string
  updatedAt: string
}
export type WalletInput = Omit<Wallet, 'id' | 'updatedAt'>

/** Envelope de eventos Socket.IO: identidade estável, recurso afetado, versão monotônica do recurso. */
export interface RealtimeEvent<T extends string, R extends string, D> {
  eventId: string; type: T; resource: { type: R; id: string }; version: number; userId?: string; data: D; emittedAt: string
}
export type NftUpdatedEvent = RealtimeEvent<'nft.updated', 'nft', Nft>
export type OrderUpdatedEvent = RealtimeEvent<'order.updated', 'order', Order>
