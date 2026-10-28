import { expect, test } from '@playwright/test'
import { fresh } from './helpers'

test('home carrega catálogo sem erros de console', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  await fresh(page)
  await expect(page.getByTestId('nft-card').first()).toBeVisible()
  await expect(page.getByTestId('result-count')).toHaveText(/36 resultado/)
  await expect(page.getByText('Tempo real conectado')).toBeAttached()
  expect(errors).toEqual([])
})
