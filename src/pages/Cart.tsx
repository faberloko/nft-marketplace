import { useEffect, useState } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { api } from '@/api/endpoints'
import { cartQuery, useAcknowledgeCart, useQuote, useRemoveCartItem, useUpdateCartItem } from '@/api/queries'
import type { CartItem, Quote } from '@/api/types'
import { Alert, Breadcrumb, Button, Skeleton } from '@/components/ui'
import { MoreFromCollection } from './NftDetail'
import { COUPON_KEY, useDraft } from '@/lib/draft'
import { useSession } from '@/lib/auth'
import { announce } from '@/lib/announcer'
import { formatEth, mulEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function CartPage() {
  const cart = useQuery(cartQuery())
  const session = useSession()
  const navigate = useNavigate()
  const router = useRouter()
  const [draft, setDraft] = useDraft<{ coupon: string | null }>(COUPON_KEY, { coupon: null })
  const items = cart.data?.items ?? []
  const quote = useQuote('ethereum', draft.coupon, items.length > 0)
  const ack = useAcknowledgeCart()
  const changed = items.filter((i) => i.previousPriceEth || i.quantity > i.available)
  useEffect(() => { document.title = 'Carrinho de NFTs — Kurio' }, [])
  useEffect(() => {
    if (quote.error instanceof ApiError && quote.error.code.startsWith('COUPON')) {
      announce(`Cupom removido: ${quote.error.message}`, 'assertive'); setDraft({ coupon: null })
    }
  }, [quote.error, setDraft])
  const goCheckout = () => navigate(session ? { to: '/checkout' } : { to: '/login', search: { redirect: '/checkout', reason: undefined } })
  const blocked = !quote.data || changed.length > 0 || quote.isFetching

  return (
    <div className="container-page pb-40 pt-6 md:pb-0 md:pt-7">
      <div className="mb-5 flex items-center gap-4 md:hidden">
        <button type="button" onClick={() => router.history.back()} aria-label="Voltar" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-price"><ChevronLeft aria-hidden className="h-5 w-5" /></button>
        <h1 className="text-lg">Carrinho de NFTs</h1>
      </div>
      <div className="hidden md:block">
        <Breadcrumb items={[{ label: 'Início', to: <Link to="/" className="hover:text-price">Início</Link> }, { label: 'Mercado', to: <Link to="/" hash="mercado" className="hover:text-price">Mercado</Link> }, { label: 'Carrinho' }]} />
        <h1 className="sr-only">Carrinho de NFTs</h1>
      </div>
      {cart.isError && !cart.data ? (
        <Alert tone="error" className="mt-6" title="Não foi possível carregar o carrinho" action={<Button size="sm" className="w-fit" onClick={() => cart.refetch()}>Tentar novamente</Button>}>{cart.error.message}</Alert>
      ) : !cart.data ? (
        <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_332px]" data-testid="cart-skeleton">
          <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[70px] w-full" />)}</div>
          <Skeleton className="h-80 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Alert tone="info" className="mt-6" title="Seu carrinho está vazio" action={<Button asChild size="sm" className="w-fit"><Link to="/" hash="mercado">Explorar NFTs</Link></Button>} />
      ) : (
        <div className="mt-1 grid gap-10 lg:grid-cols-[1fr_332px] lg:gap-[86px]">
          <div className="flex flex-col gap-3">
            {changed.length > 0 && (
              <Alert tone="warn" title="Preço ou disponibilidade mudaram" action={<Button size="sm" className="w-fit" disabled={ack.isPending} onClick={() => ack.mutate(undefined)}>Aceitar valores atuais</Button>}>
                <ul className="list-disc pl-5">{changed.map((i) => (
                  <li key={i.editionId}>{i.name} ({i.editionLabel}): {i.previousPriceEth ? `${formatEth(i.previousPriceEth, 2)} → ${formatEth(i.unitPriceEth, 2)}` : ''}{i.quantity > i.available ? ` disponível: ${i.available}` : ''}</li>
                ))}</ul>
              </Alert>
            )}
            <div className="hidden grid-cols-[minmax(0,1fr)_120px_130px_120px_40px] gap-2 border-b border-line pb-3 text-sm font-bold md:grid" aria-hidden>
              <span>NFTs</span><span>Preço</span><span>Edições</span><span>Total</span><span />
            </div>
            <ul className="flex flex-col gap-3" aria-label="Itens do carrinho">
              {items.map((i) => <CartLine key={i.editionId} item={i} />)}
            </ul>
          </div>
          <aside aria-labelledby="summary-title" className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-4 rounded-t-[28px] bg-surface px-6 pb-6 pt-6 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] md:static md:rounded-none md:bg-transparent md:p-0 md:shadow-none">
            <h2 id="summary-title" className="hidden border-b border-line pb-3 text-base md:block">Resumo da carteira</h2>
            <CouponForm coupon={draft.coupon} onApply={(c) => setDraft({ coupon: c })} />
            {quote.isError && !(quote.error instanceof ApiError && quote.error.code.startsWith('COUPON')) && (
              <Alert tone="error" title="Não foi possível calcular o resumo" action={<Button size="sm" className="w-fit" onClick={() => quote.refetch()}>Tentar novamente</Button>} />
            )}
            <Totals quote={quote.data} loading={!quote.data} />
            {quote.isFetching && quote.data && <p className="text-xs text-muted" role="status">Atualizando valores…</p>}
            <Button className="h-10 w-full max-md:h-14 max-md:rounded-full max-md:bg-gradient-to-r max-md:from-accent max-md:to-[#A86A3A]" disabled={blocked} onClick={goCheckout}>
              {session ? 'Conectar e finalizar' : 'Entrar para finalizar'}
            </Button>
            {changed.length > 0 && <p className="text-xs text-warn">Aceite os valores atualizados para continuar.</p>}
            <Link to="/" hash="mercado" className="hidden text-center text-sm text-price hover:underline md:block">Continuar explorando</Link>
          </aside>
        </div>
      )}
      <div className="hidden md:block"><MoreFromCollection title="Colecionadores também viram" /></div>
    </div>
  )
}

