import { expect, test } from '@playwright/test'
import { closeFilters, filters, fresh, isMobile, searchFor, setScenarios } from './helpers'

test.describe('catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e histórico', async ({ page }) => {
    await fresh(page)
    await expect(page.getByTestId('result-count')).toHaveText(/^36 resultado/)

    await searchFor(page, 'golden')
    await expect(page).toHaveURL(/q=golden/)
    await expect(page.getByTestId('result-count')).toHaveText(/^3 resultado/)
    await page.goBack()
    await expect(page.getByTestId('result-count')).toHaveText(/^36 resultado/)

    // paginação 3 × 3 do Figma: 4 páginas; um filtro reinicia para a página 1
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    let panel = await filters(page)
    await panel.getByRole('button', { name: /^Arte digital/ }).click()
    await expect(page).not.toHaveURL(/page=/)
    await panel.getByRole('button', { name: /^Música/ }).click()
    await panel.getByRole('button', { name: /^Ethereum/ }).click()
    await expect(panel.getByRole('button', { name: /^Ethereum/ })).toHaveAttribute('aria-pressed', 'true')
    await closeFilters(page)
    await expect(page).toHaveURL(/category=/)
    await expect(page).toHaveURL(/network=/)
    const combined = await page.getByTestId('result-count').textContent()
    expect(Number(combined!.split(' ')[0])).toBeLessThan(36)

    if (isMobile(page)) { panel = await filters(page); await panel.getByLabel('Ordenar por:').selectOption('price_desc'); await closeFilters(page) }
    else await page.getByLabel('Ordenar por:').selectOption('price_desc')
    await expect(page).toHaveURL(/sort=price_desc/)
    const nums = (await page.getByTestId('card-price').allTextContents()).map((p) => parseFloat(p))
    expect(nums.length).toBeGreaterThan(0)
    expect(nums).toEqual([...nums].sort((a, b) => b - a))

    // refresh preserva o estado
    await page.reload()
    await expect(page.getByTestId('result-count')).toHaveText(combined!)
    await expect(page).toHaveURL(/sort=price_desc/)
    // histórico: voltar desfaz a ordenação
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=/)
    await page.goForward()
    await expect(page).toHaveURL(/sort=price_desc/)
  })

  test('abas Novos lançamentos e Em alta filtram a lista', async ({ page }) => {
    await fresh(page)
    await page.getByRole('tab', { name: 'Novos lançamentos' }).click()
    await expect(page).toHaveURL(/tab=novos/)
    await expect(page.getByRole('tab', { name: 'Novos lançamentos' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('result-count')).toHaveText(/^12 resultado/)
    await page.getByRole('tab', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/tab=em-alta/)
  })

  test('resultado vazio', async ({ page }) => {
    await fresh(page, '/?q=nao-existe-xyz')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
  })

  test('skeleton durante lentidão, falha e recuperação após nova tentativa', async ({ page }) => {
    await fresh(page, '/', ['slow'])
    await page.reload()
    await expect(page.getByTestId('nft-skeleton').first()).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeVisible({ timeout: 15_000 })

    await setScenarios(page, ['instant', 'server-error'])
    await page.goto('/?q=ape')
    await expect(page.getByText('Não foi possível carregar o catálogo')).toBeVisible({ timeout: 15_000 })
    await setScenarios(page, ['instant'])
    await page.getByRole('alert').filter({ hasText: 'catálogo' }).getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
  })

  test('respostas fora de ordem não sobrescrevem a consulta atual', async ({ page }) => {
    await fresh(page, '/', ['out-of-order'])
    await page.reload()
    await expect(page.getByTestId('nft-card').first()).toBeVisible({ timeout: 10_000 })
    // termo ímpar (5 letras) responde em 1,8 s; par (6 letras) em 150 ms: a resposta antiga deve ser descartada.
    await searchFor(page, 'nomad')
    await searchFor(page, 'golden')
    await expect(page).toHaveURL(/q=golden/)
    await page.waitForTimeout(2500)
    const names = await page.getByTestId('nft-card').getByRole('heading').allTextContents()
    expect(names.length).toBeGreaterThan(0)
    expect(names.every((n) => n.includes('Golden'))).toBe(true)
  })
})

test.describe('detalhe', () => {
  test('acesso direto, galeria e limite de quantidade', async ({ page }) => {
    await fresh(page, '/nft/nft-1')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emerald Ape #042')
    if (!isMobile(page)) {
      await page.getByRole('button', { name: 'Mostrar imagem 2' }).click()
      await expect(page.getByRole('button', { name: 'Mostrar imagem 2' })).toHaveAttribute('aria-pressed', 'true')
    }
    await page.locator('label', { hasText: /^1\/10/ }).click()
    await expect(page.getByRole('radio', { name: /^1\/10/ })).toBeChecked()
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
    while (await plus.isEnabled()) await plus.click()
    const max = Number(await page.locator('[data-testid=qty]:visible').textContent())
    expect(max).toBeGreaterThanOrEqual(1)
    expect(max).toBeLessThanOrEqual(5)
  })

  test('NFT inexistente e edições indisponíveis', async ({ page }) => {
    await fresh(page, '/nft/nao-existe')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.goto('/nft/nft-11') // fixture: todas as edições esgotadas
    await expect(page.getByRole('status').filter({ hasText: 'Edição indisponível' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Comprar( NFT)?$/ })).toBeDisabled()
  })

  test('rota inexistente', async ({ page }) => {
    await fresh(page, '/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })
})
