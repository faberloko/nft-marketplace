import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { buildRouter, PRIVATE_PREFIXES } from './router'
import { ApiError } from './api/client'
import { restoreSession, wireSessionCache } from './lib/auth'
import { sessionStore } from './lib/session-store'
import { announce } from './lib/announcer'
import { startRealtime } from './realtime/socket'
import { MOCKS_ENABLED } from './lib/env'
import './index.css'

/** Política de cache/retry documentada em ARCHITECTURE.md §Cache. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000, gcTime: 5 * 60_000, refetchOnWindowFocus: true,
      retry: (count, err) => err instanceof ApiError && err.retryable && count < 2,
      retryDelay: (n) => Math.min(500 * 2 ** n, 3000),
    },
    mutations: { retry: false },
  },
})

async function boot() {
  if (MOCKS_ENABLED) await (await import('./mocks/browser')).startMocks()
  await restoreSession(queryClient)
  wireSessionCache(queryClient)
  await startRealtime(queryClient)
  const router = buildRouter(queryClient)
  sessionStore.subscribe((_s, reason) => {
    if (reason !== 'expired') return
    const loc = router.state.location
    announce('Sua sessão expirou. Entre novamente para continuar.', 'assertive')
    if (PRIVATE_PREFIXES.some((p) => loc.pathname.startsWith(p))) {
      router.navigate({ to: '/login', search: { redirect: loc.href, reason: 'expired' } })
    }
  })
  sessionStore.subscribe((_s, reason) => { if (reason === 'logout') router.navigate({ to: '/' }) })
  document.documentElement.dataset.ready = 'true' // sinal para testes E2E: mocks e socket iniciados
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
boot()
