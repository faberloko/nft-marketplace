import { expect, test } from '@playwright/test'
import { addToCart, fresh, login, mock, openReview, readyToPay, realtimeReady, ready, sessionToken } from './helpers'

/** Eventos sempre nascem no servidor MSW e chegam pelo socket.io-client; nenhum teste altera a tela ou o cache diretamente. */
test.describe('tempo real (Socket.IO)', () => {
  test('nft.updated durante o checkout bloqueia cotação desatualizada', async ({ page }) => {
    await fresh(page)
    await login(page)
    await addToCart(page, 'nft-8')
    await readyToPay(page)
    const confirm = page.getByRole('button', { name: 'Confirmar compra' })
    await expect(confirm).toBeEnabled()
    const before = await page.getByTestId('summary-total').first().textContent()

    await realtimeReady(page)
    await mock(page, 'nft-update', { nftId: 'nft-8', editionId: 'nft-8-ed-3', priceEth: '3.33' })
    await expect(page.getByTestId('live-assertive')).toContainText('Atualização em tempo real')
    await expect(page.getByText('A cotação mudou — confirme novamente')).toBeVisible()
    await expect(confirm).toBeDisabled()
    await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(page.getByTestId('summary-total').first()).not.toHaveText(before!)
    await expect(confirm).toBeEnabled()
  })

  test('nft.updated reflete no carrinho e no detalhe; esgotar bloqueia', async ({ page }) => {
    await fresh(page)
    await addToCart(page, 'nft-9')
    await realtimeReady(page)
    await mock(page, 'nft-update', { nftId: 'nft-9', editionId: 'nft-9-ed-3', available: 0 })
    await expect(page.getByText('Preço ou disponibilidade mudaram')).toBeVisible()
    await expect(page.getByRole('button', { name: /Conectar e finalizar|Entrar para finalizar/ })).toBeDisabled()
    await page.goto('/nft/nft-9')
    await expect(page.getByRole('radio', { name: /^1\/50/ })).toBeDisabled()
  })

  test('eventos duplicados e antigos são ignorados', async ({ page }) => {
    await fresh(page, '/nft/nft-10')
    const price = page.getByTestId('edition-price-nft-10-ed-3')
    await realtimeReady(page)
    await mock(page, 'nft-update', { nftId: 'nft-10', editionId: 'nft-10-ed-3', priceEth: '1.23' })
    await expect(price).toContainText('1.23 ETH')
    await mock(page, 'replay', { mode: 'stale' }) // versão inferior com preço 999
    await mock(page, 'replay', { mode: 'duplicate' })
    await page.waitForTimeout(500)
    await expect(price).toContainText('1.23 ETH')
    await expect(price).not.toContainText('999')
  })

  test('desconexão e retomada de pedido pendente sem nova compra', async ({ page }) => {
    await fresh(page)
    await login(page)
    await addToCart(page, 'nft-12')
    await readyToPay(page)
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação' })).toBeVisible()
    await realtimeReady(page)
    await mock(page, 'disconnect')
    await page.reload() // recarrega no meio do pendente
    await expect(page.getByRole('heading', { name: /Aguardando confirmação|Seus NFTs agora estão na sua carteira/ })).toBeVisible()
    await expect(page.getByText('Pedido confirmado')).toBeAttached({ timeout: 10_000 })
    await ready(page)
    const token = await sessionToken(page)
    const orders = await page.evaluate(async (t) => (await fetch('/api/orders', { headers: { authorization: `Bearer ${t}` } })).json(), token)
    expect(orders).toHaveLength(1)
  })

  test('reconexão reconcilia com REST', async ({ page }) => {
    await fresh(page, '/nft/nft-13')
    await realtimeReady(page)
    await mock(page, 'disconnect')
    await expect(page.getByTestId('live-polite')).toContainText('Conexão em tempo real restabelecida', { timeout: 20_000 })
  })
})
