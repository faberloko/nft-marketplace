import { expect, type Locator, type Page } from '@playwright/test'

export const ANA = { email: 'ana@nft.test', password: 'Senha@123' }
export const BRUNO = { email: 'bruno@nft.test', password: 'Senha@123' }
export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

/** Estado isolado: reseta o banco simulado e aplica cenários antes de abrir a rota. */
export async function fresh(page: Page, path = '/', scenarios: string[] = ['instant']) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}reset=1&scenario=${scenarios.join(',')}`)
  await ready(page)
}
/** App inicializado (MSW ativo para esta página, sessão restaurada, socket iniciado). */
export async function ready(page: Page) {
  await page.locator('html[data-ready=true]').waitFor({ state: 'attached', timeout: 15_000 })
}
/** Aguarda o socket.io-client conectar ao servidor simulado. */
export async function realtimeReady(page: Page) {
  await expect(page.getByText('Tempo real conectado')).toBeAttached({ timeout: 15_000 })
}
/** Chama os endpoints de controle dos mocks pelo próprio app (passa pelo MSW). */
export async function mock(page: Page, path: string, body: unknown = {}) {
  await ready(page)
  return page.evaluate(async ([p, b]) => {
    const r = await fetch(`/api/__mock/${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })
    return r.json()
  }, [path, body] as const)
}
export async function setScenarios(page: Page, names: string[]) { await mock(page, 'scenarios', { names }) }

/** Login pelo modal (desktop) ou tela cheia (mobile) do Figma. */
export async function login(page: Page, user = ANA, redirect?: string) {
  await page.goto(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login')
  await ready(page)
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** “COMPRAR” / “Comprar NFT” adiciona e leva ao carrinho, como no Figma. */
export async function addToCart(page: Page, nftId = 'nft-1', qty = 1) {
  await page.goto(`/nft/${nftId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (let i = 1; i < qty; i++) await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: /^Comprar( NFT)?$/ }).click()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByTestId('cart-line').first()).toBeVisible()
}

/** Busca: campo no topo (mobile) ou diálogo da lupa no cabeçalho (desktop). */
export async function searchFor(page: Page, term: string) {
  if (isMobile(page)) {
    await page.locator('#mobile-search').fill(term)
    await page.locator('#mobile-search').press('Enter')
  } else {
    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await dialog.getByLabel('Nome do NFT, coleção ou atributo').fill(term)
    await dialog.getByRole('button', { name: 'Buscar' }).click()
    await expect(dialog).toBeHidden()
  }
}

/** Painel de filtros: lateral no desktop, gaveta no mobile. */
export async function filters(page: Page): Promise<Locator> {
  if (isMobile(page)) {
    await page.getByRole('button', { name: /^Filtros/ }).click()
    return page.getByRole('dialog', { name: 'Filtros' })
  }
  return page.getByRole('complementary', { name: 'Filtros' })
}
export async function closeFilters(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Ver resultados' }).click()
}

/** Abre o pagamento já preenchido (Ana) e conecta a MetaMask. */
export async function readyToPay(page: Page) {
  await page.goto('/checkout')
  await expect(page.getByLabel('Nome de exibição')).toHaveValue(/.+/)
  await expect(page.getByLabel('Tipo de carteira')).not.toHaveValue('')
  await page.getByRole('radio', { name: 'MetaMask', exact: true }).check()
  await expect(page.getByText('✓ Conectada')).toBeVisible()
}
export async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise antes de confirmar' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Confirmar e pagar/ })).toBeEnabled()
  return dialog
}
/** Rótulo exato, tolerando o asterisco de obrigatório do Figma. */
export const label = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*?$`)
export async function sessionToken(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('nft-session')!).token as string)
}
