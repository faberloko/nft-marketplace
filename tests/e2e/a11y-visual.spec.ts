import { expect, test } from '@playwright/test'
import { addToCart, fresh, login } from './helpers'

test.describe('acessibilidade', () => {
  test('navegação por teclado com foco visível e skip link', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'teclado físico é avaliado no viewport desktop')
    await fresh(page)
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
    // chega a um card do catálogo e abre com Enter
    const firstCard = page.getByTestId('nft-card').first().getByRole('link').first()
    await firstCard.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\//)
  })

  test('diálogo prende e devolve o foco', async ({ page }) => {
    await fresh(page)
    const trigger = page.getByRole('button', { name: 'Abrir painel de cenários simulados' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab')
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('erros de formulário associados aos campos', async ({ page }) => {
    await fresh(page, '/login')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = page.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAttribute('aria-describedby', 'email-error')
    await expect(page.locator('#email-error')).toHaveText(/e-mail válido/)
  })

  test('sem overflow horizontal', async ({ page }) => {
    const check = async (path: string) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
    await fresh(page)
    await login(page)
    for (const path of ['/account/profile', '/account/wallets', '/favoritos', '/checkout']) await check(path)
    for (const path of ['/', '/nft/nft-1', '/cart', '/login', '/signup']) {
      await fresh(page, path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })
})

test.describe('regressão visual', () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }) })
  /** Força o carregamento das imagens lazy e espera fontes para screenshots determinísticos. */
  const settle = async (page: import('@playwright/test').Page) => {
    await page.evaluate(async () => {
      document.querySelectorAll('img[loading=lazy]').forEach((i) => i.setAttribute('loading', 'eager'))
      await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
      await document.fonts.ready
    })
  }
  const hide = (page: import('@playwright/test').Page) => [page.getByRole('button', { name: 'Abrir painel de cenários simulados' }), page.locator('[data-testid=toast]')]

  test('início', async ({ page }) => {
    await fresh(page)
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
    await settle(page)
    await expect(page).toHaveScreenshot('home.png', { fullPage: true, mask: hide(page) })
  })
  test('detalhe', async ({ page }) => {
    await fresh(page, '/nft/nft-1')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detail.png', { fullPage: true, mask: hide(page) })
  })
  test('carrinho', async ({ page }) => {
    await fresh(page)
    await addToCart(page, 'nft-1', 2)
    await page.goto('/cart')
    await expect(page.getByTestId('summary-total')).toHaveText(/ETH/)
    await settle(page)
    await expect(page).toHaveScreenshot('cart.png', { fullPage: true, mask: hide(page) })
  })
  test('pagamento', async ({ page }) => {
    await fresh(page)
    await login(page)
    await addToCart(page, 'nft-1')
    await page.goto('/checkout')
    await expect(page.getByTestId('summary-total')).toHaveText(/ETH/)
    await expect(page.getByLabel('Tipo de carteira')).not.toHaveValue('')
    await settle(page)
    await expect(page).toHaveScreenshot('checkout.png', { fullPage: true, mask: hide(page) })
  })
})
