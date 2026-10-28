/** Configuração versionada da auditoria. Perfis: mobile (padrão Lighthouse: Moto G Power, 4G lento simulado) e desktop. */
export const PAGES = [
  { name: 'home', path: '/' },
  { name: 'detail', path: '/nft/nft-1' },
]
export const RUNS = 3
export const BASE_URL = process.env.LH_BASE_URL ?? 'http://localhost:4173'
export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
export const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
