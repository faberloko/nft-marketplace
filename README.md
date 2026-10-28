# NFT Marketplace — Desafio Frontend

React 18 + TypeScript · TanStack Router · TanStack Query · Axios · Socket.IO (cliente) · Tailwind + shadcn/ui · MSW (REST + `@mswjs/socket.io-binding`) · Playwright · Lighthouse.

Todo o "backend" (REST, sessão, carteiras, pagamentos e eventos em tempo real) é simulado na camada de rede pelo MSW. Nenhum serviço externo é necessário.

## Requisitos

- Node.js ≥ 18.18 (testado com 18.20.4) e npm 10
- Chrome instalado (Lighthouse). O Playwright baixa o próprio Chromium.

## Setup

```bash
npm ci
npx playwright install chromium
cp .env.example .env   # opcional: os valores padrão já funcionam
npm run dev            # http://localhost:5173 com mocks ativos
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (REST + Socket.IO). Ativo também no build de demonstração/deploy. |
| `VITE_API_URL` | `/api` | Base REST usada pelo Axios. |
| `VITE_SOCKET_URL` | `wss://realtime.nft.mock` | URL do Socket.IO. Host fictício: só existe dentro do MSW. |
| `VITE_REQUEST_TIMEOUT_MS` | `8000` | Timeout do Axios (usado no cenário de timeout do pedido). |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Verificação de tipos + build otimizado (`dist/`) |
| `npm run preview` | Serve o build em `http://localhost:4173` |
| `npm run typecheck` | `tsc` sem emitir |
| `npm run lint` | ESLint (TS + regras de hooks) |
| `npm run test:e2e` | Playwright (builda e sobe o preview automaticamente), desktop 1440 px e mobile 390 px |
| `npm run test:e2e:update` | Regrava as baselines visuais |
| `npx playwright show-report` | Relatório HTML; traces/vídeos ficam em `test-results/` para testes que falharam |
| `npm run docs:word` | Regera `Documentacao-NFT-Marketplace.docx` a partir de `DOCUMENTACAO.md` |
| `npm run lighthouse` | 3 execuções × (início, detalhe) × (mobile, desktop) no build; relatórios em `lighthouse/reports/` |

## Credenciais fictícias

| Usuário | E-mail | Senha |
|---|---|---|
| Ana Souza (2 carteiras, 2 favoritos) | `ana@nft.test` | `Senha@123` |
| Bruno Lima (sem carteiras) | `bruno@nft.test` | `Senha@123` |

Senhas são armazenadas apenas como SHA-256 com sal no banco simulado. Cupons: `WELCOME10` (10 %), `FLAT005` (0,05 ETH), `EXPIRED20` (expirado); qualquer outro é inválido.

## Cenários, reset e reprodução de falhas

- **Painel "Cenários"** (botão flutuante no canto inferior direito): marca condições, aplica, reseta e dispara eventos.
- **Pela URL**: `?scenario=slow,favorite-fail` ativa e persiste cenários; `?reset=1` restaura integralmente o banco simulado, a sessão e o carrinho de visitante (`?reset=1&scenario=instant` é o ponto de partida dos testes).
- **Pela API simulada**: `POST /api/__mock/reset`, `/__mock/scenarios`, `/__mock/expire-sessions`, `/__mock/nft-update`, `/__mock/replay`, `/__mock/disconnect`, `/__mock/settle`.

| Cenário | Como reproduzir |
|---|---|
| Lentidão / skeletons | `?scenario=slow` e recarregue |
| Latência variável (seed fixa) | `?scenario=variable` |
| Respostas fora de ordem | `?scenario=out-of-order`; buscas com termo de tamanho ímpar respondem 1,8 s, pares 150 ms (digite `robot` e depois `galaxy`) |
| Sem conexão | `?scenario=offline` |
| HTTP 500 / 503 transitório | `?scenario=server-error` · `?scenario=flaky` (1ª chamada de cada rota falha, retry recupera) |
| Catálogo vazio | `?scenario=empty` |
| Sessão expirada | Painel → "Expirar sessão" e interaja com uma tela privada |
| Conflito de cadastro | Cadastre com `ana@nft.test` ou usuário `brunolima` |
| Cupom inválido/expirado | `XYZ` / `EXPIRED20` no carrinho |
| Preço alterado / esgotado na compra | `?scenario=price-change-checkout` ou `sold-out-checkout` e confirme a compra |
| Preço alterado durante a navegação | Com item no carrinho: painel → "Alterar preço" ou "Esgotar edição" |
| Timeout após criar pedido | `?scenario=order-timeout` e confirme (o servidor cria o pedido e só responde após 15 s; o cliente reenvia com a mesma chave) |
| Pagamento recusado | `?scenario=payment-declined` |
| Carteira recusa conexão | `?scenario=wallet-reject` |
| Evento duplicado / antigo | Painel → "Reenviar evento duplicado" / "Enviar evento antigo" |
| Queda do socket / pedido pendente | Confirme a compra, painel → "Derrubar socket" e/ou recarregue a página |

## Deploy

O build é estático (`dist/`) com MSW ativo. `vercel.json` e `public/_redirects` (Netlify/Cloudflare Pages) reescrevem rotas para `index.html`, preservando `mockServiceWorker.js` e assets — acesso direto e refresh funcionam em qualquer rota.

```bash
npm run build && npx vercel deploy --prod
```

Veja decisões, contratos e limitações em [ARCHITECTURE.md](ARCHITECTURE.md). Guia completo para iniciantes e referência de cada função: [DOCUMENTACAO.md](DOCUMENTACAO.md) (também em Word: `Documentacao-NFT-Marketplace.docx`).

## Continuar em outra máquina com IA

Para qualquer IA (ChatGPT, Gemini, Claude, Copilot etc.), cole o conteúdo de [PROMPT-UNIVERSAL.txt](PROMPT-UNIVERSAL.txt) como primeira mensagem: ele é autossuficiente, mesmo se a IA não conseguir abrir o zip. [PROMPT-NOVA-CONVERSA.md](PROMPT-NOVA-CONVERSA.md) é uma versão curta para quando a IA consegue ler os arquivos. [AGENTS.md](AGENTS.md) é lido automaticamente por Codex, Cursor, Copilot e outros. O arquivo [CLAUDE.md](CLAUDE.md) é lido automaticamente pelo Claude Code e resume o projeto para a IA.
