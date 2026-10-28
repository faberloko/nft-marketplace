import { http } from './client'
import type { Cart, CreateOrderBody, Network, Nft, NftListParams, NftPage, Order, Quote, Session, User, Wallet, WalletInput, WalletProvider } from './types'

/** Única camada que conhece URLs. Todas as chamadas REST passam pelo Axios. */
const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const api = {
  signup: (b: { username: string; email: string; password: string }) => data<Session>(http.post('/auth/signup', b)),
  login: (b: { email: string; password: string }) => data<Session>(http.post('/auth/login', b)),
  session: (signal?: AbortSignal) => data<Session>(http.get('/session', { signal })),
  logout: () => data<void>(http.post('/auth/logout')),

  nfts: (p: NftListParams, signal?: AbortSignal) =>
    data<NftPage>(http.get('/nfts', { signal, params: { ...p, category: p.category?.join(',') || undefined, network: p.network?.join(',') || undefined } })),
  featured: (signal?: AbortSignal) => data<Nft[]>(http.get('/nfts/featured', { signal })),
  nft: (id: string, signal?: AbortSignal) => data<Nft>(http.get(`/nfts/${encodeURIComponent(id)}`, { signal })),

  favorites: (signal?: AbortSignal) => data<string[]>(http.get('/favorites', { signal })),
  setFavorite: (nftId: string, on: boolean) => data<string[]>(on ? http.put(`/favorites/${nftId}`) : http.delete(`/favorites/${nftId}`)),

  cart: (signal?: AbortSignal) => data<Cart>(http.get('/cart', { signal })),
  addToCart: (b: { nftId: string; editionId: string; quantity: number }) => data<Cart>(http.post('/cart/items', b)),
  updateCartItem: (editionId: string, quantity: number) => data<Cart>(http.patch(`/cart/items/${editionId}`, { quantity })),
  removeCartItem: (editionId: string) => data<Cart>(http.delete(`/cart/items/${editionId}`)),
  acknowledgeCart: () => data<Cart>(http.post('/cart/acknowledge')),

  quote: (b: { network: Network; coupon: string | null }, signal?: AbortSignal) => data<Quote>(http.post('/quote', b, { signal })),

  createOrder: (b: CreateOrderBody, idempotencyKey: string) => data<Order>(http.post('/orders', b, { headers: { 'Idempotency-Key': idempotencyKey } })),
  order: (id: string, signal?: AbortSignal) => data<Order>(http.get(`/orders/${id}`, { signal })),
  orders: (status?: Order['status'], signal?: AbortSignal) => data<Order[]>(http.get('/orders', { signal, params: { status } })),

  profile: (signal?: AbortSignal) => data<User>(http.get('/profile', { signal })),
  updateProfile: (b: Partial<Pick<User, 'name' | 'username' | 'email' | 'ensName' | 'walletNickname'>>) => data<User>(http.patch('/profile', b)),
  removeAvatar: () => data<User>(http.delete('/profile/avatar')),
  uploadAvatar: (dataUrl: string) => data<User>(http.post('/profile/avatar', { dataUrl })),
  changePassword: (b: { currentPassword: string; newPassword: string }) => data<void>(http.post('/profile/password', b)),

  wallets: (signal?: AbortSignal) => data<Wallet[]>(http.get('/wallets', { signal })),
  createWallet: (b: WalletInput) => data<Wallet>(http.post('/wallets', b)),
  updateWallet: (id: string, b: WalletInput) => data<Wallet>(http.patch(`/wallets/${id}`, b)),
  connectWallet: (id: string, network: Network, provider: WalletProvider) => data<{ walletId: string; address: string; network: Network }>(http.post(`/wallets/${id}/connect`, { network, provider })),

  mock: {
    reset: (scenarios?: string[]) => data(http.post('/__mock/reset', { scenarios })),
    scenarios: () => data<{ available: Record<string, string>; active: string[] }>(http.get('/__mock/scenarios')),
    setScenarios: (names: string[]) => data(http.post('/__mock/scenarios', { names })),
    expireSessions: () => data(http.post('/__mock/expire-sessions')),
    nftUpdate: (b: { nftId: string; editionId?: string; priceEth?: string; available?: number }) => data<Nft>(http.post('/__mock/nft-update', b)),
    replay: (mode: 'duplicate' | 'stale') => data(http.post('/__mock/replay', { mode })),
    disconnect: () => data(http.post('/__mock/disconnect')),
    settle: () => data(http.post('/__mock/settle')),
  },
}
