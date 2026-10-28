import { setupWorker } from 'msw/browser'
import { handlers, settleDueOrders } from './handlers'
import { socketHandler } from './socket'
import { loadDb, resetDb } from './db'
import { setScenarios } from './scenarios'

/** Inicia o "servidor" simulado. ?reset=1 restaura integralmente o cenário conhecido. */
export async function startMocks() {
  const url = new URL(window.location.href)
  if (url.searchParams.has('reset')) {
    await resetDb()
    try { localStorage.removeItem('nft-session'); localStorage.removeItem('nft-guest-cart') } catch { /* noop */ }
    setScenarios((url.searchParams.get('scenario') ?? 'default').split(','))
    url.searchParams.delete('reset'); url.searchParams.delete('scenario')
    window.history.replaceState(null, '', url)
  } else {
    await loadDb()
  }
  const worker = setupWorker(...handlers, socketHandler)
  await worker.start({ onUnhandledRequest: 'bypass', quiet: import.meta.env.PROD })
  // Liquidação simulada dos pedidos pendentes (persistida: sobrevive a refresh).
  window.setInterval(settleDueOrders, 500)
}
