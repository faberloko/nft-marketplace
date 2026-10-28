import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, MoreVertical, Wallet as WalletIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { api } from '@/api/endpoints'
import { cartQuery, keys, useAcknowledgeCart, useQuote } from '@/api/queries'
import { NETWORKS, WALLET_PROVIDERS, type Collector, type Network, type Order, type Quote, type Wallet, type WalletProvider } from '@/api/types'
import { Alert, Breadcrumb, Button, Dialog, DialogContent, Field, Input, NativeSelect, Skeleton, Textarea, WalletsBadge } from '@/components/ui'
import { CouponForm, Totals } from './Cart'
import { useSession } from '@/lib/auth'
import { announce } from '@/lib/announcer'
import { CHECKOUT_KEY, COUPON_KEY, useDraft } from '@/lib/draft'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

type Draft = Collector & { walletId: string; network: Network; provider: WalletProvider | '' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

/** Chave de idempotência estável por cotação: reenvios (clique repetido, timeout, refresh) recuperam o mesmo pedido. */
function idemKey(quoteId: string) {
  const k = `nft-idem:${quoteId}`
  try {
    let v = sessionStorage.getItem(k)
    if (!v) { v = crypto.randomUUID(); sessionStorage.setItem(k, v) }
    return v
  } catch { return quoteId }
}

export function validateCollector(d: Draft) {
  const e: Partial<Record<keyof Draft, string>> = {}
  if (!d.displayName.trim()) e.displayName = 'Informe o nome de exibição.'
  if (!/^[a-z0-9_]{3,20}$/.test(d.username)) e.username = 'Use 3–20 letras minúsculas, números ou _.'
  if (!d.network) e.network = 'Selecione uma rede.'
  if (!d.profileName.trim()) e.profileName = 'Informe o nome do perfil.'
  if (!d.walletId) e.walletId = 'Selecione uma carteira cadastrada.'
  if (!d.referralCode.trim()) e.referralCode = 'Informe o código de indicação.'
  if (!EMAIL.test(d.email.trim())) e.email = 'Informe um e-mail válido.'
  if (!/^[a-z0-9-]{3,30}$/.test(d.ensName)) e.ensName = 'Use 3–30 letras minúsculas, números ou hífen.'
  if (!d.provider) e.provider = 'Escolha a carteira para conectar.'
  return e
}

export function CheckoutPage() {
  const session = useSession()!
  const qc = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const [draft, setDraft] = useDraft<Draft>(CHECKOUT_KEY, {
    displayName: session.user.name, username: session.user.username, profileName: session.user.username, email: session.user.email,
    ensName: session.user.ensName, referralCode: '', note: '', walletId: '', network: 'ethereum', provider: '',
  })
  const [coupon, setCoupon] = useDraft<{ coupon: string | null }>(COUPON_KEY, { coupon: null })
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [connected, setConnected] = useState<{ walletId: string; network: Network; provider: WalletProvider } | null>(null)
  const [staleQuote, setStaleQuote] = useState<Quote | null>(null)
  const [review, setReview] = useState(false)
  const [showCoupon, setShowCoupon] = useState(!!coupon.coupon)
  const cart = useQuery(cartQuery())
  const wallets = useQuery({ queryKey: keys.wallets(session.user.id), queryFn: ({ signal }) => api.wallets(signal) })
  const pending = useQuery({ queryKey: keys.pendingOrders(session.user.id), queryFn: ({ signal }) => api.orders('pending', signal) })
  const hasItems = (cart.data?.items.length ?? 0) > 0
  const quote = useQuote(draft.network, coupon.coupon, hasItems)
  const ack = useAcknowledgeCart()
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const wallet = wallets.data?.find((w) => w.id === draft.walletId)
  useEffect(() => { document.title = 'Pagamento — Kurio' }, [])
  // Pré-preenche com a carteira principal cadastrada (dados do frame "Carteiras").
  useEffect(() => {
    if (draft.walletId || !wallets.data?.length) return
    pickWallet((wallets.data.find((w) => w.kind === 'primary') ?? wallets.data[0]))
  }, [wallets.data, draft.walletId]) // eslint-disable-line react-hooks/exhaustive-deps
  function pickWallet(w: Wallet) {
    setDraft((d) => ({ ...d, walletId: w.id, network: w.network, referralCode: d.referralCode || w.referralCode, ensName: d.ensName || w.ensName, profileName: d.profileName || w.profileName }))
    setConnected(null)
  }

  const connect = useMutation({
    mutationFn: (provider: WalletProvider) => api.connectWallet(draft.walletId, draft.network, provider).then(() => provider),
    onSuccess: (provider) => { setConnected({ walletId: draft.walletId, network: draft.network, provider }); announce(`${WALLET_PROVIDERS.find((p) => p.value === provider)?.label} conectada.`) },
    onError: (e) => announce((e as Error).message, 'assertive'),
  })
  const isConnected = !!connected && connected.walletId === draft.walletId && connected.network === draft.network && connected.provider === draft.provider
  const chooseProvider = (p: WalletProvider) => { set('provider', p); if (draft.walletId) connect.mutate(p) }

  const inflight = useRef(false)
  const submit = useMutation({
    mutationFn: async (q: Quote) => {
      const { walletId, network, provider, ...collector } = draft
      const body = { quoteId: q.id, walletId, network, provider: provider as WalletProvider, collector: { ...collector, email: collector.email.trim() } }
      const key = idemKey(q.id)
      // Timeout/queda de rede: reenvia com a MESMA chave, recuperando o pedido já criado em vez de duplicar.
      for (let attempt = 0; ; attempt++) {
        try { return await api.createOrder(body, key) } catch (e) {
          if (e instanceof ApiError && (e.code === 'TIMEOUT' || e.code === 'NETWORK') && attempt < 2) { announce('Sem resposta do servidor; verificando o pedido…'); continue }
          throw e
        }
      }
    },
    onSuccess: (order: Order) => {
      qc.setQueryData(keys.order(session.user.id, order.id), order)
      navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.code === 'QUOTE_STALE' || e.code === 'OUT_OF_STOCK')) {
        setStaleQuote((e.details as { quote: Quote | null })?.quote ?? null)
        qc.invalidateQueries({ queryKey: keys.cart(`user:${session.user.id}`) })
      }
      if (e instanceof ApiError && e.fields) setErrors(e.fields as typeof errors)
      announce((e as Error).message, 'assertive')
    },
    onSettled: () => { inflight.current = false },
  })

  const openReview = () => {
    const e = validateCollector(draft)
    if (!e.provider && !isConnected) e.provider = 'Conecte a carteira escolhida na rede selecionada.'
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) { document.getElementById(`co-${first}`)?.focus(); announce('Revise os campos destacados.', 'assertive'); return }
    setReview(true)
  }
  const q = quote.data
  const blocked = !q || quote.isFetching || q.issues.length > 0 || q.lines.length === 0
  const err = (k: keyof Draft) => errors[k]

  if (cart.data && !hasItems) {
    return <div className="container-page py-10"><h1 className="mb-6 text-xl">Pagamento</h1>
      {pending.data?.length ? <PendingBanner orders={pending.data} /> : null}
      <Alert tone="info" title="Seu carrinho está vazio" action={<Button asChild size="sm" className="w-fit"><Link to="/" hash="mercado">Voltar ao mercado</Link></Button>} /></div>
  }

  const providerList = (
    <fieldset className="flex flex-col gap-3" aria-describedby={err('provider') ? 'co-provider-error' : undefined}>
      <legend className="mb-3 w-full text-center text-base font-bold max-md:text-left">Carteira e rede</legend>
      {WALLET_PROVIDERS.map((p) => {
        const on = draft.provider === p.value
        return (
          <label key={p.value} className={cn('flex cursor-pointer items-center gap-4 border px-4 py-3 text-sm focus-within:ring-2 focus-within:ring-price max-md:rounded-[16px] max-md:border-0 max-md:bg-surface',
            on ? 'border-ink max-md:ring-1 max-md:ring-accent' : 'border-field')}>
            <input type="radio" name="provider" id={p.value === 'walletconnect' ? 'co-provider' : undefined} value={p.value} checked={on} onChange={() => chooseProvider(p.value)}
              className="h-4 w-4 accent-[#D28A4C] md:order-none max-md:order-last" />
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-sm font-bold text-price md:hidden">{p.value === 'coinbase' ? <WalletIcon className="h-4 w-4" /> : p.label[0]}</span>
            {p.value === 'walletconnect' ? <><WalletsBadge className="max-md:hidden" /><span className="md:sr-only">{p.label}</span></> : <span>{p.label}</span>}
            {on && (connect.isPending ? <span className="ml-auto text-xs text-muted">Conectando…</span>
              : isConnected ? <span className="ml-auto text-xs text-success">✓ Conectada</span>
                : connect.isError ? <span className="ml-auto text-xs text-danger">✕ Recusada</span> : null)}
          </label>
        )
      })}
      {connect.isError && !isConnected && <p className="text-xs text-danger" role="alert">✕ {(connect.error as Error).message} <button type="button" className="font-bold underline" onClick={() => draft.provider && connect.mutate(draft.provider)}>Tentar de novo</button></p>}
      {isConnected && <button type="button" className="w-fit text-xs font-bold text-price hover:underline" onClick={() => { setConnected(null); announce('Carteira desconectada.') }}>Desconectar carteira</button>}
      {err('provider') && <p id="co-provider-error" role="alert" className="text-xs text-danger">⚠ {err('provider')}</p>}
    </fieldset>
  )

  return (
    <div className="container-page pb-32 pt-6 md:pb-0 md:pt-7">
      <div className="mb-5 flex items-center gap-4 md:hidden">
        <button type="button" onClick={() => router.history.back()} aria-label="Voltar" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-price"><ChevronLeft aria-hidden className="h-5 w-5" /></button>
        <h1 className="text-lg">Pagamento com carteira</h1>
      </div>
      <div className="hidden md:block">
        <Breadcrumb items={[{ label: 'Início', to: <Link to="/" className="hover:text-price">Início</Link> }, { label: 'Mercado', to: <Link to="/" hash="mercado" className="hover:text-price">Mercado</Link> }, { label: 'Pagamento' }]} />
        <h1 className="sr-only">Pagamento</h1>
      </div>
      {pending.data?.length ? <div className="mt-4"><PendingBanner orders={pending.data} /></div> : null}

      {/* Carteiras cadastradas (frame mobile “Carteira conectada”) */}
      <section aria-labelledby="mw-title" className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between"><h2 id="mw-title" className="text-sm font-bold">Carteira conectada</h2><Link to="/account/wallets" className="text-xs font-bold text-price">Trocar carteira</Link></div>
        {wallets.isPending ? <Skeleton className="h-24 w-full" /> : wallets.data?.map((w) => (
          <label key={w.id} className={cn('flex cursor-pointer items-start gap-4 rounded-[16px] bg-surface p-4 focus-within:ring-2 focus-within:ring-price', draft.walletId === w.id && 'ring-1 ring-accent')}>
            <input type="radio" name="m-wallet" className="mt-1 h-4 w-4 accent-[#D28A4C]" checked={draft.walletId === w.id} onChange={() => pickWallet(w)} />
            <span className="flex flex-1 flex-col gap-1 text-xs text-muted"><span className="text-sm font-bold text-ink">{w.nickname}</span>{w.secondaryAddress || short(w.address)}<span>Rede {NETWORKS.find((n) => n.value === w.network)?.label}</span></span>
            <MoreVertical aria-hidden className="h-4 w-4 text-price" />
          </label>
        ))}
      </section>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_405px] lg:gap-8">
        <form noValidate onSubmit={(e) => { e.preventDefault(); openReview() }} className="flex flex-col gap-6 max-md:order-2" aria-labelledby="collector-title">
          <h2 id="collector-title" className="text-base">Perfil do colecionador</h2>
          {wallets.data?.length === 0 && <Alert tone="warn" title="Nenhuma carteira cadastrada" action={<Button asChild size="sm" className="w-fit"><Link to="/account/wallets">Cadastrar carteira</Link></Button>} />}
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <Field id="co-displayName" label="Nome de exibição" required error={err('displayName')}>{(a) => <Input {...a} autoComplete="name" value={draft.displayName} onChange={(e) => set('displayName', e.target.value)} />}</Field>
            <Field id="co-username" label="Nome de usuário" required error={err('username')}>{(a) => <Input {...a} autoComplete="username" value={draft.username} onChange={(e) => set('username', e.target.value)} />}</Field>
            <Field id="co-network" label="Rede" required error={err('network')}>{(a) => (
              <NativeSelect {...a} value={draft.network} onChange={(e) => { set('network', e.target.value as Network); setConnected(null) }}>
                <option value="" disabled>Selecione uma rede</option>{NETWORKS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </NativeSelect>)}
            </Field>
            <Field id="co-profileName" label="Nome do perfil" required error={err('profileName')}>{(a) => <Input {...a} value={draft.profileName} onChange={(e) => set('profileName', e.target.value)} />}</Field>
            <Field id="co-address" label="Endereço da carteira" required>{(a) => <Input {...a} readOnly value={wallet?.address ?? ''} placeholder="Endereço 0x da carteira" className="text-hint" />}</Field>
            <Field id="co-secondary" label="ENS ou carteira secundária (opcional)" hideLabel>{(a) => <div className="sm:pt-7"><Input {...a} readOnly value={wallet?.secondaryAddress ?? ''} placeholder="ENS ou carteira secundária (opcional)" /></div>}</Field>
            <Field id="co-walletId" label="Tipo de carteira" required error={err('walletId')}>{(a) => (
              <NativeSelect {...a} value={draft.walletId} onChange={(e) => { const w = wallets.data?.find((x) => x.id === e.target.value); if (w) pickWallet(w) }}>
                <option value="" disabled>Selecione uma carteira</option>
                {wallets.data?.map((w) => <option key={w.id} value={w.id}>{w.kind === 'primary' ? 'Principal' : 'Secundária'} — {w.nickname} ({short(w.address)})</option>)}
              </NativeSelect>)}
            </Field>
            <Field id="co-referralCode" label="Código de indicação" required error={err('referralCode')}>{(a) => <Input {...a} value={draft.referralCode} onChange={(e) => set('referralCode', e.target.value)} />}</Field>
            <Field id="co-email" label="E-mail" required error={err('email')}>{(a) => <Input {...a} type="email" autoComplete="email" value={draft.email} onChange={(e) => set('email', e.target.value)} />}</Field>
            <Field id="co-ensName" label="Nome ENS" required error={err('ensName')}>{(a) => (
              <div className="flex gap-2"><span className="flex h-10 items-center border border-field px-3 text-sm" aria-hidden>.eth</span><Input {...a} value={draft.ensName} onChange={(e) => set('ensName', e.target.value.toLowerCase())} /></div>)}
            </Field>
          </div>
          {wallets.data && wallets.data.length > 1 && (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded-full accent-[#D28A4C]" checked={wallet?.kind === 'secondary'}
                onChange={(e) => { const w = wallets.data!.find((x) => x.kind === (e.target.checked ? 'secondary' : 'primary')); if (w) pickWallet(w) }} />
              Usar outra carteira?
            </label>
          )}
          <Field id="co-note" label="Observação do colecionador (opcional)" error={err('note')}>{(a) => <Textarea {...a} className="max-w-[350px]" maxLength={500} value={draft.note} onChange={(e) => set('note', e.target.value)} />}</Field>
          <button type="submit" className="sr-only">Revisar pedido</button>
        </form>

        <aside aria-labelledby="your-nfts" className="flex flex-col gap-4 max-md:order-1">
          <h2 id="your-nfts" className="text-base max-md:sr-only">Seus NFTs</h2>
          <div className="hidden justify-between text-sm font-bold md:flex" aria-hidden><span>NFTs</span><span>Subtotal</span></div>
          <ul className="hidden flex-col gap-2 md:flex">
            {q ? q.lines.map((l) => (
              <li key={l.editionId} className="flex items-center gap-3 bg-surface pr-4">
                <img src={l.image} alt="" width={70} height={70} className="h-[70px] w-[70px] object-cover" />
                <span className="flex flex-1 flex-col text-sm"><span className="font-bold">{l.name}</span><span className="text-xs text-muted">ID do token: {l.tokenId}</span>
                  {l.issue && <span className="text-xs text-warn">! {l.issue === 'PRICE_CHANGED' ? 'Preço alterado' : l.issue === 'SOLD_OUT' ? 'Esgotado' : `Apenas ${l.available} disponível(is)`}</span>}</span>
                <span className="text-xs text-muted">(x {l.quantity})</span>
                <span className="text-base font-bold text-price">{formatEth(l.lineTotalEth, 2)}</span>
              </li>
            )) : [0, 1].map((i) => <Skeleton key={i} className="h-[70px] w-full" />)}
          </ul>
          <div className="hidden md:block">
            {showCoupon ? <CouponForm coupon={coupon.coupon} onApply={(c) => setCoupon({ coupon: c })} />
              : <button type="button" className="w-full text-center text-sm hover:text-price" onClick={() => setShowCoupon(true)}>Tem um código promocional? Aplique aqui</button>}
          </div>
          <div className="hidden md:block"><Totals quote={q} loading={!q} /></div>
          {quote.isFetching && q && <p role="status" className="text-xs text-muted">Revalidando preços, estoque e taxas…</p>}
          {quote.isError && <Alert tone="error" title="Falha ao cotar" action={<Button size="sm" className="w-fit" onClick={() => quote.refetch()}>Tentar novamente</Button>}>{quote.error.message}</Alert>}
          {(q?.issues.length || staleQuote) ? (
            <Alert tone="warn" title="A cotação mudou — confirme novamente" action={
              <Button size="sm" className="w-fit" disabled={ack.isPending} onClick={() => ack.mutate(undefined, { onSuccess: () => { setStaleQuote(null); submit.reset() } })}>Aceitar novos valores</Button>}>
              <ul className="list-disc pl-5">{(q?.issues.length ? q.issues : staleQuote?.issues ?? []).map((i) => <li key={i}>{i}</li>)}</ul>
              {!q?.issues.length && !staleQuote?.issues.length && <p>Taxas ou totais foram atualizados.</p>}
            </Alert>
          ) : null}
          {providerList}
          <p className="flex items-center justify-end gap-6 text-base font-bold md:hidden">Total: <span className="text-xl text-price">{q ? formatEth(q.totalEth, 3) : '…'}</span></p>
          {submit.isError && !(submit.error instanceof ApiError && ['QUOTE_STALE', 'OUT_OF_STOCK', 'VALIDATION'].includes(submit.error.code)) && (
            <Alert tone="error" title="Não foi possível enviar o pedido" action={<Button size="sm" className="w-fit" onClick={() => q && submit.mutate(q)}>Tentar novamente</Button>}>
              {(submit.error as Error).message} Seus itens continuam no carrinho. Um novo envio reaproveita a mesma tentativa — não haverá cobrança duplicada.
            </Alert>
          )}
          <Button className="h-11 w-full text-base max-md:fixed max-md:inset-x-6 max-md:bottom-6 max-md:z-30 max-md:h-14 max-md:w-auto max-md:rounded-full max-md:bg-gradient-to-r max-md:from-accent max-md:to-[#A86A3A]"
            disabled={blocked || !!staleQuote || submit.isPending} onClick={openReview}>
            {submit.isPending ? 'Enviando pedido…' : 'Confirmar compra'}
          </Button>
        </aside>
      </div>

      <Dialog open={review} onOpenChange={(v) => { if (!submit.isPending) setReview(v) }}>
        <DialogContent title="Revise antes de confirmar" description="Confira os itens, a carteira e o total. A cotação foi recalculada agora.">
          <dl className="grid gap-2 border-y border-line py-3 text-xs sm:grid-cols-2">
            <div><dt className="text-muted">Colecionador</dt><dd>{draft.displayName} · {draft.email}</dd></div>
            <div><dt className="text-muted">Carteira</dt><dd>{WALLET_PROVIDERS.find((p) => p.value === draft.provider)?.label} · {short(wallet?.address ?? '')}</dd></div>
            <div><dt className="text-muted">Rede</dt><dd>{NETWORKS.find((n) => n.value === draft.network)?.label}</dd></div>
            <div><dt className="text-muted">ENS</dt><dd>{draft.ensName}.eth</dd></div>
          </dl>
          <ul className="flex flex-col gap-2 text-sm" aria-label="Itens">
            {q?.lines.map((l) => <li key={l.editionId} className="flex justify-between gap-2"><span>{l.name} <span className="text-muted">({l.editionLabel}) × {l.quantity}</span></span><span className="text-price">{formatEth(l.lineTotalEth, 2)}</span></li>)}
          </ul>
          <Totals quote={q} loading={!q} />
          {(q?.issues.length || staleQuote) ? <p role="alert" className="text-xs text-warn">A cotação mudou. Feche, aceite os novos valores e revise novamente.</p> : null}
          <Button className="h-11" disabled={blocked || !!staleQuote || submit.isPending}
            onClick={() => { if (inflight.current || !q) return; inflight.current = true; submit.mutate(q, { onError: () => setReview(false) }) }}>
            {submit.isPending ? 'Enviando pedido…' : `Confirmar e pagar · ${q ? formatEth(q.totalEth, 8) : ''}`}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PendingBanner({ orders }: { orders: Order[] }) {
  return (
    <Alert tone="info" title="Você tem pedido(s) aguardando confirmação">
      <ul>{orders.map((o) => <li key={o.id}><Link to="/orders/$orderId" params={{ orderId: o.id }} className="text-price underline">Acompanhar pedido {o.id}</Link></li>)}</ul>
    </Alert>
  )
}
