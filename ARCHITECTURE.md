# Arquitetura

## Camadas

```
UI (pages/, components/)  ──►  hooks Query (api/queries.ts)  ──►  api/endpoints.ts  ──►  Axios (api/client.ts)
          ▲                              ▲                                                    │ HTTP
          │ setQueryData/invalidate      │                                                    ▼
realtime/socket.ts (socket.io-client) ◄── WebSocket ──  MSW: mocks/socket.ts   ◄──  mocks/db.ts  ──►  mocks/handlers.ts (REST)
```

- `api/types.ts` é o contrato único usado por handlers MSW, Axios, Query e UI. Valores ETH são `string` decimais; quantidades são inteiros.
- Componentes e hooks não têm dados fictícios nem caminhos alternativos de negócio. Todo dado vem do Axios → MSW.
- `mocks/db.ts` é o estado do servidor simulado, compartilhado por REST e Socket.IO (persistido em `localStorage`). Toda mudança de catálogo passa por `mutateNft`, que incrementa a versão, persiste e emite `nft.updated`. Assim, REST e eventos sempre refletem o mesmo estado.
- Decimais: `decimal.js` no servidor (cálculo) e no cliente (somente apresentação/estimativa da linha). O resumo exibido é sempre o retornado pela cotação.

## Rotas (TanStack Router)

| Rota | Acesso | Observações |
|---|---|---|
| `/` | público | `q`, `category[]`, `minPrice`, `maxPrice`, `availability`, `sort`, `page` validados em `validateHomeSearch`; filtros reiniciam `page` |
| `/nft/$nftId` | público | 404 dedicado para NFT inexistente |
| `/cart` | público | carrinho de visitante (`X-Cart-Id`) ou do usuário |
| `/login`, `/signup` | público | `redirect` (apenas caminhos internos) e `reason=expired` |
| `/checkout`, `/orders/$orderId`, `/account/profile`, `/account/wallets` | privado | rota de layout `authed` com `beforeLoad` → `/login?redirect=…` |
| `*` | — | `NotFound` |

Páginas fora da rota inicial são carregadas sob demanda (`lazyRouteComponent`).

## Contratos REST (`/api`)

Erros: `{ error: { code, message, fields?, details? } }`. Códigos: `VALIDATION` 422 · `UNAUTHENTICATED` 401 · `FORBIDDEN`/`WALLET_REJECTED` 403 · `NOT_FOUND` 404 · `CONFLICT`/`OUT_OF_STOCK`/`QUOTE_STALE`/`IDEMPOTENCY_CONFLICT` 409 · `COUPON_INVALID`/`COUPON_EXPIRED` 422 · `TRANSIENT` 5xx. O cliente ainda gera `NETWORK` e `TIMEOUT`.

| Método e rota | Corpo / parâmetros | Resposta |
|---|---|---|
| `POST /auth/signup` | `{name, username, email, password}` + `X-Cart-Id` | 201 `Session`; 409 com `fields` |
| `POST /auth/login` | `{email, password}` + `X-Cart-Id` (mescla o carrinho do visitante) | `Session` |
| `GET /session` | Bearer | `Session`; 401 se expirada |
| `POST /auth/logout` | Bearer | 204 (encerra também os sockets do usuário) |
| `GET /nfts` | `q, category=a,b, minPrice, maxPrice, availability, sort, page, pageSize` | `Paginated<Nft>` |
| `GET /nfts/featured` · `GET /nfts/:id` | — | `Nft[]` · `Nft` / 404 |
| `GET /favorites` · `PUT/DELETE /favorites/:nftId` | Bearer | `string[]` |
| `GET /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:editionId` | `{nftId, editionId, quantity}` / `{quantity}` | `Cart`; 409 `OUT_OF_STOCK` com `details.max` |
| `POST /cart/acknowledge` | — | `Cart` com preços aceitos = atuais e quantidades ajustadas |
| `POST /quote` | `{network, coupon}` | `Quote` (`subtotal`, `discount`, `networkFee`, `total`, `issues[]`) |
| `POST /orders` | `Idempotency-Key` + `{quoteId, walletId, network, collector}` | 201 `Order` (pending); 200 mesma chave e mesmo conteúdo; 409 `IDEMPOTENCY_CONFLICT`; 409 `QUOTE_STALE`/`OUT_OF_STOCK` com `details.quote` |
| `GET /orders?status=` · `GET /orders/:id` | Bearer | `Order[]` · `Order` (404 para pedido de outro usuário) |
| `GET/PATCH /profile` · `POST /profile/avatar` · `POST /profile/password` | `{dataUrl}` / `{currentPassword, newPassword}` | `User` / 204 |
| `GET /wallets` · `POST /wallets` · `PATCH /wallets/:id` · `POST /wallets/:id/connect` | `WalletInput` / `{network}` | `Wallet`; 409 tipo/endereço duplicado |

## Eventos Socket.IO

Envelope: `{ eventId, type, resource: {type, id}, version, userId?, data, emittedAt }`.

