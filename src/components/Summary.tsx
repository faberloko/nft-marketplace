import type { Quote } from '@/api/types'
import { Skeleton } from '@/components/ui'
import { formatEth } from '@/lib/eth'

/** Resumo de valores exatamente como a API retornou (a cotação é a referência). */
export function Summary({ quote, loading, title = 'Resumo' }: { quote?: Quote; loading?: boolean; title?: string }) {
  const rows: [string, string | undefined, string][] = [
    ['Subtotal', quote?.subtotalEth, 'subtotal'],
    [quote?.coupon ? `Desconto (${quote.coupon.code})` : 'Desconto', quote ? `-${quote.discountEth}` : undefined, 'discount'],
    ['Taxa de rede', quote?.networkFeeEth, 'fee'],
  ]
  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-4 rounded-[20px] bg-surface p-6" aria-busy={loading}>
      <h2 id="summary-title" className="text-[22px]">{title}</h2>
      <dl className="flex flex-col gap-3 font-mono">
        {rows.map(([label, value, id]) => (
          <div key={id} className="flex justify-between gap-4">
            <dt className="font-sans text-[#cccccc]">{label}</dt>
            <dd data-testid={`summary-${id}`}>{quote && !loading ? (id === 'discount' ? `-${formatEth(quote.discountEth, 8)}` : formatEth(value, 8)) : <Skeleton className="h-6 w-24" />}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-border pt-3 text-xl">
          <dt className="font-sans font-semibold">Total</dt>
          <dd data-testid="summary-total" className="font-bold">{quote && !loading ? formatEth(quote.totalEth, 8) : <Skeleton className="h-7 w-28" />}</dd>
        </div>
      </dl>
    </section>
  )
}