/** Resumo de valores exatamente como a API retornou (a cotação é a referência). */
export function Totals({ quote, loading }: { quote?: Quote; loading?: boolean }) {
  const v = (s?: string) => (quote && !loading ? s : undefined)
  return (
    <dl className="flex flex-col gap-3 text-sm" aria-busy={loading}>
      <div className="flex justify-between gap-4"><dt>Subtotal</dt><dd className="text-base" data-testid="summary-subtotal">{v(quote?.subtotalEth) ? formatEth(quote!.subtotalEth, 3) : <Skeleton className="h-5 w-24" />}</dd></div>
      <div className="flex justify-between gap-4">
        <dt>{quote?.coupon ? `Desconto (${quote.coupon.code})` : 'Desconto do lançamento'}</dt>
        <dd data-testid="summary-discount">{v(quote?.discountEth) ? `(-) ${formatEth(quote!.discountEth, 3)}` : <Skeleton className="h-5 w-20" />}</dd>
      </div>
      <div className="flex flex-col items-end">
        <div className="flex w-full justify-between gap-4"><dt>Taxa de rede</dt><dd className="text-base" data-testid="summary-fee">{v(quote?.networkFeeEth) ? formatEth(quote!.networkFeeEth, 3) : <Skeleton className="h-5 w-20" />}</dd></div>
        <span className="text-[11px] text-price">Taxa estimada</span>
      </div>
      <div className="flex justify-between gap-4 pt-2 text-base font-bold">
        <dt>Total</dt><dd className="text-price" data-testid="summary-total">{v(quote?.totalEth) ? formatEth(quote!.totalEth, 8) : <Skeleton className="h-6 w-28" />}</dd>
      </div>
    </dl>
  )
}

