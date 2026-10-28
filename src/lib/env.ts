export const API_URL = import.meta.env.VITE_API_URL ?? '/api'
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.nft.mock'
export const MOCKS_ENABLED = (import.meta.env.VITE_ENABLE_MOCKS ?? 'true') === 'true'
export const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS ?? 8000)
