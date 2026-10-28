import { expect, test } from '@playwright/test'
import { addToCart, fresh, login, mock, openReview, readyToPay, ready, sessionToken, setScenarios } from './helpers'

test.describe('carrinho', () => {
  test('quantidades, remoção, cupom e persistência após refresh e login', async ({ page }) => {
    await fresh(page)
    await addToCart(page, 'nft-1', 2)
    await addToCart(page, 'nft-2')
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    const sub = page.getByTestId('summary-subtotal')
    await expect(sub).toHaveText(/ETH/)
    const before = await sub.textContent()
    await page.getByTestId('cart-line').first().getByRole('button', { name: 'Diminuir' }).click()
    await expect(page.getByTestId('cart-line').first().getByTestId('line-qty')).toHaveText('1')
    await expect(sub).not.toHaveText(before!)

    const coupon = page.getByLabel('Código promocional')
    await coupon.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom inválido.')).toBeVisible()
    await coupon.fill('EXPIRED20')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Cupom expirado.')).toBeVisible()
    await coupon.fill('welcome10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('summary-discount')).not.toHaveText('(-) 0 ETH')
    await page.getByRole('button', { name: 'Remover cupom' }).click()
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0 ETH')

    await page.getByRole('button', { name: /^Remover / }).last().click()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await page.reload()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)

    // itens do visitante são preservados ao autenticar
    await login(page)
    await page.goto('/cart')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
  })

  test('valores exibidos batem com a API (precisão decimal)', async ({ page }) => {
    await fresh(page)
    await addToCart(page, 'nft-2', 3)
    await ready(page)
    const quote = await page.evaluate(async () => {
      const r = await fetch('/api/quote', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cart-id': localStorage.getItem('nft-guest-cart')! }, body: JSON.stringify({ network: 'ethereum', coupon: null }) })
      return r.json()
    })
    await expect(page.getByTestId('summary-total')).toHaveText(`${quote.totalEth} ETH`)
    expect(typeof quote.totalEth).toBe('string')
  })
})

test.describe('compra', () => {
  test('compra completa do catálogo ao recibo confirmado', async ({ page }) => {
    await fresh(page)
    await page.getByTestId('nft-card').first().getByRole('link').first().click()
    await page.getByRole('button', { name: /^Comprar( NFT)?$/ }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await page.getByRole('button', { name: 'Entrar para finalizar' }).click()
    await page.getByLabel('E-mail').fill('ana@nft.test')
    await page.getByLabel('Senha', { exact: true }).fill('Senha@123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/checkout')

    await page.getByLabel('Nome de exibição').fill('')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByLabel('Nome de exibição')).toBeFocused()
    await expect(page.getByText('Informe o nome de exibição.')).toBeVisible()
    await page.getByLabel('Nome de exibição').fill('Ana Souza')
    await page.getByLabel('Código de indicação').fill('KURIO2026')
    await readyToPay(page)
    const dialog = await openReview(page)
    const total = await dialog.getByTestId('summary-total').textContent()

    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação' })).toBeVisible()
    await expect(page.getByText('Pedido confirmado')).toBeAttached({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByTestId('tx-hash')).toHaveText(/^0x[0-9a-f]{64}$/)
    await expect(page.getByTestId('summary-total')).toHaveText(total!)

    // recibo é snapshot: mudar o catálogo depois não altera os valores
    const orderUrl = page.url()
    await mock(page, 'nft-update', { nftId: 'nft-1', editionId: 'nft-1-ed-3', priceEth: '9.99' })
    await page.goto(orderUrl)
    await expect(page.getByTestId('summary-total')).toHaveText(total!)
    // apenas os itens comprados saem do carrinho
    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('pagamento recusado preserva itens', async ({ page }) => {
    await fresh(page, '/', ['instant', 'payment-declined'])
    await login(page)
    await addToCart(page, 'nft-2')
    await readyToPay(page)
    const dialog = await openReview(page)
    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pedido confirmado')).toHaveCount(0)
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
  })

  test('clique repetido não duplica e timeout recupera o mesmo pedido', async ({ page }) => {
    test.setTimeout(60_000)
    await fresh(page, '/', ['instant', 'order-timeout'])
    await login(page)
    await addToCart(page, 'nft-4')
    await readyToPay(page)
    const dialog = await openReview(page)
    const creates: string[] = []
    page.on('request', (r) => { if (r.url().endsWith('/api/orders') && r.method() === 'POST') creates.push(r.headers()['idempotency-key']) })
    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click({ clickCount: 3 }) // cliques repetidos rápidos
    await expect(page.getByRole('heading', { name: /Aguardando confirmação|Seus NFTs agora estão na sua carteira/ })).toBeVisible({ timeout: 25_000 })
    expect(new Set(creates).size).toBe(1) // reenvio após timeout usa a mesma chave
    expect(creates.length).toBeGreaterThanOrEqual(2)
    const token = await sessionToken(page)
    const orders = await page.evaluate(async (t) => (await fetch('/api/orders', { headers: { authorization: `Bearer ${t}` } })).json(), token)
    expect(orders).toHaveLength(1)
  })

  test('mesma chave de idempotência com conteúdo diferente gera conflito', async ({ page }) => {
    await fresh(page)
    await login(page)
    await addToCart(page, 'nft-5')
    await ready(page)
    const res = await page.evaluate(async () => {
      const token = JSON.parse(localStorage.getItem('nft-session')!).token
      const h = { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': 'k-1' }
      const q = await (await fetch('/api/quote', { method: 'POST', headers: h, body: JSON.stringify({ network: 'ethereum' }) })).json()
      const collector = { displayName: 'Ana', username: 'anasouza', profileName: 'anasouza', email: 'ana@nft.test', ensName: 'ana', referralCode: 'K1', note: '' }
      const body = { quoteId: q.id, walletId: 'wallet-ana-1', network: 'ethereum', provider: 'metamask', collector }
      const a = await fetch('/api/orders', { method: 'POST', headers: h, body: JSON.stringify(body) })
      const b = await fetch('/api/orders', { method: 'POST', headers: h, body: JSON.stringify(body) })
      const c = await fetch('/api/orders', { method: 'POST', headers: h, body: JSON.stringify({ ...body, collector: { ...collector, displayName: 'Outro' } }) })
      return [a.status, (await a.json()).id, b.status, (await b.json()).id, c.status, (await c.json()).error.code]
    })
    expect(res[0]).toBe(201); expect(res[2]).toBe(200); expect(res[3]).toBe(res[1])
    expect(res[4]).toBe(409); expect(res[5]).toBe('IDEMPOTENCY_CONFLICT')
  })

  test('preço muda na confirmação: exige nova confirmação', async ({ page }) => {
    await fresh(page, '/', ['instant', 'price-change-checkout'])
    await login(page)
    await addToCart(page, 'nft-6')
    await readyToPay(page)
    let dialog = await openReview(page)
    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page.getByText('A cotação mudou — confirme novamente')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
    await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    dialog = await openReview(page)
    await dialog.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page.getByText('Pedido confirmado')).toBeAttached({ timeout: 10_000 })
  })

  test('carteira recusa conexão', async ({ page }) => {
    await fresh(page)
    await login(page)
    await addToCart(page, 'nft-7')
    await setScenarios(page, ['instant', 'wallet-reject'])
    await page.goto('/checkout')
    await expect(page.getByLabel('Tipo de carteira')).not.toHaveValue('')
    await page.getByRole('radio', { name: 'MetaMask', exact: true }).check()
    await expect(page.getByText('A conexão foi recusada na carteira.').first()).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Conecte a carteira escolhida na rede selecionada.')).toBeVisible()
  })
})
