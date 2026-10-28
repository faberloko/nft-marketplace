import { useSyncExternalStore } from 'react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { sessionStore } from './session-store'
import { announce } from './announcer'
import type { Session } from '@/api/types'

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

/** Valida o token persistido no boot (refresh). Um 401 limpa a sessão via interceptor do Axios. */
export async function restoreSession(qc: QueryClient) {
  if (!sessionStore.get()) return
  try {
    const s = await qc.fetchQuery({ queryKey: ['session'], queryFn: ({ signal }) => api.session(signal), staleTime: 60_000 })
    sessionStore.set(s)
  } catch { /* 401 → sessionStore.expire(); rede → mantém sessão local */ }
}

/** Limpa todos os dados privados em cache quando a sessão muda (logout, expiração, troca de usuário). */
export function wireSessionCache(qc: QueryClient) {
  let lastUser = sessionStore.get()?.user.id ?? null
  return sessionStore.subscribe((s) => {
    const next = s?.user.id ?? null
    if (next !== lastUser) {
      qc.cancelQueries({ queryKey: ['user'] })
      qc.removeQueries({ queryKey: ['user'] })
      qc.removeQueries({ queryKey: ['cart'] })
      qc.removeQueries({ queryKey: ['session'] })
    }
    lastUser = next
  })
}

export function useLogin() {
  return useAuthMutation((b: { email: string; password: string }) => api.login(b), 'Login realizado.')
}
export function useSignup() {
  return useAuthMutation((b: { username: string; email: string; password: string }) => api.signup(b), 'Conta criada com sucesso.')
}
function useAuthMutation<V>(fn: (v: V) => Promise<Session>, msg: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (s) => {
      if (sessionStore.get()?.user.id !== s.user.id) qc.removeQueries({ queryKey: ['user'] })
      sessionStore.set(s); sessionStore.rotateGuestCart(); announce(msg)
    },
  })
}
export function useLogout() {
  return useMutation({
    mutationFn: () => api.logout().catch(() => undefined),
    onSettled: () => { sessionStore.clear('logout'); announce('Você saiu da sua conta.') },
  })
}
