/** Cenários determinísticos e combináveis: ?scenario=slow,favorite-fail (persistem em localStorage até o reset). */
export const SCENARIOS = {
  default: 'Latência realista (determinística)',
  instant: 'Sem latência (testes)',
  empty: 'Catálogo sem resultados',
  slow: 'Lentidão: 2,5 s por requisição',
  variable: 'Latência variável (seed fixa)',
  'out-of-order': 'Respostas do catálogo fora de ordem',
  offline: 'Sem conexão (falha de rede)',
  'server-error': 'HTTP 500 no catálogo e detalhe',
  flaky: 'Primeira chamada de cada rota falha com 503',
  'favorite-fail': 'Favoritar/desfavoritar retorna 500',
  'price-change-checkout': 'Preço muda na primeira confirmação',
  'sold-out-checkout': 'Edição esgota na primeira confirmação',
  'order-timeout': 'Timeout após criar o pedido (recupera por idempotência)',
  'payment-declined': 'Pagamento recusado',
  'wallet-reject': 'Carteira recusa a conexão',
} as const
export type ScenarioName = keyof typeof SCENARIOS
const KEY = 'nft-mock-scenario'

function parse(raw: string) {
  return new Set(raw.split(',').filter((s): s is ScenarioName => s in SCENARIOS))
}
export function readScenarios(): Set<ScenarioName> {
  try {
    const fromUrl = new URL(window.location.href).searchParams.get('scenario')
    if (fromUrl) localStorage.setItem(KEY, fromUrl)
    return parse(localStorage.getItem(KEY) ?? 'default')
  } catch {
    return new Set<ScenarioName>(['default'])
  }
}
export const active = { set: readScenarios() }
export function setScenarios(names: string[]) {
  const value = names.join(',') || 'default'
  try { localStorage.setItem(KEY, value) } catch { /* sem storage */ }
  active.set = parse(value)
}
export const has = (n: ScenarioName) => active.set.has(n)

let seed = 1234
export const resetSeed = () => { seed = 1234 }
export const seededRandom = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
