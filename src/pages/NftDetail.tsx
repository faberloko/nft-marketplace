import { useEffect, useState } from 'react'
import { getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Heart, Linkedin, Mail, Search, ShoppingCart, Star, Twitter } from 'lucide-react'
import { ApiError } from '@/api/client'
import { cartQuery, nftListQuery, nftQuery, useAddToCart, useFavorites, useToggleFavorite } from '@/api/queries'
import { NETWORKS, type Nft } from '@/api/types'
import { Alert, Breadcrumb, Button, Dialog, DialogContent, QuantityStepper, Skeleton } from '@/components/ui'
import { NftCard } from '@/components/NftCard'
import { NotFound } from './NotFound'
import { useSession } from '@/lib/auth'
import { formatEth, mulEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

const route = getRouteApi('/nft/$nftId')

export function NftDetailPage() {
  const { nftId } = route.useParams()
  const q = useQuery(nftQuery(nftId))
  useEffect(() => { if (q.data) document.title = `${q.data.name} — Kurio` }, [q.data])
  if (q.error instanceof ApiError && q.error.code === 'NOT_FOUND') return <NotFound title="NFT não encontrado" message="Este NFT não existe ou foi removido do catálogo." />
  if (q.isError && !q.data) return <div className="container-page py-16"><Alert tone="error" title="Não foi possível carregar o NFT" action={<Button size="sm" className="w-fit" onClick={() => q.refetch()}>Tentar novamente</Button>}>{q.error.message}</Alert></div>
  if (!q.data) return <DetailSkeleton />
  return <Detail key={q.data.id} nft={q.data} />
}

function DetailSkeleton() {
  return (
    <div className="container-page py-8" data-testid="detail-skeleton">
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="grid gap-8 md:grid-cols-[100px_minmax(0,445px)_1fr]">
        <div className="hidden flex-col gap-4 md:flex">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square w-full" />)}</div>
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-4"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-7 w-1/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-full" /></div>
      </div>
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('h-4 w-4', i <= Math.round(value) ? 'fill-price text-price' : 'text-hint')} />)}
    </span>
  )
}

