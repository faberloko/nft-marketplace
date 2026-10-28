// Gera capturas das telas implementadas lado a lado com os frames do Figma (design/compare/).
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE ?? 'http://localhost:4173'
mkdirSync('design/compare', { recursive: true })
const pages = [
  ['Início', '/', null], ['Detalhes do NFT', '/nft/nft-1', null], ['Carrinho de NFTs', '/cart', 'cart'], ['Pagamento', '/checkout', 'checkout'],
  ['Login', '/login', null], ['Cadastro', '/signup', null], ['Perfil do Colecionador', '/account/profile', 'login'], ['Carteiras', '/account/wallets', 'login'],
  ['Confirmação de Pedido', null, 'order'],
]
const only = process.argv[2]
const b = await chromium.launch()
for (const [vw, dir] of [[1440, 'Desktop'], [414, 'Mobile']]) {
  for (const [name, path, setup] of pages) {
    if (only && !name.startsWith(only)) continue
    const ctx = await b.newContext({ viewport: { width: vw, height: dir === 'Mobile' ? 896 : 1000 }, reducedMotion: 'reduce', isMobile: dir === 'Mobile', hasTouch: dir === 'Mobile' })
    const p = await ctx.newPage()
    await p.goto(`${BASE}/?reset=1&scenario=instant`); await p.locator('html[data-ready=true]').waitFor()
    const api = (u, body, method = 'POST') => p.evaluate(async ([u, body, method]) => {
      const s = JSON.parse(localStorage.getItem('nft-session') ?? 'null')
      const r = await fetch('/api' + u, { method, headers: { 'idempotency-key': 'compare-1', 'content-type': 'application/json', 'x-cart-id': localStorage.getItem('nft-guest-cart'), ...(s ? { authorization: 'Bearer ' + s.token } : {}) }, body: body ? JSON.stringify(body) : undefined })
      return r.json().catch(() => null)
    }, [u, body, method])
    const login = async () => { const s = await api('/auth/login', { email: 'ana@nft.test', password: 'Senha@123' }); await p.evaluate((s) => localStorage.setItem('nft-session', JSON.stringify(s)), s) }
    if (setup) {
      await login()
      if (setup !== 'login') {
        await api('/cart/items', { nftId: 'nft-1', editionId: 'nft-1-ed-3', quantity: 2 })
        await api('/cart/items', { nftId: 'nft-5', editionId: 'nft-5-ed-3', quantity: 6 })
        await api('/cart/items', { nftId: 'nft-6', editionId: 'nft-6-ed-3', quantity: 9 })
      }
      if (setup === 'order') {
        const q = await api('/quote', { network: 'ethereum', coupon: null })
        const o = await api('/orders', { quoteId: q.id, walletId: 'wallet-ana-1', network: 'ethereum', provider: 'metamask', collector: { displayName: 'Ana Souza', username: 'anasouza', profileName: 'anasouza', email: 'ana@nft.test', ensName: 'ana', referralCode: 'KURIO2026', note: '' } })
        console.log('pedido', JSON.stringify(o).slice(0, 300)); await api('/__mock/settle', {})
        await p.goto(`${BASE}/orders/${o.id}`)
      } else await p.goto(BASE + path)
    } else await p.goto(BASE + path)
    await p.locator('html[data-ready=true]').waitFor(); await p.waitForTimeout(1200)
    await p.evaluate(async () => { document.querySelectorAll('img[loading=lazy]').forEach((i) => i.setAttribute('loading', 'eager')); await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r }))); await document.fonts.ready })
    const shot = await p.screenshot({ fullPage: dir === 'Desktop' })
    const fig = `design/figma/${dir}/${name}.png`
    try {
      const W = dir === 'Desktop' ? 720 : 414
      const a = await sharp(fig).resize({ width: W }).png().toBuffer(); const bb = await sharp(shot).resize({ width: W }).png().toBuffer()
      const ma = await sharp(a).metadata(); const mb = await sharp(bb).metadata(); const H = Math.max(ma.height, mb.height)
      await sharp({ create: { width: W * 2 + 20, height: H, channels: 3, background: '#ffffff' } }).composite([{ input: a, left: 0, top: 0 }, { input: bb, left: W + 20, top: 0 }]).png().toFile(`design/compare/${dir}-${name}.png`)
    } catch { await sharp(shot).resize({ width: dir === 'Desktop' ? 720 : 414 }).toFile(`design/compare/${dir}-${name}.png`) }
    console.log('ok', dir, name)
    await ctx.close()
  }
}
await b.close()
