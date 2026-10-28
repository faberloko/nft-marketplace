# Contexto do projeto para assistentes de IA

Leia este arquivo inteiro antes de qualquer alteração. Para detalhes, consulte `DOCUMENTACAO.md` (guia completo, função por função), `ARCHITECTURE.md` (decisões, contratos REST/eventos, cache) e `README.md` (comandos e cenários).

## O que é

Desafio frontend: **NFT Marketplace** em React + TypeScript, idioma da interface **pt-BR**. Fluxos: descoberta (catálogo, busca, filtros, ordenação, paginação na URL, detalhe), compra (carrinho, cupom, pagamento com carteira/rede, pedido idempotente, recibo) e conta (cadastro, login, sessão, perfil, avatar, senha, carteiras, favoritos). Desktop e mobile (390/768/1440 px).

**Não há backend real.** Todo o servidor (REST + Socket.IO) é simulado pelo **MSW** dentro do navegador, também no build de demonstração/deploy. Componentes, hooks e Axios **nunca** podem conter dados fictícios ou caminhos alternativos de negócio — isso é critério eliminatório do desafio.

## Stack obrigatória (todas devem continuar sendo usadas de verdade)

React 18 · TypeScript (strict) · TanStack Router (code-based, `src/router.tsx`) · TanStack Query · Axios · REST · socket.io-client · Tailwind CSS 3 · shadcn/ui (Radix, código em `src/components/ui/index.tsx`) · MSW 2 + `@mswjs/socket.io-binding` · Playwright · Lighthouse. Complementares: Vite 5, decimal.js, lucide-react, CVA, tailwind-merge, ESLint 9, docx.

Ambiente original: Windows 11, Node 18.20.4, npm 10. Funciona com Node ≥ 18.18.

## Mapa do código

| Caminho | Responsabilidade |
|---|---|
| `src/main.tsx` | Boot em ordem: MSW → restoreSession → wireSessionCache → startRealtime → router; marca `html[data-ready=true]`; config do QueryClient (retry só para erros retryable) |
| `src/api/types.ts` | Contratos únicos (Nft, Edition, Cart, Quote, Order, Wallet, ErrorCode, RealtimeEvent). **ETH é string decimal** |
| `src/api/client.ts` | Axios + `ApiError`; interceptors: Bearer + `X-Cart-Id`; TIMEOUT/NETWORK; 401 com token → `sessionStore.expire()` |
| `src/api/endpoints.ts` | Único lugar com URLs (`api.*` e `api.mock.*`) |
| `src/api/queries.ts` | `keys` (privado sob `['user', uid]`, carrinho sob `['cart', owner]`), favoritos otimistas com rollback, `useQuote`, `useCartMutation` |
| `src/lib/session-store.ts` | Sessão síncrona fora do React (token em localStorage `nft-session`, carrinho visitante `nft-guest-cart`) |
| `src/lib/auth.ts` | useSession, restoreSession, wireSessionCache (limpa cache privado ao trocar usuário), login/signup/logout |
| `src/lib/announcer.ts`, `draft.ts`, `eth.ts`, `env.ts` | aria-live/toasts; rascunhos em sessionStorage; formatação/multiplicação decimal; variáveis VITE_* |
| `src/realtime/socket.ts` | socket.io-client (**import dinâmico após o MSW**, transporte só websocket); `accept()` descarta eventId repetido e versão ≤ conhecida; reconcilia com REST em todo connect; filtra order.updated por userId |
| `src/mocks/fixtures.ts` | 36 NFTs determinísticos com nomes/preços do Figma (9 primeiros idênticos ao frame Início), 2 usuários, carteiras, cupons, taxas |
| `src/mocks/db.ts` | Estado do "servidor" em localStorage `nft-mock-db-v1`; `computeQuote`, `quoteSignature`, `hydrateCart` |
| `src/mocks/handlers.ts` | ~35 rotas REST; `network()` (latência/falhas), `auth()`, `mutateNft()` (única forma de mudar NFT → emite nft.updated), `settle()` de pedidos |
| `src/mocks/socket.ts` | Servidor Socket.IO simulado; order.updated só para o dono; replay/disconnect para testes |
| `src/mocks/scenarios.ts` | 15 cenários (`?scenario=a,b`), seed fixa 1234 |
| `src/mocks/browser.ts` | `startMocks()`, `?reset=1`, liquidação de pedidos a cada 500 ms |
| `src/router.tsx` | Rotas, `validateHomeSearch`, rota de layout `authed` (guard), lazy routes |
| `src/pages/*` | Home, NftDetail, Cart, Checkout, Order, Auth (Login/Signup), Profile, Wallets, NotFound |
| `src/components/*` | ui (shadcn), layout/RootLayout (header, drawer mobile, toaster, skip link), NftCard, Summary, MockPanel (painel "Cenários") |
| `tests/e2e/*` | Playwright: catalog, account, purchase, realtime, a11y-visual, smoke; `helpers.ts` (fresh, ready, mock, realtimeReady, login, addToCart) |
| `scripts/` | generate-art.mjs (SVGs), lighthouse.mjs, md2docx.cjs |

