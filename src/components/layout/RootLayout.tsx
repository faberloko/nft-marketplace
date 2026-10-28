import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Facebook, Heart, Home as HomeIcon, Instagram, Linkedin, LogIn, ScanLine, Search, ShoppingCart, Twitter, User as UserIcon, WifiOff, Youtube } from 'lucide-react'
import { Button, Dialog, DialogContent, Input, WalletsBadge } from '@/components/ui'
import { Soon } from '@/components/Soon'
import { cartQuery } from '@/api/queries'
import { CATEGORIES } from '@/api/types'
import { useSession } from '@/lib/auth'
import { onAnnounce, type Toast } from '@/lib/announcer'
import { connection } from '@/realtime/socket'
import { MOCKS_ENABLED } from '@/lib/env'
import { cn } from '@/lib/utils'

const MockPanel = lazy(() => import('@/components/MockPanel'))

export function Logo({ className }: { className?: string }) {
  return <Link to="/" className={cn('font-bold uppercase tracking-[0.15em]', className)} aria-label="Kurio — página inicial">KURIO</Link>
}

function useCartCount() {
  const cart = useQuery(cartQuery())
  return cart.data?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault(); onOpenChange(false)
    navigate({ to: '/', search: { q: q.trim() || undefined }, hash: 'mercado' })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Buscar NFTs">
        <form role="search" onSubmit={submit} className="flex flex-col gap-4">
          <label htmlFor="global-search" className="text-sm text-muted">Nome do NFT, coleção ou atributo</label>
          <Input id="global-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Explorar coleções" autoFocus />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Cabeçalho desktop/tablet do Figma: KURIO · Início Mercado Criadores Aprenda · busca, carrinho e Entrar. */
function Header() {
  const session = useSession()
  const count = useCartCount()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const href = useRouterState({ select: (s) => s.location.href })
  const [search, setSearch] = useState(false)
  const market = pathname.startsWith('/nft') || pathname.startsWith('/cart') || pathname.startsWith('/checkout') || pathname.startsWith('/orders')
  const item = 'relative py-2 text-sm hover:text-price'
  const active = 'text-price font-bold after:absolute after:-bottom-[17px] after:left-0 after:right-0 after:h-[3px] after:bg-accent'
  return (
    <header className="hidden border-b border-line md:block">
      <div className="container-page flex h-[68px] items-center justify-between gap-6">
        <Logo className="text-sm" />
        <nav aria-label="Principal" className="flex items-center gap-8 lg:gap-10">
          <Link to="/" className={cn(item, pathname === '/' && active)} aria-current={pathname === '/' ? 'page' : undefined}>Início</Link>
          <Link to="/" hash="mercado" className={cn(item, market && active)} aria-current={market ? 'page' : undefined}>Mercado</Link>
          <Soon className={item}>Criadores</Soon>
          <Soon className={item}>Aprenda</Soon>
        </nav>
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => setSearch(true)} aria-label="Buscar NFTs" className="rounded p-1 hover:text-price"><Search aria-hidden className="h-5 w-5" /></button>
          <Link to="/cart" className="relative rounded p-1 hover:text-price" aria-label={`Carrinho, ${count} item(ns)`}>
            <ShoppingCart aria-hidden className="h-5 w-5" />
            <span aria-hidden data-testid="cart-count" className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg">{count}</span>
          </Link>
          {session ? (
            <Link to="/account/profile" className="flex items-center gap-2 rounded-[4px] border border-accent px-3 py-1.5 text-sm font-bold text-price hover:bg-accent/10">
              {session.user.avatarUrl ? <img src={session.user.avatarUrl} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" /> : <UserIcon aria-hidden className="h-4 w-4" />}
              <span className="max-w-28 truncate">{session.user.username}</span>
            </Link>
          ) : (
            <Button asChild size="sm" className="h-9 text-base font-medium">
              <Link to="/login" search={{ redirect: href === '/login' ? undefined : href, reason: undefined }}><LogIn aria-hidden className="h-5 w-5" /> Entrar</Link>
            </Button>
          )}
        </div>
      </div>
      <SearchDialog open={search} onOpenChange={setSearch} />
    </header>
  )
}

/** Barra inferior do Figma mobile: início, favoritos, botão central, carrinho e perfil. */
function BottomNav() {
  const session = useSession()
  const count = useCartCount()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Detalhe, carrinho e pagamento têm barras de ação próprias no Figma mobile.
  if (!(pathname === '/' || pathname === '/favoritos' || pathname.startsWith('/account'))) return null
  const icon = (on: boolean) => cn('flex h-12 w-12 items-center justify-center rounded-full', on ? 'text-price' : 'text-ink/90 hover:text-price')
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-30 md:hidden">
      <div className="relative mx-auto flex h-[84px] max-w-[480px] items-center justify-between rounded-t-[28px] bg-surface px-6 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
        <Link to="/" className={icon(pathname === '/')} aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined}><HomeIcon aria-hidden className="h-6 w-6" fill="currentColor" /></Link>
        <Link to="/favoritos" className={icon(pathname === '/favoritos')} aria-label="Favoritos"><Heart aria-hidden className="h-6 w-6" fill="currentColor" /></Link>
        <Soon label="Leitor de QR code" className="-mt-14 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-accent to-[#A86A3A] text-bg shadow-lg ring-8 ring-bg">
          <ScanLine aria-hidden className="h-7 w-7" />
        </Soon>
        <Link to="/cart" className={cn(icon(pathname === '/cart'), 'relative')} aria-label={`Carrinho, ${count} item(ns)`}>
          <ShoppingCart aria-hidden className="h-6 w-6" fill="currentColor" />
          {count > 0 && <span aria-hidden className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg">{count}</span>}
        </Link>
        <Link to={session ? '/account/profile' : '/login'} className={icon(pathname.startsWith('/account'))} aria-label={session ? 'Meu perfil' : 'Entrar'}><UserIcon aria-hidden className="h-6 w-6" fill="currentColor" /></Link>
      </div>
    </nav>
  )
}