function Detail({ nft }: { nft: Nft }) {
  const session = useSession()
  const navigate = useNavigate()
  const router = useRouter()
  const [img, setImg] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [tab, setTab] = useState<'detalhes' | 'avaliacoes'>('detalhes')
  const firstAvailable = nft.editions.find((e) => e.id === nft.defaultEditionId && e.available > 0) ?? nft.editions.find((e) => e.available > 0) ?? nft.editions[0]
  const [editionId, setEditionId] = useState(firstAvailable.id)
  const edition = nft.editions.find((e) => e.id === editionId) ?? firstAvailable
  const cart = useQuery(cartQuery())
  const inCart = cart.data?.items.find((i) => i.editionId === edition.id)?.quantity ?? 0
  const max = Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart)
  const [qty, setQty] = useState(1)
  useEffect(() => { setQty((v) => Math.min(Math.max(1, v), Math.max(1, max))) }, [max])
  const add = useAddToCart()
  const favs = useFavorites(session?.user.id)
  const toggle = useToggleFavorite(session?.user.id ?? 'anon')
  const isFav = favs.data?.includes(nft.id) ?? false
  const unavailable = edition.available === 0 || max === 0
  const network = NETWORKS.find((n) => n.value === nft.network)?.label
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const buy = () => add.mutate({ nftId: nft.id, editionId: edition.id, quantity: qty }, { onSuccess: () => navigate({ to: '/cart' }) })
  const addOnly = () => add.mutate({ nftId: nft.id, editionId: edition.id, quantity: qty }, { onSuccess: () => setQty(1) })
  const fav = () => (session ? toggle.mutate({ nftId: nft.id, on: !isFav }) : navigate({ to: '/login', search: { redirect: `/nft/${nft.id}`, reason: undefined } }))

  const editionPicker = (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-bold">Edição:</legend>
      <div className="flex flex-wrap gap-2">
        {nft.editions.map((e) => (
          <label key={e.id} className={cn('relative cursor-pointer rounded-full border px-2.5 py-1 text-xs focus-within:ring-2 focus-within:ring-price',
            e.id === edition.id ? 'border-accent font-bold text-price' : 'border-line text-muted', e.available === 0 && 'cursor-not-allowed line-through opacity-50')}>
            <input type="radio" name="edition" value={e.id} className="sr-only" checked={e.id === edition.id} disabled={e.available === 0} onChange={() => setEditionId(e.id)} />
            {e.label}<span className="sr-only"> — {formatEth(e.priceEth, 2)}{e.available === 0 ? ', indisponível' : `, ${e.available} disponível(is)`}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted" data-testid={`edition-price-${edition.id}`}>
        {edition.available === 0 ? 'Edição indisponível' : `${formatEth(edition.priceEth, 2)} · ${edition.available} disponível(is) · máx. ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`}
      </p>
    </fieldset>
  )
  const facts = (
    <dl className="flex flex-col gap-2 text-sm text-muted">
      <div className="flex gap-2"><dt>ID do token:</dt><dd>{nft.tokenId}</dd></div>
      <div className="flex gap-2"><dt>Coleção:</dt><dd>{nft.collection}</dd></div>
      <div className="flex gap-2"><dt>Atributos:</dt><dd>{nft.attributes.join(', ')}</dd></div>
    </dl>
  )

  return (
    <article className="pb-36 md:pb-0">
      {/* Barra superior mobile: voltar + favoritar */}
      <div className="container-page flex items-center justify-between pt-6 md:hidden">
        <button type="button" onClick={() => router.history.back()} aria-label="Voltar" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-price"><ChevronLeft aria-hidden className="h-5 w-5" /></button>
        <button type="button" onClick={fav} aria-pressed={isFav} aria-label={isFav ? 'Favoritado' : 'Favoritar'} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-price">
          <Heart aria-hidden className={cn('h-5 w-5', isFav && 'fill-price')} />
        </button>
      </div>
      <div className="container-page pt-4 md:pt-7">
        <div className="hidden md:block"><Breadcrumb items={[{ label: 'Início', to: <Link to="/" className="hover:text-price">Início</Link> }, { label: 'Mercado', to: <Link to="/" hash="mercado" className="hover:text-price">Mercado</Link> }]} /></div>
        <div className="mt-2 grid gap-8 md:grid-cols-[80px_minmax(0,1fr)] lg:grid-cols-[100px_minmax(0,445px)_1fr] lg:gap-8">
          <div role="group" aria-label="Galeria" className="order-2 hidden flex-col gap-4 md:order-none md:flex">
            {nft.gallery.map((_, i) => (
              <button key={i} type="button" onClick={() => setImg(i)} aria-pressed={i === img} aria-label={`Mostrar imagem ${i + 1}`}
                className={cn('overflow-hidden rounded-[6px] border-2', i === img ? 'border-accent' : 'border-transparent opacity-80 hover:opacity-100')}>
                <img src={nft.thumb} alt="" width={100} height={100} className="aspect-square w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
          <div className="relative md:bg-surface md:p-5">
            <img src={nft.gallery[img]} alt={`${nft.name} — imagem ${img + 1} de ${nft.gallery.length}`} width={445} height={445} fetchPriority="high"
              className="aspect-square w-full rounded-[24px] object-cover md:rounded-[16px]" />
            <button type="button" onClick={() => setZoom(true)} aria-label="Ampliar imagem" className="absolute right-3 top-3 hidden h-9 w-9 items-center justify-center rounded-full bg-bg/80 text-ink hover:text-price md:flex">
              <Search aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-col gap-4 rounded-t-[28px] bg-surface p-6 md:col-span-2 md:rounded-none md:bg-transparent md:p-0 lg:col-span-1">
            <div className="flex items-start justify-between gap-3 md:block">
              <h1 className="text-xl md:text-[28px] md:leading-tight">{nft.name}</h1>
              <p className="flex shrink-0 items-center gap-1 rounded-full border border-accent px-2 py-0.5 text-xs font-bold md:hidden" aria-label={`Nota ${nft.rating.toFixed(1)} de 5 com ${nft.reviews} avaliações`}>
                <Star aria-hidden className="h-3.5 w-3.5 fill-price text-price" />{nft.rating.toFixed(1)}<span className="font-normal text-muted">({nft.reviews})</span>
              </p>
            </div>
            <div className="hidden flex-wrap items-center justify-between gap-3 border-b border-line pb-3 md:flex">
              <p className="text-xl font-bold text-price" data-testid="detail-price">{formatEth(edition.priceEth, 2)}</p>
              <p className="flex items-center gap-2 text-sm" aria-label={`Nota ${nft.rating.toFixed(1)} de 5 com ${nft.reviews} avaliações de colecionadores`}><Stars value={nft.rating} /> {nft.reviews} avaliações de colecionadores</p>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="hidden text-sm font-bold md:block">Sobre este NFT:</h2>
              <p className="text-sm leading-relaxed text-muted">{nft.description}</p>
            </div>
            {editionPicker}
            {edition.available === 0 && <Alert tone="warn" title="Edição indisponível">Escolha outra edição ou volte mais tarde.</Alert>}
            <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
              <QuantityStepper value={qty} max={Math.max(1, max)} onChange={setQty} disabled={unavailable} label="Quantidade" />
              <div className="flex gap-3">
                <Button className="h-10 w-[115px] uppercase" disabled={unavailable || add.isPending} onClick={buy}>{add.isPending ? '…' : 'Comprar'}</Button>
                <Button variant="outline" className="h-10 font-medium text-ink" aria-pressed={isFav} disabled={toggle.isPending} onClick={fav}>
                  <Heart aria-hidden className={cn('h-5 w-5 text-price', isFav && 'fill-price')} /> {isFav ? 'Favoritado' : 'Favoritar'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted">{max === 0 && edition.available > 0 ? `Você já tem o máximo desta edição no carrinho (${inCart}).` : ''}</p>
            {add.error && <p role="alert" className="text-sm text-danger">{(add.error as Error).message}</p>}
            {facts}
            <div className="hidden items-center gap-3 text-sm font-bold md:flex">
              <span>Compartilhar este NFT:</span>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (abre em nova aba)" className="hover:text-price"><Linkedin aria-hidden className="h-4 w-4" /></a>
              <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(url)}`} aria-label="Compartilhar por e-mail" className="hover:text-price"><Mail aria-hidden className="h-4 w-4" /></a>
              <a href={`https://x.com/intent/tweet?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no X (abre em nova aba)" className="hover:text-price"><Twitter aria-hidden className="h-4 w-4" /></a>
            </div>
          </div>
        </div>

        <section className="mt-16 hidden md:block" aria-label="Informações do NFT">
          <div role="tablist" aria-label="Informações do NFT" className="flex gap-8 border-b border-line">
            {([['detalhes', 'Detalhes do NFT'], ['avaliacoes', `Avaliações de colecionadores (${nft.reviews})`]] as const).map(([v, l]) => (
              <button key={v} role="tab" id={`tab-${v}`} aria-controls={`panel-${v}`} aria-selected={tab === v} type="button" onClick={() => setTab(v)}
                className={cn('-mb-px border-b-2 pb-2 text-base', tab === v ? 'border-accent font-bold text-price' : 'border-transparent hover:text-price')}>{l}</button>
            ))}
          </div>
          {tab === 'detalhes' ? (
            <div role="tabpanel" id="panel-detalhes" aria-labelledby="tab-detalhes" className="flex flex-col gap-4 pt-4 text-sm leading-relaxed text-muted">
              {nft.details.map((p) => <p key={p}>{p}</p>)}
              <dl className="flex flex-col gap-3">
                <div><dt className="font-bold text-ink">Rede:</dt><dd>Cunhado na {network} com procedência imutável e metadados armazenados no IPFS.</dd></div>
                <div><dt className="font-bold text-ink">Contrato:</dt><dd>Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd></div>
                <div><dt className="font-bold text-ink">Direitos autorais:</dt><dd>0x7A42...19E8 · Contrato inteligente ERC-721 verificado (simulado).</dd></div>
              </dl>
            </div>
          ) : (
            <div role="tabpanel" id="panel-avaliacoes" aria-labelledby="tab-avaliacoes" className="flex flex-col gap-3 pt-4 text-sm text-muted">
              <p className="flex items-center gap-2 text-ink"><Stars value={nft.rating} /> Média {nft.rating.toFixed(1).replace('.', ',')} de 5 em {nft.reviews} avaliações.</p>
              <p>A leitura e o envio de avaliações não fazem parte desta demonstração.</p>
            </div>
          )}
        </section>
        <MoreFromCollection current={nft.id} />
      </div>

      {/* Barra de compra fixa do frame mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-4 rounded-t-[28px] bg-surface px-6 pb-6 pt-5 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><span className="text-sm font-bold">Qtd.</span><QuantityStepper value={qty} max={Math.max(1, max)} onChange={setQty} disabled={unavailable} label="Quantidade (mobile)" size="sm" /></div>
          <p className="text-xl font-bold text-price" data-testid="detail-total">{formatEth(mulEth(edition.priceEth, qty), 2)}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="pill" className="h-14 flex-1 text-base" disabled={unavailable || add.isPending} onClick={buy}>Comprar NFT</Button>
          <Button variant="secondary" className="h-14 w-14 rounded-full bg-bg/60 text-price" aria-label="Adicionar ao carrinho" disabled={unavailable || add.isPending} onClick={addOnly}><ShoppingCart aria-hidden className="h-5 w-5" /></Button>
        </div>
      </div>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent title={nft.name} className="sm:w-[min(94vw,820px)] sm:px-6">
          <img src={nft.gallery[img]} alt={`${nft.name} ampliado`} width={800} height={800} className="aspect-square w-full rounded-[16px] object-cover" />
        </DialogContent>
      </Dialog>
    </article>
  )
}

/** “Mais desta coleção” com paginação por pontos (frame Detalhes). */
export function MoreFromCollection({ current, title = 'Mais desta coleção' }: { current?: string; title?: string }) {
  const list = useQuery(nftListQuery({ sort: 'popular', pageSize: 16 }))
  const items = (list.data?.items ?? []).filter((n) => n.id !== current).slice(0, 15)
  const pages = Math.max(1, Math.ceil(items.length / 5))
  const [page, setPage] = useState(0)
  if (!items.length) return null
  return (
    <section aria-labelledby="more-title" className="pt-16 md:pt-20">
      <h2 id="more-title" className="border-b border-line pb-3 text-base font-bold text-price">{title}</h2>
      <ul className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {items.slice(page * 5, page * 5 + 5).map((n) => <li key={n.id}><NftCard nft={n} compact /></li>)}
      </ul>
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2" role="group" aria-label="Páginas da coleção">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" onClick={() => setPage(i)} aria-label={`Página ${i + 1} da coleção`} aria-pressed={i === page}
              className="flex h-6 w-6 items-center justify-center rounded-full"><span aria-hidden className={cn('h-3 w-3 rounded-full border border-accent', i === page && 'bg-accent')} /></button>
          ))}
        </div>
      )}
    </section>
  )
}