## Regras de negócio que não podem quebrar

- Valores ETH: strings + decimal.js; o total exibido é sempre o da cotação da API.
- Pedido: header `Idempotency-Key` (por quoteId, em sessionStorage). Mesma chave + mesmo corpo → mesmo pedido; corpo diferente → 409 `IDEMPOTENCY_CONFLICT`. Timeout/rede → reenvio com a mesma chave.
- Antes de criar o pedido, o servidor recalcula a cotação; mudança → 409 `QUOTE_STALE`/`OUT_OF_STOCK` com `details.quote`; usuário precisa aceitar (`POST /cart/acknowledge`) e confirmar de novo.
- Confirmação só com status `confirmed` vindo do servidor; confirmado/recusado são terminais; recibo usa o snapshot `order.quote`; só a quantidade comprada sai do carrinho.
- Eventos: envelope `{eventId, type, resource, version, userId?, data}`; nunca regredir versão nem reaplicar; eventos devem passar pelo socket.io-client (nunca simular direto no cache/UI).
- Isolamento: logout/troca de usuário remove `['user']`, `['cart']`, `['session']` e recria o socket.
- Carrinho do visitante é mesclado no login respeitando estoque e `maxPerOrder`.
- Rotas privadas: `/checkout`, `/orders/$orderId`, `/account/profile`, `/account/wallets`.

## Comandos

```
npm ci
npx playwright install chromium
npm run dev            # http://localhost:5173
npm run build          # tsc + vite build → dist/
npm run preview        # http://localhost:4173
npm run typecheck
npm run lint
npm run test:e2e       # 37 testes × desktop/mobile = 74 execuções (73 rodam; o de teclado é só desktop), todas passando
npm run test:e2e:update  # regrava baselines visuais (geradas no Windows; em outro SO rode uma vez)
npm run lighthouse     # relatórios em lighthouse/reports/
npm run docs:word      # regera Documentacao-NFT-Marketplace.docx a partir de DOCUMENTACAO.md
```

Credenciais fictícias: `ana@nft.test` / `Senha@123` (2 carteiras) e `bruno@nft.test` / `Senha@123`. Cupons: `WELCOME10`, `FLAT005`, `EXPIRED20` (vencido). Reset total: abrir `/?reset=1`.

## Armadilhas conhecidas (já resolvidas — não reintroduzir)

- `socket.io-client` precisa ser importado **depois** do `worker.start()` (engine.io captura `window.WebSocket` no load).
- Testes devem esperar `html[data-ready=true]` (helper `ready`) antes de chamar `fetch` dentro da página, senão a requisição escapa do MSW.
- Reconectar sempre invalida queries ativas (eventos emitidos antes do primeiro connect se perdiam).
- No Windows, `vite build` falha com EPERM se `vite preview` estiver rodando — pare o preview antes.
- Labels de formulário: evitar textos que colidam com `getByLabel('E-mail')` nos testes.
- `<main>` tem `min-h-[100svh]` para evitar CLS durante rotas lazy.

## Estado atual e pendências

- Tudo implementado; typecheck, lint e os 70 testes E2E passavam no último commit.
- Lighthouse (medianas): desktop 99 de desempenho; mobile 81–87 (abaixo da meta 90 por causa do boot do MSW); Best Practices ~81 apenas por script injetado pelo antivírus da máquina de medição; A11y 97–100; SEO 100.
- Layout implementado a partir do Figma "Frontend Challenge" (marca Kurio; frames em `design/figma/`): fundo `#140D0A`, superfície `#241612`, faixa `#38220F`, botões `#D28A4C`, preços `#E89B55`, texto `#F5F1EB`/`#CFB28C`, fonte Roboto Mono; ilustrações recortadas dos próprios frames (`public/nfts/kurio/`). `node scripts/figma-compare.mjs` gera capturas lado a lado com os frames em `design/compare/`.
- **Pendente:** fazer o **deploy** (Vercel recomendado; `vercel.json` e `public/_redirects` prontos).

## Como trabalhar neste projeto

- Mantenha o padrão: textos da UI em pt-BR, acessibilidade (Field com aria-describedby, aria-live via `announce`), estados de loading/vazio/erro em toda tela com dados.
- Qualquer mudança de contrato começa em `src/api/types.ts` e precisa refletir no handler MSW correspondente.
- Novas falhas simuladas entram como cenário em `scenarios.ts`, nunca como `if` nas telas.
- Depois de alterar: `npm run typecheck && npm run lint && npm run test:e2e`. Se mudar visual intencionalmente, `npm run test:e2e:update`.
- Atualize `DOCUMENTACAO.md` (e rode `npm run docs:word`) quando mudar comportamento.
