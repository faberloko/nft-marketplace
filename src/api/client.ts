import axios, { AxiosError } from 'axios'
import type { ApiErrorBody, ErrorCode } from './types'
import { API_URL, REQUEST_TIMEOUT_MS } from '@/lib/env'
import { sessionStore } from '@/lib/session-store'

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string, public status: number, public fields?: Record<string, string>, public details?: unknown) {
    super(message)
  }
  get retryable() { return this.code === 'TRANSIENT' || this.code === 'NETWORK' || this.code === 'TIMEOUT' }
}

export const http = axios.create({ baseURL: API_URL, timeout: REQUEST_TIMEOUT_MS })

http.interceptors.request.use((config) => {
  const s = sessionStore.get()
  if (s) config.headers.Authorization = `Bearer ${s.token}`
  config.headers['X-Cart-Id'] = sessionStore.guestCartId()
  return config
})

http.interceptors.response.use(undefined, (err: AxiosError<ApiErrorBody>) => {
  if (axios.isCancel(err as unknown)) throw err
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') throw new ApiError('TIMEOUT', 'A requisição demorou demais.', 0)
  if (!err.response) throw new ApiError('NETWORK', 'Sem conexão com o servidor. Verifique sua rede.', 0)
  const body = err.response.data?.error
  const apiErr = new ApiError(body?.code ?? 'TRANSIENT', body?.message ?? 'Erro inesperado.', err.response.status, body?.fields, body?.details)
  // Sessão expirada/ inválida em requisição autenticada: encerra a sessão local e avisa a aplicação.
  if (err.response.status === 401 && err.config?.headers?.Authorization) sessionStore.expire()
  throw apiErr
})