function ConnectionBadge() {
  const state = useSyncExternalStore(connection.subscribe, connection.get)
  if (state === 'connected') return <span className="sr-only">Tempo real conectado</span>
  return (
    <div role="status" className="fixed bottom-24 left-4 z-30 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs md:bottom-4">
      <WifiOff aria-hidden className="h-4 w-4 text-warn" />
      {state === 'connecting' ? 'Conectando ao tempo real…' : 'Tempo real desconectado — reconectando…'}
    </div>
  )
}

function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  useEffect(() => onAnnounce((t) => {
    if (t.tone === 'assertive') setAssertive(t.message); else setPolite(t.message)
    setToasts((xs) => [...xs.slice(-2), t])
    window.setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), 5000)
  }), [])
  return (
    <>
      <div className="sr-only" aria-live="polite" data-testid="live-polite">{polite}</div>
      <div className="sr-only" aria-live="assertive" data-testid="live-assertive">{assertive}</div>
      <div aria-hidden className="pointer-events-none fixed bottom-24 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2 md:bottom-16">
        {toasts.map((t) => (
          <div key={t.id} data-testid="toast" className={cn('border-l-4 bg-surface px-4 py-3 text-sm shadow-lg', t.tone === 'assertive' ? 'border-warn' : 'border-accent')}>{t.message}</div>
        ))}
      </div>
    </>
  )
}