function CartLine({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const cap = Math.min(item.available, item.maxPerOrder)
  const busy = update.isPending || remove.isPending
  const step = 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-sm font-bold text-bg disabled:opacity-40 max-md:h-7 max-md:w-7 max-md:bg-bg/70 max-md:text-ink'
  return (
    <li className="grid grid-cols-[96px_1fr] items-center gap-3 overflow-hidden rounded-[12px] bg-surface pr-3 md:grid-cols-[minmax(0,1fr)_120px_130px_120px_40px] md:gap-2 md:rounded-none md:pr-0" data-testid="cart-line">
      <div className="row-span-2 flex items-center gap-4 md:row-span-1">
        <img src={item.image} alt={`Arte do NFT ${item.name}`} width={70} height={70} className="h-24 w-24 object-cover md:h-[70px] md:w-[70px]" />
        <div className="hidden flex-col md:flex">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="text-sm font-bold hover:text-price">{item.name}</Link>
          <span className="text-xs text-muted">ID do token: {item.tokenId} · Edição {item.editionLabel}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 py-3 md:hidden">
        <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="text-sm font-bold">{item.name}</Link>
        <span className="text-xs text-muted">Edição: {item.editionLabel}</span>
      </div>
      <p className="hidden text-sm font-bold text-price md:block">{formatEth(item.unitPriceEth, 2)}</p>
      <div className="col-start-2 flex items-center justify-between pb-3 md:col-start-auto md:pb-0">
        <p className="text-base font-bold text-price md:hidden">{formatEth(mulEth(item.unitPriceEth, item.quantity), 2)}</p>
        <div className="flex items-center gap-3" role="group" aria-label={`Quantidade de ${item.name}`}>
          <button type="button" className={step} aria-label="Diminuir" disabled={busy || item.quantity <= 1} onClick={() => update.mutate({ editionId: item.editionId, quantity: item.quantity - 1 })}>−</button>
          <output className="min-w-4 text-center text-sm" data-testid="line-qty">{item.quantity}</output>
          <button type="button" className={step} aria-label="Aumentar" disabled={busy || item.quantity >= cap} onClick={() => update.mutate({ editionId: item.editionId, quantity: item.quantity + 1 })}>+</button>
          <button type="button" className="ml-1 text-price md:hidden" aria-label={`Remover ${item.name}`} disabled={busy} onClick={() => remove.mutate(item.editionId)}><Trash2 aria-hidden className="h-4 w-4" /></button>
        </div>
      </div>
      <p className="hidden text-sm font-bold text-price md:block">{formatEth(mulEth(item.unitPriceEth, item.quantity), 2)}</p>
      <button type="button" className="hidden h-8 w-8 items-center justify-center text-price hover:text-ink md:flex" aria-label={`Remover ${item.name}`} disabled={busy} onClick={() => remove.mutate(item.editionId)}>
        <Trash2 aria-hidden className="h-5 w-5" />
      </button>
      {(update.error || remove.error) && <p role="alert" className="col-span-full px-3 pb-2 text-xs text-danger">{((update.error ?? remove.error) as Error).message}</p>}
    </li>
  )
}

/** Campo “Código promocional” + Aplicar (desktop retangular, mobile em pílula como no Figma). */
export function CouponForm({ coupon, onApply, compact }: { coupon: string | null; onApply: (c: string | null) => void; compact?: boolean }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-2 border border-field px-3 py-2 text-sm" role="status">
        <span>Cupom <strong className="text-price">{coupon}</strong> aplicado</span>
        <button type="button" className="text-xs font-bold text-price hover:underline" onClick={() => { onApply(null); announce('Cupom removido.') }}>Remover cupom</button>
      </div>
    )
  }
  return (
    <form className="flex flex-col gap-2" noValidate onSubmit={async (e) => {
      e.preventDefault()
      const c = code.trim().toUpperCase()
      if (!c) { setError('Informe um código.'); return }
      setPending(true); setError(undefined)
      try { await api.quote({ network: 'ethereum', coupon: c }); onApply(c); setCode(''); announce(`Cupom ${c} aplicado.`) }
      catch (err) { setError((err as ApiError).fields?.coupon ?? (err as Error).message) }
      finally { setPending(false) }
    }}>
      <label htmlFor="coupon" className={cn('text-xs font-bold', compact ? 'sr-only' : 'max-md:sr-only')}>Código promocional</label>
      <div className="flex max-md:rounded-full max-md:border max-md:border-field max-md:p-1">
        <input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Digite o código promocional..." autoComplete="off"
          aria-invalid={!!error} aria-describedby={error ? 'coupon-error' : undefined}
          className="h-10 min-w-0 flex-1 border border-field bg-bg px-3 text-xs text-ink placeholder:text-hint focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent aria-[invalid=true]:border-danger max-md:border-0 max-md:bg-transparent" />
        <button type="submit" disabled={pending} className="h-10 bg-accent px-5 text-sm font-bold text-bg hover:bg-price disabled:opacity-60 max-md:rounded-full max-md:bg-gradient-to-r max-md:from-accent max-md:to-[#A86A3A]">
          {pending ? 'Validando…' : 'Aplicar'}
        </button>
      </div>
      {error && <p id="coupon-error" role="alert" className="text-xs text-danger">⚠ {error}</p>}
    </form>
  )
}
