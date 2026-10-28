import { createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { RootLayout } from '@/components/layout/RootLayout'
import { NotFound } from '@/pages/NotFound'
import { HomePage } from '@/pages/Home'
import { sessionStore } from '@/lib/session-store'
import { CATEGORIES, NETWORKS, type Category, type Network, type NftListParams, type NftSort, type NftTab } from '@/api/types'

export interface RouterContext { queryClient: QueryClient }
const root = createRootRouteWithContext<RouterContext>()({ component: RootLayout, notFoundComponent: () => <NotFound /> })

const SORTS: NftSort[] = ['recent', 'price_asc', 'price_desc', 'popular']
const TABS: NftTab[] = ['todos', 'novos', 'em-alta']
const decimal = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && /^\d+(\.\d+)?$/.test(String(v)) ? String(v) : undefined
/** Estado do catálogo vive na URL: sobrevive a refresh e ao histórico. */
export type HomeSearch = Omit<NftListParams, 'pageSize'>
export function validateHomeSearch(s: Record<string, unknown>): HomeSearch {
  const cats = (Array.isArray(s.category) ? s.category : typeof s.category === 'string' ? s.category.split(',') : [])
    .filter((c): c is Category => CATEGORIES.some((x) => x.value === c))
  const nets = (Array.isArray(s.network) ? s.network : typeof s.network === 'string' ? s.network.split(',') : [])
    .filter((c): c is Network => NETWORKS.some((x) => x.value === c))
  const page = Number(s.page)
  return {
    q: typeof s.q === 'string' && s.q.trim() ? s.q.slice(0, 80) : undefined,
    category: cats.length ? [...new Set(cats)].sort() : undefined,
    network: nets.length ? [...new Set(nets)].sort() : undefined,
    minPrice: decimal(s.minPrice), maxPrice: decimal(s.maxPrice),
    tab: TABS.includes(s.tab as NftTab) && s.tab !== 'todos' ? (s.tab as NftTab) : undefined,
    availability: s.availability === 'available' || s.availability === 'soldout' ? s.availability : undefined,
    sort: SORTS.includes(s.sort as NftSort) && s.sort !== 'recent' ? (s.sort as NftSort) : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

const home = createRoute({ getParentRoute: () => root, path: '/', validateSearch: validateHomeSearch, component: HomePage })
const nft = createRoute({ getParentRoute: () => root, path: '/nft/$nftId', component: lazyRouteComponent(() => import('@/pages/NftDetail'), 'NftDetailPage') })
const cart = createRoute({ getParentRoute: () => root, path: '/cart', component: lazyRouteComponent(() => import('@/pages/Cart'), 'CartPage') })

const authSearch = (s: Record<string, unknown>) => ({
  redirect: typeof s.redirect === 'string' && s.redirect.startsWith('/') && !s.redirect.startsWith('//') ? s.redirect : undefined,
  reason: s.reason === 'expired' ? ('expired' as const) : undefined,
})
const login = createRoute({ getParentRoute: () => root, path: '/login', validateSearch: authSearch, component: lazyRouteComponent(() => import('@/pages/Auth'), 'LoginPage') })
const signup = createRoute({ getParentRoute: () => root, path: '/signup', validateSearch: authSearch, component: lazyRouteComponent(() => import('@/pages/Auth'), 'SignupPage') })

/** Rotas privadas: exigem sessão; preservam o destino para retorno após login. */
const authed = createRoute({
  getParentRoute: () => root, id: 'authed',
  beforeLoad: ({ location }) => {
    if (!sessionStore.get()) throw redirect({ to: '/login', search: { redirect: location.href, reason: undefined } })
  },
})
const checkout = createRoute({ getParentRoute: () => authed, path: '/checkout', component: lazyRouteComponent(() => import('@/pages/Checkout'), 'CheckoutPage') })
const order = createRoute({ getParentRoute: () => authed, path: '/orders/$orderId', component: lazyRouteComponent(() => import('@/pages/Order'), 'OrderPage') })
const profile = createRoute({ getParentRoute: () => authed, path: '/account/profile', component: lazyRouteComponent(() => import('@/pages/Profile'), 'ProfilePage') })
const favorites = createRoute({ getParentRoute: () => authed, path: '/favoritos', component: lazyRouteComponent(() => import('@/pages/Favorites'), 'FavoritesPage') })
const wallets = createRoute({ getParentRoute: () => authed, path: '/account/wallets', component: lazyRouteComponent(() => import('@/pages/Wallets'), 'WalletsPage') })

const routeTree = root.addChildren([home, nft, cart, login, signup, authed.addChildren([checkout, order, profile, wallets, favorites])])

export function buildRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent', defaultNotFoundComponent: () => <NotFound /> })
}
declare module '@tanstack/react-router' {
  interface Register { router: ReturnType<typeof buildRouter> }
}
export const PRIVATE_PREFIXES = ['/checkout', '/orders', '/account', '/favoritos']
