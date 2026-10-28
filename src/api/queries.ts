import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './endpoints'
import { ApiError } from './client'
import type { Cart, Network, NftListParams } from './types'
import { sessionStore } from '@/lib/session-store'
import { announce } from '@/lib/announcer'

/**
 * Chaves isoladas por usuário: tudo que é privado fica sob ['user', userId, ...].
 * Logout/troca de usuário remove esse prefixo do cache (ver lib/session-sync.ts).
 */
export const keys = {
  session: ['session'] as const,
  nfts: (p: NftListParams) => ['nfts', p] as const,
  featured: ['nfts', 'featured'] as const,
  nft: (id: string) => ['nft', id] as const,
  user: (uid: string) => ['user', uid] as const,
  favorites: (uid: string) => ['user', uid, 'favorites'] as const,
  cart: (owner: string) => ['cart', owner] as const,
  quote: (owner: string, network: Network, coupon: string | null) => ['cart', owner, 'quote', network, coupon] as const,
  order: (uid: string, id: string) => ['user', uid, 'order', id] as const,
  pendingOrders: (uid: string) => ['user', uid, 'orders', 'pending'] as const,
  profile: (uid: string) => ['user', uid, 'profile'] as const,
  wallets: (uid: string) => ['user', uid, 'wallets'] as const,
}
export const cartOwner = () => {
  const s = sessionStore.get()
  return s ? `user:${s.user.id}` : `guest:${sessionStore.guestCartId()}`
}

export const nftListQuery = (p: NftListParams) => queryOptions({
  queryKey: keys.nfts(p), queryFn: ({ signal }) => api.nfts(p, signal), placeholderData: keepPreviousData, staleTime: 30_000,
})
export const nftQuery = (id: string) => queryOptions({
  queryKey: keys.nft(id), queryFn: ({ signal }) => api.nft(id, signal), staleTime: 30_000,
  retry: (n, e) => !(e instanceof ApiError && e.code === 'NOT_FOUND') && n < 2,
})
export const featuredQuery = queryOptions({ queryKey: keys.featured, queryFn: ({ signal }) => api.featured(signal), staleTime: 60_000 })
export const cartQuery = () => queryOptions({ queryKey: keys.cart(cartOwner()), queryFn: ({ signal }) => api.cart(signal), staleTime: 10_000 })

export function useFavorites(userId: string | undefined) {
  return useQuery({ queryKey: keys.favorites(userId ?? 'anon'), queryFn: ({ signal }) => api.favorites(signal), enabled: !!userId })
}
/** Atualização otimista com rollback em caso de falha. */
export function useToggleFavorite(userId: string) {
  const qc = useQueryClient()
  const key = keys.favorites(userId)
  return useMutation({
    mutationFn: ({ nftId, on }: { nftId: string; on: boolean }) => api.setFavorite(nftId, on),
    onMutate: async ({ nftId, on }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<string[]>(key)
      qc.setQueryData<string[]>(key, (old = []) => (on ? [...new Set([...old, nftId])] : old.filter((x) => x !== nftId)))
      return { prev }
    },
    onError: (err, vars, ctx) => {
      qc.setQueryData(key, ctx?.prev)
      announce(`Não foi possível ${vars.on ? 'favoritar' : 'remover dos favoritos'}: ${(err as Error).message}`, 'assertive')
    },
    onSuccess: (list, { on }) => { qc.setQueryData(key, list); announce(on ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.') },
  })
}

/** Cotação derivada do carrinho no servidor; refeita sempre que o carrinho muda (invalidação por prefixo). */
export function useQuote(network: Network, coupon: string | null, enabled: boolean) {
  const owner = cartOwner()
  return useQuery({
    queryKey: keys.quote(owner, network, coupon),
    queryFn: ({ signal }) => api.quote({ network, coupon }, signal),
    enabled, staleTime: 0, placeholderData: keepPreviousData,
    retry: (n, e) => e instanceof ApiError && e.retryable && n < 2,
  })
}

function useCartMutation<V>(fn: (v: V) => Promise<Cart>, success?: (v: V) => string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart, v) => {
      qc.setQueryData(keys.cart(cartOwner()), cart)
      qc.invalidateQueries({ queryKey: [...keys.cart(cartOwner()), 'quote'] })
      if (success) announce(success(v))
    },
    onError: (e) => announce((e as Error).message, 'assertive'),
  })
}
export const useAddToCart = () => useCartMutation(api.addToCart, (v) => `${v.quantity} item(ns) adicionado(s) ao carrinho.`)
export const useUpdateCartItem = () => useCartMutation(({ editionId, quantity }: { editionId: string; quantity: number }) => api.updateCartItem(editionId, quantity), (v) => `Quantidade atualizada para ${v.quantity}.`)
export const useRemoveCartItem = () => useCartMutation((editionId: string) => api.removeCartItem(editionId), () => 'Item removido do carrinho.')
export const useAcknowledgeCart = () => useCartMutation(() => api.acknowledgeCart(), () => 'Carrinho atualizado com os valores atuais.')
