import { useEffect, useState, type FormEvent } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { featuredQuery, nftListQuery } from '@/api/queries'
import { CATEGORIES, NETWORKS, type Facets, type Nft, type NftSort, type NftTab } from '@/api/types'
import { Alert, Button, Dialog, DialogContent, NativeSelect, Skeleton } from '@/components/ui'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { Soon } from '@/components/Soon'
import { cn } from '@/lib/utils'
import type { HomeSearch } from '@/router'

const route = getRouteApi('/')
/** Grade 3 × 3 do frame "Início". */
export const PAGE_SIZE = 9

export function HomePage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  useEffect(() => { document.title = 'Kurio — Marketplace de NFTs' }, [])
  return <HomeContent search={search} onSearch={(patch, opts) => navigate({ search: (s) => ({ ...s, ...patch }), resetScroll: false, replace: opts?.replace })} />
}

type OnSearch = (patch: Partial<HomeSearch>, opts?: { replace?: boolean }) => void

/** Conteúdo do início; também aparece ao fundo do modal de Entrar/Criar conta, como no Figma. */
export function HomeContent({ search, onSearch }: { search: HomeSearch; onSearch: OnSearch }) {
  return (
    <>
      <MobileSearchBar search={search} onSearch={onSearch} />
      <Hero />
      <Catalog search={search} onSearch={onSearch} />
      <Promos />
      <Journal />
    </>
  )
}

