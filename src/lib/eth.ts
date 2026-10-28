import Decimal from 'decimal.js'
/** Apresentação de valores ETH sem perder precisão (strings decimais da API). */
export function formatEth(v: string | undefined, dp = 4) {
  if (v === undefined) return '—'
  const d = new Decimal(v)
  const fixed = d.decimalPlaces() > dp ? d.toFixed(dp, Decimal.ROUND_HALF_UP) : d.toFixed()
  return `${fixed} ETH`
}
export const mulEth = (a: string, q: number) => new Decimal(a).mul(q).toFixed()
