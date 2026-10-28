import { Link, useNavigate } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { Nft } from '@/api/types'
import { useAddToCart, useFavorites, useToggleFavorite } from '@/api/queries'
import { Badge, Skeleton } from '@/components/ui'
import { useSession } from '@/lib/auth'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

/** Card do catálogo (frame "Início"): moldura marrom com a arte, ações no hover/foco, nome e preço abaixo. */
export function NftCard({ nft, eager, compact }: { nft: Nft; eager?: boolean; compact?: boolean }) {
  const session = useSession()
  const navigate = useNavigate()
  const favs = useFavorites(session?.user.id)
  const toggle = useToggleFavorite(session?.user.id ?? 'anon')
  const add = useAddToCart()
  const isFav = favs.data?.includes(nft.id) ?? false
  const soldOut = nft.totalAvailable === 0
  const defaultEdition = nft.editions.find((e) => e.id === nft.defaultEditionId)
  const canQuickAdd = !!defaultEdition && defaultEdition.available > 0
  const fav = () => (session ? toggle.mutate({ nftId: nft.id, on: !isFav }) : navigate({ to: '/login', search: { redirect: `/nft/${nft.id}`, reason: undefined } }))
  const action = 'flex h-8 w-8 items-center justify-center rounded-[4px] bg-bg/90 text-ink hover:text-price disabled:opacity-40'
  return (
    <article className="group flex flex-col gap-3" data-testid="nft-card">
      <div className="relative rounded-[20px] bg-surface p-2 md:rounded-none md:px-1 md:pb-6 md:pt-7">
        {nft.badge && <Badge className="absolute left-2 top-4 z-10 md:left-1 md:top-7">{nft.badge}</Badge>}
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block overflow-hidden rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price" aria-label={`${nft.name}, ${formatEth(nft.priceEth)}${soldOut ? ', esgotado' : ''}`}>
          <img src={nft.image} alt={`Arte do NFT ${nft.name}`} width={250} height={250} loading={eager ? 'eager' : 'lazy'} decoding="async"
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:group-hover:scale-100" />
        </Link>
        <div className={cn('absolute flex gap-2 transition-opacity max-md:right-4 max-md:top-4 md:bottom-1 md:left-1/2 md:-translate-x-1/2', compact ? 'opacity-100' : 'md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100')}>
          {!compact && (
            <button type="button" className={cn(action, 'max-md:hidden')} aria-label={`Adicionar ${nft.name} ao carrinho`} disabled={!canQuickAdd || add.isPending}
              onClick={() => defaultEdition && add.mutate({ nftId: nft.id, editionId: defaultEdition.id, quantity: 1 })}>
              <ShoppingCart aria-hidden className="h-4 w-4" />
            </button>
          )}
          <button type="button" className={action} aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`} aria-pressed={isFav} onClick={fav}>
            <Heart aria-hidden className={cn('h-4 w-4', isFav && 'fill-price text-price')} />
          </button>
          {!compact && (
            <Link to="/nft/$nftId" params={{ nftId: nft.id }} className={cn(action, 'max-md:hidden')} aria-label={`Ver detalhes de ${nft.name}`} tabIndex={-1}>
              <Search aria-hidden className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-normal sm:text-base"><Link to="/nft/$nftId" params={{ nftId: nft.id }} className="hover:text-price">{nft.name}</Link></h3>
        <p className="flex flex-wrap items-baseline gap-2 text-sm font-bold text-price sm:text-base">
          <span data-testid="card-price">{formatEth(nft.priceEth, 2)}</span>
          {nft.compareAtEth && <span className="font-normal text-hint line-through"><span className="sr-only">Preço anterior: </span>{formatEth(nft.compareAtEth, 2)}</span>}
          {soldOut && <span className="text-xs font-normal text-warn">Esgotado</span>}
        </p>
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" data-testid="nft-skeleton">
      <div className="bg-surface p-3 sm:p-4"><Skeleton className="aspect-square w-full rounded-[16px] bg-line" /></div>
      <Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-1/3" />
    </div>
  )
}