/** Barra “Explorar coleções” + botão de filtros do frame mobile. */
function MobileSearchBar({ search, onSearch }: { search: HomeSearch; onSearch: OnSearch }) {
  const [q, setQ] = useState(search.q ?? '')
  useEffect(() => { setQ(search.q ?? '') }, [search.q])
  useEffect(() => {
    const t = window.setTimeout(() => { if ((q.trim() || undefined) !== search.q) onSearch({ q: q.trim() || undefined, page: undefined }, { replace: true }) }, 350)
    return () => window.clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="container-page flex items-center gap-3 pt-6 md:hidden">
      <form role="search" className="relative flex-1" onSubmit={(e) => { e.preventDefault(); onSearch({ q: q.trim() || undefined, page: undefined }) }}>
        <label htmlFor="mobile-search" className="sr-only">Buscar NFTs</label>
        <Search aria-hidden className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input id="mobile-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Explorar coleções"
          className="h-12 w-full rounded-[12px] bg-surface pl-11 pr-3 text-sm font-bold text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
      </form>
      <FiltersDrawer search={search} onSearch={onSearch} />
    </div>
  )
}

function Hero() {
  const featured = useQuery(featuredQuery)
  const [slide, setSlide] = useState(0)
  const items = featured.data ?? []
  const current = items[slide % Math.max(items.length, 1)]
  return (
    <section aria-labelledby="hero-title" className="container-page pt-5 md:pt-10">
      <div className="relative grid grid-cols-[1fr_120px] items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4A2E1C] to-surface p-4 md:grid-cols-[1fr_450px] md:rounded-none md:bg-none md:p-0 lg:gap-20">
        <div className="flex flex-col gap-2 md:gap-6 md:pl-12">
          <p className="text-xs font-bold md:text-sm md:font-normal">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-xl uppercase leading-tight tracking-[0.08em] md:text-[40px] md:leading-[1.6] md:tracking-[0.06em]">
            <span className="md:hidden">Seja dono da cultura digital</span>
            <span className="hidden md:inline">Seja dono do futuro da arte digital</span>
          </h1>
          <p className="max-w-[440px] text-[11px] leading-relaxed text-muted md:text-sm"><span className="md:hidden">Descubra NFTs selecionados de criadores do mundo todo.</span><span className="hidden md:inline">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</span></p>
          <Button asChild size="lg" className="hidden h-10 w-fit px-7 text-sm uppercase md:inline-flex"><a href="#mercado">Explorar</a></Button>
          <a href="#mercado" className="flex items-center gap-2 text-xs font-bold uppercase text-price md:hidden">Explorar <ArrowRight aria-hidden className="h-4 w-4" /></a>
        </div>
        <div className="relative">
          {current ? (
            <Link to="/nft/$nftId" params={{ nftId: current.id }} className="block overflow-hidden rounded-[20px]" aria-label={`Destaque: ${current.name}`}>
              <img src={current.gallery[0]} alt={`Destaque: ${current.name}`} width={450} height={450} fetchPriority="high" className="aspect-square w-full object-cover" />
            </Link>
          ) : featured.isError ? (
            <div className="flex aspect-square items-center p-6"><Alert tone="error" title="Destaques indisponíveis" action={<Button size="sm" onClick={() => featured.refetch()}>Tentar novamente</Button>} /></div>
          ) : featured.data ? (
            <div className="flex aspect-square items-center justify-center rounded-[20px] bg-surface p-6 text-muted">Nenhum destaque no momento.</div>
          ) : <Skeleton className="aspect-square w-full rounded-[20px]" />}
        </div>
        {items.length > 1 && (
          <div className="col-span-2 flex justify-center gap-2 md:col-span-1 md:absolute md:bottom-6 md:left-[calc(100%-450px-80px-56px)]" role="group" aria-label="Destaques">
            {items.map((n, i) => (
              <button key={n.id} type="button" onClick={() => setSlide(i)} aria-label={`Mostrar destaque ${i + 1}: ${n.name}`} aria-pressed={i === slide % items.length}
                className="flex h-6 w-6 items-center justify-center rounded-full"><span aria-hidden className={cn('h-2 w-2 rounded-full', i === slide % items.length ? 'bg-price' : 'bg-accent/60')} /></button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** Painel “Coleções / Faixa de preço / Rede” do frame Início. */
function Filters({ search, onSearch, facets, idPrefix }: { search: HomeSearch; onSearch: OnSearch; facets?: Facets; idPrefix: string }) {
  const range = facets?.priceRange ?? { min: '0', max: '0' }
  const lo = Number(range.min), hi = Number(range.max)
  const [min, setMin] = useState(Number(search.minPrice ?? lo))
  const [max, setMax] = useState(Number(search.maxPrice ?? hi))
  useEffect(() => { setMin(Number(search.minPrice ?? lo)); setMax(Number(search.maxPrice ?? hi)) }, [search.minPrice, search.maxPrice, lo, hi])
  const fmt = (v: number) => v.toFixed(2).replace('.', ',')
  const toggle = <T extends string>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v])
  const pct = (v: number) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 0)
  const item = (on: boolean) => cn('flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm hover:text-price', on ? 'font-bold text-price' : 'text-muted')
  return (
    <div className="flex flex-col gap-8 bg-surface px-5 py-6">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-3 text-base font-bold">Coleções</legend>
        {CATEGORIES.map((c) => {
          const on = search.category?.includes(c.value) ?? false
          return (
            <button key={c.value} type="button" aria-pressed={on} className={item(on)} onClick={() => onSearch({ category: toggle(search.category, c.value), page: undefined })}>
              <span>{c.label}</span><span className="text-price" aria-label={`${facets?.categories[c.value] ?? 0} NFTs`}>({facets?.categories[c.value] ?? '–'})</span>
            </button>
          )
        })}
      </fieldset>
      <form className="flex flex-col gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); onSearch({ minPrice: min > lo ? min.toFixed(2) : undefined, maxPrice: max < hi ? max.toFixed(2) : undefined, page: undefined }) }}>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-base font-bold">Faixa de preço</legend>
          <div className="relative h-5">
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-accent/40" />
            <div className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-accent" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} />
            <label htmlFor={`${idPrefix}-min`} className="sr-only">Preço mínimo</label>
            <input id={`${idPrefix}-min`} type="range" min={lo} max={hi} step={0.01} value={min} aria-valuetext={`${fmt(min)} ETH`}
              onChange={(e) => setMin(Math.min(Number(e.target.value), max))} className="range-thumb pointer-events-none absolute inset-0 w-full appearance-none bg-transparent" />
            <label htmlFor={`${idPrefix}-max`} className="sr-only">Preço máximo</label>
            <input id={`${idPrefix}-max`} type="range" min={lo} max={hi} step={0.01} value={max} aria-valuetext={`${fmt(max)} ETH`}
              onChange={(e) => setMax(Math.max(Number(e.target.value), min))} className="range-thumb pointer-events-none absolute inset-0 w-full appearance-none bg-transparent" />
          </div>
          <p className="text-sm" aria-live="polite">Preço: {fmt(min)} - {fmt(max)} ETH</p>
          <Button type="submit" size="sm" className="w-fit">Aplicar</Button>
        </fieldset>
      </form>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-3 text-base font-bold">Rede</legend>
        {NETWORKS.map((n) => {
          const on = search.network?.includes(n.value) ?? false
          return (
            <button key={n.value} type="button" aria-pressed={on} className={item(on)} onClick={() => onSearch({ network: toggle(search.network, n.value), page: undefined })}>
              <span>{n.label}</span><span aria-label={`${facets?.networks[n.value] ?? 0} NFTs`}>({facets?.networks[n.value] ?? '–'})</span>
            </button>
          )
        })}
      </fieldset>
      {(search.category?.length || search.network?.length || search.minPrice || search.maxPrice || search.availability) ? (
        <Button variant="outline" size="sm" className="w-fit" onClick={() => onSearch({ category: undefined, network: undefined, minPrice: undefined, maxPrice: undefined, availability: undefined, page: undefined })}>Limpar filtros</Button>
      ) : null}
    </div>
  )
}

function FiltersDrawer({ search, onSearch }: { search: HomeSearch; onSearch: OnSearch }) {
  const [open, setOpen] = useState(false)
  const list = useQuery(nftListQuery({ ...search, pageSize: PAGE_SIZE }))
  const active = (search.category?.length ?? 0) + (search.network?.length ?? 0) + (search.minPrice || search.maxPrice ? 1 : 0) + (search.availability ? 1 : 0)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Filtros${active ? ` (${active} ativos)` : ''}`}
        className="relative flex h-12 w-12 items-center justify-center rounded-[12px] bg-gradient-to-b from-accent to-[#A86A3A] text-bg">
        <SlidersHorizontal aria-hidden className="h-5 w-5" />
        {active > 0 && <span aria-hidden className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-bg">{active}</span>}
      </button>
      <DialogContent title="Filtros" side="right">
        <div className="flex flex-col gap-2">
          <label htmlFor="drawer-sort" className="text-sm font-bold">Ordenar por:</label>
          <NativeSelect id="drawer-sort" value={search.sort ?? 'recent'} onChange={(e) => onSearch({ sort: e.target.value === 'recent' ? undefined : (e.target.value as NftSort), page: undefined })}>
            <option value="recent">Listados recentemente</option><option value="price_asc">Menor preço</option>
            <option value="price_desc">Maior preço</option><option value="popular">Mais vendidos</option>
          </NativeSelect>
        </div>
        <Filters search={search} onSearch={onSearch} facets={list.data?.facets} idPrefix="drawer" />
        <Button onClick={() => setOpen(false)}>Ver resultados</Button>
      </DialogContent>
    </Dialog>
  )
}

const TABS: { value: NftTab; label: string }[] = [{ value: 'todos', label: 'Todos os NFTs' }, { value: 'novos', label: 'Novos lançamentos' }, { value: 'em-alta', label: 'Em alta' }]

function Catalog({ search, onSearch }: { search: HomeSearch; onSearch: OnSearch }) {
  const list = useQuery(nftListQuery({ ...search, pageSize: PAGE_SIZE }))
  const featured = useQuery(featuredQuery)
  const data = list.data
  const tab = search.tab ?? 'todos'
  const spotlight: Nft | undefined = featured.data?.[1] ?? featured.data?.[0]
  return (
    <section id="mercado" aria-labelledby="catalog-title" className="container-page scroll-mt-4 pt-10 md:pt-24">
      <h2 id="catalog-title" className="sr-only">Mercado de NFTs</h2>
      <div className="grid gap-12 md:grid-cols-[230px_1fr] lg:grid-cols-[270px_1fr]">
        <aside className="hidden flex-col gap-8 md:flex" aria-label="Filtros">
          <Filters search={search} onSearch={onSearch} facets={data?.facets} idPrefix="side" />
          {spotlight && (
            <Link to="/nft/$nftId" params={{ nftId: spotlight.id }} className="flex flex-col gap-3 bg-surface pt-4 hover:brightness-110">
              <p className="px-4 text-lg font-bold uppercase leading-tight text-price">NFT em destaque</p>
              <p className="text-center text-base font-bold uppercase">Oferta limitada</p>
              <img src={spotlight.image} alt={`NFT em destaque: ${spotlight.name}`} width={270} height={270} loading="lazy" className="aspect-square w-full rounded-[16px] object-cover" />
            </Link>
          )}
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div role="tablist" aria-label="Listas de NFTs" className="no-scrollbar relative flex gap-5 overflow-x-auto text-sm">
              {TABS.map((t) => (
                <button key={t.value} role="tab" type="button" aria-selected={tab === t.value} onClick={() => onSearch({ tab: t.value === 'todos' ? undefined : t.value, page: undefined })}
                  className={cn('whitespace-nowrap border-b-2 pb-1', tab === t.value ? 'border-accent font-bold text-price' : 'border-transparent hover:text-price')}>{t.label}</button>
              ))}
            </div>
            <div className="hidden items-center gap-2 text-sm md:flex">
              <label htmlFor="catalog-sort">Ordenar por:</label>
              <NativeSelect id="catalog-sort" className="h-8 w-auto border-0 bg-transparent pl-0 pr-7" value={search.sort ?? 'recent'}
                onChange={(e) => onSearch({ sort: e.target.value === 'recent' ? undefined : (e.target.value as NftSort), page: undefined })}>
                <option value="recent">Listados recentemente</option><option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option><option value="popular">Mais vendidos</option>
              </NativeSelect>
            </div>
          </div>
          <p className="sr-only" aria-live="polite" data-testid="result-count">
            {data ? `${data.total} resultado(s)` : list.isError ? '' : 'Carregando…'}
            {search.q ? ` para “${search.q}”` : ''}{list.isFetching && data ? ' · atualizando…' : ''}
          </p>
          {list.isError && !data ? (
            <Alert tone="error" title="Não foi possível carregar o catálogo" action={<Button size="sm" className="w-fit" onClick={() => list.refetch()}>Tentar novamente</Button>}>{list.error.message}</Alert>
          ) : data && data.items.length === 0 ? (
            <Alert tone="info" title="Nenhum NFT encontrado">Ajuste a busca ou os filtros para ver mais resultados.</Alert>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-14" aria-busy={list.isFetching} data-testid="catalog-grid">
              {data ? data.items.map((n, i) => <li key={n.id} className={cn(i % 2 === 1 && 'mt-8 lg:mt-0')}><NftCard nft={n} eager={i < 3} /></li>)
                : Array.from({ length: PAGE_SIZE }, (_, i) => <li key={i}><NftCardSkeleton /></li>)}
            </ul>
          )}
          {data && data.totalPages > 1 && (
            <nav aria-label="Paginação" className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <PageBtn label="Página anterior" disabled={data.page <= 1} onClick={() => onSearch({ page: data.page - 1 > 1 ? data.page - 1 : undefined })}><ChevronLeft aria-hidden className="h-4 w-4" /></PageBtn>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <PageBtn key={p} label={`Página ${p}`} current={p === data.page} onClick={() => onSearch({ page: p > 1 ? p : undefined })}>{p}</PageBtn>
              ))}
              <PageBtn label="Próxima página" disabled={data.page >= data.totalPages} onClick={() => onSearch({ page: data.page + 1 })}><ChevronRight aria-hidden className="h-4 w-4" /></PageBtn>
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}

function PageBtn({ children, label, current, disabled, onClick }: { children: React.ReactNode; label: string; current?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} aria-current={current ? 'page' : undefined} disabled={disabled} onClick={onClick}
      className={cn('flex h-8 w-8 items-center justify-center rounded-[4px] border text-sm disabled:opacity-40', current ? 'border-accent bg-accent font-bold text-bg' : 'border-line hover:border-accent')}>
      {children}
    </button>
  )
}

/** Banners “Lançamentos gênesis” e “Arte digital selecionada”. */
function Promos() {
  const featured = useQuery(featuredQuery)
  const promos: { title: string; text: string; image?: string; to: Partial<HomeSearch> }[] = [
    { title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', image: featured.data?.[0]?.image, to: { tab: 'novos' } },
    { title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', image: featured.data?.[2]?.image, to: { category: ['arte-digital'] } },
  ]
  return (
    <section aria-label="Destaques da Kurio" className="container-page grid gap-6 pt-24 lg:grid-cols-2 lg:gap-8">
      {promos.map((p) => (
        <div key={p.title} className="grid grid-cols-[minmax(120px,170px)_1fr] items-center gap-4 overflow-hidden bg-surface sm:grid-cols-[290px_1fr]">
          {p.image ? <img src={p.image} alt="" width={290} height={250} loading="lazy" className="aspect-[290/250] h-full w-full object-cover" /> : <Skeleton className="aspect-square" />}
          <div className="flex flex-col items-end gap-3 py-4 pr-4 text-right">
            <h2 className="text-sm font-bold sm:text-base">{p.title}</h2>
            <p className="text-xs leading-relaxed text-muted">{p.text}</p>
            <Button asChild size="sm" className="font-medium"><Link to="/" search={p.to} hash="mercado">Explorar <ArrowRight aria-hidden className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      ))}
    </section>
  )
}

/** “Diário da Cunhagem”: conteúdo editorial está fora do escopo — “Ler mais” avisa que estará disponível em breve. */
function Journal() {
  const featured = useQuery(featuredQuery)
  const posts = [
    ['12 de setembro', '6', 'Como funciona a propriedade de NFTs', 'Aprenda a colecionar, negociar e verificar ativos digitais.'],
    ['13 de setembro', '2', '10 artistas digitais para acompanhar', 'Conheça criadores que moldam a cultura digital.'],
    ['15 de setembro', '3', 'Raridade, atributos e procedência', 'Entenda raridade, procedência, direitos autorais e utilidade.'],
    ['15 de setembro', '2', 'Como proteger sua carteira', 'Proteja sua carteira, seus ativos e sua identidade.'],
  ]
  return (
    <section aria-labelledby="journal-title" className="container-page pt-24">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <h2 id="journal-title" className="text-xl md:text-2xl">Diário da Cunhagem</h2>
        <p className="text-xs text-muted">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </div>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map(([date, min, title, text], i) => {
          const img = featured.data?.[(i + 2) % Math.max(featured.data.length, 1)]?.image
          return (
            <li key={title} className="flex flex-col bg-surface">
              {img ? <img src={img} alt="" width={290} height={180} loading="lazy" className="aspect-[290/180] w-full object-cover" /> : <Skeleton className="aspect-[290/180] w-full rounded-none" />}
              <div className="flex flex-col gap-2 p-3">
                <p className="text-[11px] text-muted">{date} <span aria-hidden>|</span> Leitura de {min} min</p>
                <h3 className="text-sm">{title}</h3>
                <p className="text-[11px] leading-relaxed text-muted">{text}</p>
                <Soon label={`Artigo “${title}”`} className="text-[11px] font-bold text-price">Ler mais →</Soon>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