| Evento | Destino | Efeito no cliente |
|---|---|---|
| `nft.updated` | todas as conexões | atualiza `['nft', id]`, listas `['nfts', …]` e destaques sem regredir versão; se o NFT está no carrinho, invalida carrinho e cotação e anuncia em `aria-live` |
| `order.updated` | apenas conexões do dono | atualiza `['user', uid, 'order', id]`; confirmado → invalida o carrinho |

- **Duplicatas/antigos**: `eventId` já visto é descartado; `version ≤ max(versão vista, versão em cache)` é descartado. Por isso não há regressão nem efeitos reaplicados.
- **Reconexão**: toda conexão (inclusive a primeira) chama `invalidateQueries({ refetchType: 'active' })`, que reconcilia com REST os eventos perdidos enquanto o socket estava desconectado.
- **Isolamento**: o socket é recriado a cada mudança de sessão (token na query do handshake). O servidor roteia `order.updated` por `userId`, e o cliente rejeita eventos cujo `userId` difere da sessão atual. Listeners são removidos (`removeAllListeners`) ao trocar de sessão.

### Transporte nos mocks e limitações

- `socket.io-client` com `transports: ['websocket']`. O `@mswjs/socket.io-binding` intercepta o WebSocket (MSW `ws.link`) e implementa o handshake Engine.IO/Socket.IO. Long-polling não é suportado.
- O binding não implementa namespaces, rooms nem acks. O roteamento por usuário é feito no handler.
- O MSW envia `ping` Engine.IO a cada 20 s para o cliente não encerrar por `pingTimeout`.
- O `socket.io-client` é importado dinamicamente **depois** de `worker.start()`, porque o engine.io guarda `window.WebSocket` ao carregar o módulo.
- Uma "queda" é simulada fechando o WebSocket do lado do servidor (`/__mock/disconnect`). O cliente reconecta pela política nativa (500 ms a 3 s).

## Sessão

- O token fica em `localStorage` (`nft-session`) e é validado no boot com `GET /session`. Expira em 8 h, ou a qualquer momento pelo cenário "Expirar sessão".
- Um 401 em requisição autenticada faz o interceptor do Axios chamar `sessionStore.expire()`. Em rota privada, o app redireciona para `/login?redirect=<rota atual>&reason=expired`. O rascunho do checkout (`sessionStorage`) e o cupom permanecem, e o login devolve o usuário ao ponto onde estava.
- Logout ou troca de usuário removem do cache tudo sob `['user']`, `['cart']` e `['session']`, além de recriar o socket.

## Carrinho

- O carrinho é mantido no servidor e identificado pelo usuário autenticado ou pelo `X-Cart-Id` do visitante (UUID em `localStorage`). No login/cadastro, o servidor mescla os itens do visitante respeitando o limite e a disponibilidade. Em seguida, o cliente gera um novo id de visitante.
- Cada item guarda o **preço aceito**. Se o preço atual for diferente, o item volta com `previousPriceEth` e a cotação aponta `PRICE_CHANGED`. Nesse caso, o checkout e a confirmação ficam bloqueados até o usuário "Aceitar valores atuais" (`/cart/acknowledge`).
- Após a confirmação, o servidor remove apenas as quantidades compradas. Em recusa ou falha, nada é removido.

## Pedido e idempotência

- A chave de idempotência é um UUID por `quoteId`, guardado em `sessionStorage`. Em `TIMEOUT` ou `NETWORK`, o cliente reenvia com a mesma chave (até 2 vezes) e recebe o pedido já criado. Cliques repetidos são barrados pelo `isPending` e por um `ref` síncrono.
- Antes de criar o pedido, o servidor recalcula a cotação. Se a assinatura (rede, total, cupom, preços, disponibilidade) mudou, responde 409 com a nova cotação e a UI exige uma nova confirmação.
- O estado `pending` é persistido com `settleAt`. A liquidação acontece por timer, por consulta REST ou por `/__mock/settle`, e por isso sobrevive a refresh. `confirmed` e `declined` são terminais. A tela do pedido usa o evento como caminho principal e faz polling de 5 s enquanto o pedido está pendente, como reconciliação.
- O recibo exibe `order.quote`, o snapshot congelado na criação. Mudanças posteriores no catálogo não o alteram.

## Cache, retries e sincronização (TanStack Query)

| Dado | Chave | staleTime | Observações |
|---|---|---|---|
| Catálogo | `['nfts', params]` | 30 s | `keepPreviousData`, `AbortSignal` repassado ao Axios: respostas obsoletas são canceladas ou ignoradas por chave |
| Detalhe | `['nft', id]` | 30 s | sem retry para `NOT_FOUND` |
| Carrinho/cotação | `['cart', owner]`, `['cart', owner, 'quote', network, coupon]` | 10 s / 0 | mutations fazem `setQueryData` e invalidam a cotação por prefixo |
| Privados | `['user', uid, …]` | 15 s | removidos no logout/troca |