/** Rodapé do Figma: destaques W/C/D + newsletter, faixa de contato, colunas de links e copyright. */
function Footer() {
  const [msg, setMsg] = useState('')
  const features = [
    ['W', 'Segurança da carteira', 'Proteja sua carteira e colecione arte digital verificada com confiança.'],
    ['C', 'Criadores em destaque', 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.'],
    ['D', 'Alertas de lançamentos', 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.'],
  ]
  const col = 'flex flex-col gap-3 text-sm'
  return (
    <footer className="pb-28 pt-16 md:pb-6 md:pt-24">
      <div className="container-page">
        <div className="bg-surface">
          <div className="grid gap-8 px-6 py-8 md:grid-cols-2 md:px-12 lg:grid-cols-[1fr_1fr_1fr_1.15fr] lg:gap-0">
            {features.map(([letter, title, text], i) => (
              <div key={letter} className={cn('flex flex-col gap-3 lg:pr-4', i > 0 && 'lg:border-l lg:border-accent lg:pl-4')}>
                <span aria-hidden className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-accent text-2xl font-bold text-bg">{letter}</span>
                <h2 className="text-base font-bold">{title}</h2>
                <p className="text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
            <form className="flex flex-col gap-3 lg:border-l lg:border-accent lg:pl-4" noValidate
              onSubmit={(e) => { e.preventDefault(); setMsg('A newsletter não está disponível nesta demonstração. Nenhum e-mail foi cadastrado.') }}>
              <h2 className="text-base font-bold leading-tight">Antecipe-se ao próximo lançamento</h2>
              <label htmlFor="newsletter" className="sr-only">Seu endereço para a newsletter</label>
              <div className="flex">
                <input id="newsletter" type="email" placeholder="digite seu e-mail..." className="h-10 min-w-0 flex-1 bg-band px-3 text-sm text-ink placeholder:text-hint focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent" />
                <button type="submit" className="h-10 bg-accent px-4 font-bold text-bg hover:bg-price">Enviar</button>
              </div>
              <p className="text-xs leading-relaxed text-muted">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
              <p role="status" className="text-xs text-warn">{msg}</p>
            </form>
          </div>
          <div className="grid gap-4 bg-band px-6 py-6 text-sm md:grid-cols-4 md:items-center md:px-8">
            <Logo className="text-sm" />
            <p>Feito para colecionadores, criadores e cultura</p>
            <a href="mailto:contato@email.com" className="hover:text-price">contato@email.com</a>
            <a href="tel:+551140028922" className="hover:text-price">+55 11 4002 8922</a>
          </div>
          <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
            <div className={col}>
              <h2 className="text-base font-bold">Meu perfil</h2>
              <Link to="/account/profile" className="hover:text-price">Meu perfil</Link>
              <Soon className="hover:text-price">Minha coleção</Soon>
              <Soon className="hover:text-price">Atividade</Soon>
              <Soon className="hover:text-price">Estúdio do criador</Soon>
              <Link to="/favoritos" className="hover:text-price">Lista de interesse</Link>
            </div>
            <div className={col}>
              <h2 className="text-base font-bold">Central de ajuda</h2>
              {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((t) => <Soon key={t} className="hover:text-price">{t}</Soon>)}
            </div>
            <div className={col}>
              <h2 className="text-base font-bold">Coleções</h2>
              {CATEGORIES.filter((c) => ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'utilidade'].includes(c.value)).map((c) => (
                <Link key={c.value} to="/" search={{ category: [c.value] }} hash="mercado" className="hover:text-price">{c.label}</Link>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-bold">Redes sociais</h2>
              <ul className="flex gap-2">
                {([['Facebook', Facebook, 'https://facebook.com'], ['Instagram', Instagram, 'https://instagram.com'], ['X (Twitter)', Twitter, 'https://x.com'], ['LinkedIn', Linkedin, 'https://linkedin.com'], ['YouTube', Youtube, 'https://youtube.com']] as const).map(([name, Icon, url]) => (
                  <li key={name}><a href={url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-accent text-price hover:bg-accent/10" aria-label={`${name} (abre em nova aba)`}><Icon aria-hidden className="h-4 w-4" /></a></li>
                ))}
              </ul>
              <h2 className="text-base font-bold">Carteiras compatíveis</h2>
              <WalletsBadge className="w-fit" />
            </div>
          </div>
        </div>
        <p className="pt-5 text-center text-xs">© 2026 Kurio. Propriedade digital para todos.</p>
      </div>
    </footer>
  )
}

export function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Move o foco para o conteúdo apenas em navegações (não no carregamento inicial).
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } document.getElementById('main')?.focus({ preventScroll: true }) }, [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only-focusable fixed left-4 top-4 z-50 rounded bg-accent px-4 py-2 font-bold text-bg">Pular para o conteúdo</a>
      <Header />
      <main id="main" tabIndex={-1} className="min-h-[100svh] flex-1 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
      <Toaster />
      <ConnectionBadge />
      {MOCKS_ENABLED && <Suspense fallback={null}><MockPanel /></Suspense>}
    </div>
  )
}
