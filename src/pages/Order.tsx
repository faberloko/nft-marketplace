import { useEffect } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X, XCircle } from 'lucide-react'
import { ApiError } from '@/api/client'
import { api } from '@/api/endpoints'
import { keys } from '@/api/queries'
import { NETWORKS, WALLET_PROVIDERS } from '@/api/types'
import { Alert, Button, Skeleton } from '@/components/ui'
import { NotFound } from './NotFound'
import { useSession } from '@/lib/auth'
import { formatEth } from '@/lib/eth'

const route = getRouteApi('/authed/orders/$orderId')
const short = (h: string) => `${h.slice(0, 6).toUpperCase().replace('0X', '0x')}…${h.slice(-4).toUpperCase()}`

/** Cartão central do frame “Confirmação de Pedido” (fundo escuro, borda inferior laranja). */
function Card({ children, labelledBy }: { children: React.ReactNode; labelledBy: string }) {
  return (
    <section aria-labelledby={labelledBy} className="relative mx-auto w-full max-w-[578px] border-b-[10px] border-accent bg-surface">
      <Link to="/" className="absolute right-5 top-5 rounded p-1 text-price hover:bg-white/5" aria-label="Fechar e voltar ao início"><X aria-hidden className="h-5 w-5" /></Link>
      {children}
    </section>
  )
}

export function OrderPage() {
  const { orderId } = route.useParams()
  const session = useSession()!
  // order.updated (socket) é o caminho principal; o polling lento é a reconciliação de segurança enquanto pendente.
  const q = useQuery({
    queryKey: keys.order(session.user.id, orderId), queryFn: ({ signal }) => api.order(orderId, signal),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
    retry: (n, e) => !(e instanceof ApiError && e.code === 'NOT_FOUND') && n < 2,
  })
  const o = q.data
  useEffect(() => { document.title = o?.status === 'confirmed' ? 'Pedido confirmado — Kurio' : 'Pedido — Kurio' }, [o?.status])
  if (q.error instanceof ApiError && q.error.code === 'NOT_FOUND') return <NotFound title="Pedido não encontrado" message="Este pedido não existe ou pertence a outra conta." />
  if (!o) return q.isError
    ? <div className="container-page py-16"><Alert tone="error" title="Falha ao carregar o pedido" action={<Button size="sm" className="w-fit" onClick={() => q.refetch()}>Tentar novamente</Button>}>{q.error.message}</Alert></div>
    : <div className="container-page py-16"><Skeleton className="mx-auto h-[600px] w-full max-w-[578px]" /></div>

  const provider = WALLET_PROVIDERS.find((p) => p.value === o.walletProvider)?.label ?? 'Carteira'
  const network = NETWORKS.find((n) => n.value === o.network)?.label

  return (
    <div className="container-page py-10 md:py-[110px]">
      {o.status === 'pending' && (
        <Card labelledBy="order-title">
          <div role="status" className="flex flex-col items-center gap-4 px-8 py-16 text-center">
            <Loader2 aria-hidden className="h-12 w-12 animate-spin text-price motion-reduce:animate-none" />
            <h1 id="order-title" className="text-lg">Aguardando confirmação</h1>
            <p className="max-w-sm text-sm text-muted">Estamos aguardando a rede {network} confirmar o pagamento. Você pode recarregar ou sair desta página — o pedido não será duplicado.</p>
          </div>
        </Card>
      )}
      {o.status === 'declined' && (
        <Card labelledBy="order-title">
          <div className="flex flex-col items-center gap-4 px-8 py-14 text-center">
            <XCircle aria-hidden className="h-12 w-12 text-danger" />
            <h1 id="order-title" className="text-lg">Pagamento recusado</h1>
            <Alert tone="error" title="O pedido não foi concluído" className="text-left">{o.declineReason} Seus itens continuam no carrinho.</Alert>
            <Button asChild className="h-11"><Link to="/cart">Voltar ao carrinho</Link></Button>
          </div>
        </Card>
      )}
      {o.status === 'confirmed' && (
        <Card labelledBy="order-title">
          <div className="flex flex-col items-center gap-4 px-8 pb-5 pt-6 text-center">
            <img src="/nfts/kurio/thank-you.png" alt="" width={68} height={80} />
            <h1 id="order-title" className="text-base text-muted">Seus NFTs agora estão na sua carteira</h1>
            <p className="sr-only">Pedido confirmado</p>
          </div>
          <dl className="grid grid-cols-2 gap-y-3 border-y border-accent px-6 py-4 text-sm sm:grid-cols-4 sm:px-9">
            {[['ID da transação', short(o.txHash ?? ''), 'tx-hash-short'], ['Data', new Date(o.settledAt ?? o.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }), 'date'],
              ['Total', formatEth(o.quote.totalEth, 3), 'total'], ['Carteira', provider, 'wallet']].map(([k, v, id], i) => (
              <div key={id} className={i > 0 ? 'sm:border-l sm:border-accent sm:pl-4' : ''}>
                <dt className={i === 0 || i === 3 ? 'font-bold text-muted' : 'text-muted'}>{k}</dt><dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-3 px-6 py-6 sm:px-11">
            <h2 className="text-sm font-bold">Detalhes da transação</h2>
            <div className="grid grid-cols-[1fr_80px_100px] border-b border-line pb-2 text-sm font-bold" aria-hidden><span>NFTs</span><span className="text-center">Edições</span><span className="text-right">Subtotal</span></div>
            <ul className="flex flex-col gap-3" aria-label="Itens comprados">
              {o.quote.lines.map((l) => (
                <li key={l.editionId} className="grid grid-cols-[1fr_80px_100px] items-center gap-2">
                  <span className="flex items-center gap-3">
                    <img src={l.image} alt="" width={70} height={70} className="h-[66px] w-[66px] rounded-[4px] object-cover" />
                    <span className="flex flex-col text-sm"><span className="font-bold">{l.name}</span><span className="text-xs text-muted">ID do token: {l.tokenId}</span></span>
                  </span>
                  <span className="text-center text-sm text-muted">(x {l.quantity})</span>
                  <span className="text-right text-base font-bold text-price">{formatEth(l.lineTotalEth, 2)}</span>
                </li>
              ))}
            </ul>
            {/* Snapshot imutável: valores vêm do pedido, nunca do catálogo atual. */}
            <dl className="ml-auto grid w-full max-w-[320px] grid-cols-[1fr_auto] gap-2 border-b border-line pb-3 text-sm">
              {o.quote.coupon && <><dt>Desconto ({o.quote.coupon.code})</dt><dd className="text-right">(-) {formatEth(o.quote.discountEth, 3)}</dd></>}
              <dt>Taxa de rede</dt><dd className="text-right text-base" data-testid="summary-fee">{formatEth(o.quote.networkFeeEth, 3)}</dd>
              <dt className="font-bold">Total</dt><dd className="text-right text-base font-bold text-price" data-testid="summary-total">{formatEth(o.quote.totalEth, 8)}</dd>
            </dl>
            <p className="text-center text-sm leading-relaxed text-muted">Transação confirmada na {network}. A propriedade foi transferida para sua carteira conectada e registrada na rede.</p>
            <p className="sr-only" data-testid="tx-hash">{o.txHash}</p>
            <p className="sr-only" data-testid="order-id">{o.id}</p>
            {o.explorerUrl && (
              <Button asChild className="mx-auto h-12 px-4 text-base">
                <a href={o.explorerUrl} target="_blank" rel="noopener noreferrer">Ver no Etherscan<span className="sr-only"> (link simulado, abre em nova aba)</span></a>
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