- Retries: apenas para erros `TRANSIENT`/`NETWORK`/`TIMEOUT`, até 2, com backoff exponencial (máx. 3 s). Mutations não fazem retry automático. A exceção é a criação de pedido, que reenvia com a mesma chave de idempotência.
- Atualização otimista: favoritos (`onMutate` → rollback em `onError`, anúncio acessível).
- `refetchOnWindowFocus` ligado. Estados de atualização em segundo plano aparecem como "atualizando…" e `aria-busy`.

## Acessibilidade

Skip link, foco movido para `<main>` ao trocar de rota, diálogos/drawers Radix com focus trap e retorno de foco, `Field` associando label/hint/erro via `aria-describedby` + `aria-invalid`, ícones de erro além da cor, regiões `aria-live` (polite/assertive) para mutations e eventos em tempo real, `prefers-reduced-motion` desliga shimmer e animações.

## Desvios do Figma e substituição de assets

- Layout implementado a partir do Figma "Frontend Challenge" (marca Kurio; frames em `design/figma/`): fundo `#140D0A`, superfície `#241612`, faixa `#38220F`, botões `#D28A4C`, preços `#E89B55`, texto `#F5F1EB`/`#CFB28C`, fonte Roboto Mono; ilustrações recortadas dos próprios frames (`public/nfts/kurio/`).
- Tokens medidos por amostragem de pixels dos frames (`scripts/figma-probe.cjs`) e conferidos com capturas lado a lado (`scripts/figma-compare.mjs` → `design/compare/`).
- Assets: as ilustrações dos macacos foram recortadas dos frames exportados (o arquivo não trazia os originais); o ícone "Thank you" também. Resolução limitada à dos frames (até ~400 px), ampliadas para 480/800 px.
- Ajustes deliberados: rótulos visíveis ou `sr-only` em campos que no Figma só têm placeholder (login/cadastro); "Disponibilidade" saiu do painel lateral (não existe no frame), mas o parâmetro continua aceito na URL; no mobile a ordenação fica dentro da gaveta de filtros; o pagamento mobile mantém o formulário do colecionador abaixo das carteiras (necessário para validar os campos obrigatórios); a revisão do pedido abre em um diálogo antes do envio.
- Itens fora do escopo presentes no layout (Criadores, Aprenda, Atividade, Ofertas, Arquivos baixados, Suporte, Diário da Cunhagem, login social, newsletter, leitor de QR) aparecem fielmente, mas avisam "disponível em breve" — nunca aparentam sucesso.
- As imagens das NFTs e os avatares são SVGs gerados de forma determinística (`scripts/generate-art.mjs`), versionados em `public/nfts`, para não depender de assets externos.
- Ajustes de acessibilidade: o texto secundário ficou em `#CCCCCC` (o cinza `#858584` do kit não atinge 4.5:1 sobre `#3B3B3B`) e os campos de formulário ganharam rótulos visíveis.
- Itens fora do escopo (rankings, newsletter) não fingem sucesso. A newsletter informa que não está disponível na demonstração.

## Lighthouse (resultados em `lighthouse/reports/summary.md`)

Medianas no build otimizado, cenário padrão, Chrome 13ª ger. i7 no Windows:

| Página | Perfil | Perf | A11y | BP | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| início | mobile | 81 | 100 | 82* | 100 | 3,5 s | 0,028 | 267 ms |
| detalhe | mobile | 87 | 100 | 82* | 100 | 3,5 s | 0,000 | 114 ms |
| início | desktop | 99 | 97 | 81* | 100 | 0,9 s | 0,002 | 27 ms |
| detalhe | desktop | 99 | 100 | 81* | 100 | 0,9 s | 0,000 | 0 ms |

Justificativas:

- **Best Practices (\*)**: a única auditoria reprovada é `is-on-https`, causada por um script injetado pelo antivírus da máquina de medição (`http://gc.kis.v2.scr.kaspersky-labs.com/...`). Não é um recurso do app. Para medir sem essa interferência, rode `LH_BASE_URL=https://<deploy> npm run lighthouse` ou desative a injeção do antivírus.
- **Performance mobile < 90**: o LCP depende da cadeia de boot do MSW (download do chunk do MSW de ~99 kB gzip, registro do Service Worker, latência simulada de 120–300 ms e só então render). Esse é o custo de manter os mocks reais no build de demonstração, conforme exigido. Com 4G lento simulado e CPU 4×, esse caminho soma cerca de 1,5 s. Um import estático do MSW foi testado e piorou o TBT (570 ms), por isso foi revertido. O CLS do detalhe caiu de 0,78 para 0,00 ao reservar a altura do `<main>` durante o carregamento de rotas lazy.

## Limitações conhecidas

- O banco simulado e os timers de liquidação rodam por aba. Duas abas abertas compartilham o `localStorage`, mas não os sockets.
- Não há long-polling nem multiplexação Socket.IO no ambiente de mocks.
- O link do explorador de blocos e o hash da transação são simulados.
