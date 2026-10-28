import Decimal from 'decimal.js'
import type { Artist, Category, Network, Nft, Wallet } from '@/api/types'

/** Ilustrações extraídas dos frames do Figma (public/nfts/kurio). */
type Art = 'emerald' | 'sage' | 'ivory' | 'golden'
const ATTRS: Record<Art, string[]> = {
  emerald: ['Óculos', 'Esmeralda', 'Raro'], sage: ['Chapéu bucket', 'Moletom', 'Comum'],
  ivory: ['Blazer', 'Gola alta', 'Incomum'], golden: ['Fones', 'Jaqueta', 'Comum'],
}
const art = (a: Art) => ({ image: `/nfts/kurio/${a}.webp`, thumb: `/nfts/kurio/${a}-thumb.webp`, large: `/nfts/kurio/${a}-large.webp` })

export const artists: Artist[] = ['Nova Sato', 'Rafa Lume', 'Iris Koda', 'Theo Brasa'].map((name, i) => ({ id: `artist-${i + 1}`, name, avatar: `/nfts/avatar-${i + 1}.svg` }))

/** Os 9 primeiros são exatamente os do frame "Início"; os demais seguem o mesmo padrão para exercitar filtros e paginação. */
const FIGMA: [string, string, Art, string, string | null][] = [
  ['Emerald Ape', '042', 'emerald', '1.19', null], ['Sage Nomad', '009', 'sage', '1.69', null], ['Neon Vessel', '552', 'ivory', '1.99', '2.29'],
  ['Cosmic Bloom', '118', 'sage', '1.29', null], ['Violet Nomad', '314', 'sage', '1.39', null], ['Ivory Baron', '088', 'ivory', '1.79', null],
  ['Golden Beat', '207', 'golden', '0.99', null], ['Golden Frequency', '071', 'sage', '0.59', null], ['Golden Signal', '160', 'golden', '0.39', null],
]
const FIRST = ['Amber', 'Onyx', 'Copper', 'Velvet', 'Lunar', 'Rustic', 'Cedar', 'Saffron', 'Midnight']
const SECOND: [string, Art][] = [['Ape', 'emerald'], ['Nomad', 'sage'], ['Baron', 'ivory'], ['Beat', 'golden']]
const CATS: Category[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade']
const NETS: Network[] = ['ethereum', 'ethereum', 'polygon', 'solana']

export const NFT_COUNT = 36

export function buildNfts(): Nft[] {
  return Array.from({ length: NFT_COUNT }, (_, idx) => {
    const n = idx + 1
    let name: string, token: string, a: Art, price: string, compare: string | null
    if (idx < FIGMA.length) [name, token, a, price, compare] = FIGMA[idx]
    else {
      const [second, art2] = SECOND[idx % SECOND.length]
      name = `${FIRST[idx % FIRST.length]} ${second}`; a = art2
      token = String(100 + ((n * 37) % 900)).padStart(3, '0')
      price = (0.29 + ((n * 41) % 210) / 100).toFixed(2); compare = n % 7 === 0 ? new Decimal(price).mul('1.15').toFixed(2) : null
    }
    const allSoldOut = n % 11 === 0
    const p = new Decimal(price)
    // A edição 1/50 é a de vitrine (preço exibido no card), como no Figma.
    const editions = [
      { label: '1/1', priceEth: p.mul(3).toFixed(2), available: allSoldOut || n % 3 === 0 ? 0 : 1, maxPerOrder: 1 },
      { label: '1/10', priceEth: p.mul('1.6').toFixed(2), available: allSoldOut ? 0 : (n % 10) + 1, maxPerOrder: 5 },
      { label: '1/50', priceEth: p.toFixed(2), available: allSoldOut ? 0 : 12 + (n % 30), maxPerOrder: 10 },
      { label: 'ABERTA', priceEth: p.mul('0.6').toFixed(2), available: allSoldOut ? 0 : 999, maxPerOrder: 20 },
    ].map((e, i) => ({ id: `nft-${n}-ed-${i + 1}`, ...e }))
    const img = art(a)
    const fullName = `${name} #${token}`
    return {
      id: `nft-${n}`, tokenId: `#0${token}`, name: fullName,
      description: 'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
      details: [
        `${fullName} é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
      ],
      collection: 'Kurio Apes', attributes: ATTRS[a], category: CATS[idx % CATS.length], network: NETS[idx % NETS.length],
      artist: artists[idx % artists.length], image: img.image, thumb: img.thumb, gallery: [img.large, img.large, img.large, img.large],
      createdAt: new Date(Date.UTC(2026, 8, 30) - n * 86400000).toISOString(), featured: n <= 3,
      badge: a === 'emerald' && n !== 1 ? 'RARO' : null, rating: 4 + ((n * 7) % 10) / 10, reviews: 5 + ((n * 13) % 40),
      editions, priceEth: p.toFixed(2), compareAtEth: compare, defaultEditionId: editions[2].id,
      totalAvailable: 0, likes: (n * 53) % 400, sales: (n * 29) % 120, version: 1,
    }
  })
}

export interface DbUser {
  id: string; name: string; username: string; email: string; ensName: string; walletNickname: string
  avatarUrl: string | null; passwordHash: string; salt: string
}

/** Senha fictícia de ambos: Senha@123 (hash SHA-256 com sal calculado no seed — nunca armazenada em claro). */
export const SEED_PASSWORD = 'Senha@123'
export const seedUsers = [
  { id: 'user-ana', name: 'Ana Souza', username: 'anasouza', email: 'ana@nft.test', ensName: 'ana', walletNickname: 'Principal', avatarUrl: '/nfts/kurio/emerald-thumb.webp', salt: 'ana-salt' },
  { id: 'user-bruno', name: 'Bruno Lima', username: 'brunolima', email: 'bruno@nft.test', ensName: '', walletNickname: '', avatarUrl: null, salt: 'bruno-salt' },
]
const base = { referralCode: 'KURIO2026', email: 'ana@nft.test', updatedAt: '2026-01-01T00:00:00.000Z' }
export const seedWallets: Record<string, Wallet[]> = {
  'user-ana': [
    { id: 'wallet-ana-1', kind: 'primary', displayName: 'Ana Souza', nickname: 'Principal', network: 'ethereum', profileName: 'anasouza', address: '0xa91f00000000000000000000000000000000e82c', secondaryAddress: '', provider: 'metamask', ensName: 'ana', ...base },
    { id: 'wallet-ana-2', kind: 'secondary', displayName: 'Ana Souza', nickname: 'Reserva', network: 'polygon', profileName: 'anasouza', address: '0x2222222222222222222222222222222222222222', secondaryAddress: 'nova.kurio.eth', provider: 'coinbase', ensName: 'nova', ...base },
  ],
  'user-bruno': [],
}
export const coupons: Record<string, { kind: 'percent' | 'flat'; value: string; description: string; expiresAt: string }> = {
  WELCOME10: { kind: 'percent', value: '10', description: '10% de desconto', expiresAt: '2099-01-01T00:00:00Z' },
  FLAT005: { kind: 'flat', value: '0.05', description: '0.05 ETH de desconto', expiresAt: '2099-01-01T00:00:00Z' },
  EXPIRED20: { kind: 'percent', value: '20', description: '20% de desconto', expiresAt: '2025-01-01T00:00:00Z' },
}
/** Taxa de rede do Figma: 0.016 ETH (estimada) na Ethereum. */
export const networkFees: Record<Network, string> = { ethereum: '0.016', polygon: '0.002', solana: '0.001' }
