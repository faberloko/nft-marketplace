# NFT Marketplace — Documentação completa

Este documento explica **tudo** sobre o projeto em três partes:

- **Parte 1 — Entendendo o projeto:** o que é, para que serve e como funciona, em linguagem simples. Não exige conhecimento de programação.
- **Parte 2 — Instalar, rodar, testar e configurar:** passo a passo para colocar o projeto para funcionar em qualquer computador.
- **Parte 3 — Referência técnica:** cada arquivo, função e componente do código explicado em detalhe.

---

# Parte 1 — Entendendo o projeto

## 1.1 O que é este projeto

É um **site de loja de NFTs** (artes digitais colecionáveis). Pense numa loja virtual comum, como uma livraria online, só que os produtos são obras de arte digitais. Nele a pessoa pode:

- **Navegar** pelo catálogo de artes, buscar por nome, filtrar por categoria e preço e ordenar os resultados.
- **Ver os detalhes** de uma arte: imagens, descrição, artista, edições disponíveis e preço.
- **Colocar no carrinho**, mudar quantidades, aplicar cupom de desconto e ver o total.
- **Pagar** com uma "carteira digital" (a forma de pagamento usada com criptomoedas) e receber um **recibo**.
- **Criar conta, entrar e sair**, editar o perfil, trocar a foto e a senha e cadastrar carteiras.
- **Favoritar** artes.

Os preços são em **ETH** (Ether, uma criptomoeda).

## 1.2 O que é "simulado" e por quê

Uma loja de verdade tem duas partes:

1. **Frontend:** o site que a pessoa vê e usa no navegador.
2. **Backend:** o servidor que guarda os dados, confere senhas, processa pagamentos e avisa sobre mudanças.

O desafio pedia **apenas o frontend**. Por isso, o backend foi **simulado dentro do próprio navegador** por uma ferramenta chamada **MSW** (Mock Service Worker). Funciona assim: quando o site pede "me dê a lista de NFTs", o MSW intercepta esse pedido e responde como se fosse um servidor de verdade.

**Analogia:** é como um ensaio de teatro em que um ator substitui outro que ainda não chegou. O resto do elenco (o site) atua normalmente; só quem responde é o substituto (o MSW).

**Vantagem:** o site foi escrito exatamente como seria com um servidor real. Para ligá-lo a um backend verdadeiro no futuro, basta desligar o MSW por configuração; nenhuma tela precisa mudar.

**O que é falso de propósito:**

- Nenhum dinheiro real é movimentado.
- Nenhuma blockchain é acessada.
- Carteiras, códigos de transação e links de "explorador" são inventados.
- Os dados ficam guardados no próprio navegador.

## 1.3 Glossário

| Termo | Significado simples |
|---|---|
| NFT | Uma obra digital com certificado de autenticidade. Aqui, são as artes vendidas. |
| ETH | Ether, a moeda usada para os preços. |
| Edição | Versão de uma arte (Standard, Gold, Genesis), com preço e estoque próprios. |
| Carteira | Conta digital de onde sairia o pagamento. Aqui é só um cadastro de endereço. |
| Rede | "Estrada" por onde o pagamento passaria (Ethereum, Polygon, Solana). Cada uma tem uma taxa. |
| Cotação | Cálculo oficial do total feito pelo "servidor": subtotal, desconto, taxa e total. |
| Frontend | A parte visual do site, que roda no navegador. |
| Backend | O servidor que guarda e processa dados. Aqui, simulado. |
| API / REST | A "linguagem" de pedidos e respostas entre o site e o servidor (ex.: GET /nfts). |
| Mock | Uma imitação de algo real, usada para desenvolver e testar. |
| MSW | Ferramenta que cria o servidor de imitação dentro do navegador. |
| Socket / tempo real | Canal aberto em que o servidor avisa o site na hora sobre mudanças (ex.: preço mudou). |
| Cache | Memória temporária do site para não pedir o mesmo dado toda hora. |
| Sessão | O período em que você está logado. Ela expira depois de um tempo. |
| Idempotência | Garantia de que repetir o mesmo pedido não cria duas compras. |
| Teste E2E | Teste "de ponta a ponta": um robô abre o navegador e usa o site como uma pessoa. |
| Baseline visual | Foto de referência de uma tela; o teste compara com ela para achar mudanças visuais. |
| Lighthouse | Ferramenta do Google que dá notas de velocidade, acessibilidade e boas práticas. |
| Build | Versão otimizada e compactada do site, pronta para publicar. |
| Deploy | Publicar o site na internet. |
| Node.js / npm | Programa que roda as ferramentas do projeto / instalador dessas ferramentas. |
| Terminal | Janela onde se digitam comandos (no Windows: PowerShell ou Prompt de Comando). |

## 1.4 Como as peças conversam

Quando você abre o site, acontece isto:

1. O navegador carrega o site.
2. O site liga o **servidor simulado** (MSW).
3. O site confere se você já estava logado.
4. O site abre o **canal de tempo real** (socket) para receber avisos.
5. A tela aparece e começa a pedir dados (catálogo, carrinho etc.).

Quando você clica em algo, por exemplo "COMPRAR" no detalhe de um NFT:

1. A tela chama uma função do site.
2. Essa função envia um pedido ao "servidor" (`POST /api/cart/items`).
3. O MSW responde: confere o estoque, salva e devolve o carrinho atualizado.
4. O site guarda a resposta na memória (cache) e atualiza a tela.
5. Uma mensagem é anunciada para leitores de tela: "1 item adicionado ao carrinho".

Quando algo muda "no servidor", por exemplo o preço de um NFT:

1. O servidor simulado altera o preço e manda um aviso pelo socket (`nft.updated`).
2. O site recebe, confere se o aviso é novo (e não repetido ou antigo) e atualiza as telas.
3. Se esse NFT está no seu carrinho, aparece um aviso e o pagamento fica bloqueado até você aceitar o novo valor.

## 1.5 As telas

| Tela | Endereço | O que faz | Precisa login? |
|---|---|---|---|
| Início | `/` | Destaque, catálogo, busca, filtros, ordenação e páginas | Não |
| Detalhe do NFT | `/nft/nft-1` | Galeria, edições, quantidade, favoritar, adicionar ao carrinho | Não (favoritar sim) |
| Carrinho | `/cart` | Quantidades, remover, cupom e resumo de valores | Não |
| Entrar | `/login` | Login e volta para onde você estava | — |
| Criar conta | `/signup` | Cadastro com validação | — |
| Pagamento | `/checkout` | Dados, carteira e rede, revisão e confirmação | Sim |
| Pedido / recibo | `/orders/<id>` | Aguardando, confirmado (recibo) ou recusado | Sim |
| Perfil | `/account/profile` | Nome de exibição, usuário, e-mail, nome ENS, apelido da carteira, avatar e senha | Sim |
| Lista de interesse | `/favoritos` | NFTs favoritados | Sim |
| Carteiras | `/account/wallets` | Carteira principal e secundária | Sim |
| Página não encontrada | qualquer outro endereço | Aviso de erro 404 | Não |

Todas as telas funcionam no computador, no tablet e no celular.

## 1.6 Garantias importantes (em linguagem simples)

- **Valores sempre exatos.** Os preços nunca passam por contas de ponto flutuante, que causariam erros como 0,1 + 0,2 = 0,30000000000000004. Usa-se uma biblioteca de matemática decimal.
- **Nunca há compra duplicada.** Se você clicar várias vezes em "Confirmar" ou se a internet cair no meio, o site reenvia o mesmo pedido com a mesma "senha de tentativa" (chave de idempotência), e o servidor reconhece que é a mesma compra.
- **Nunca se compra com preço desatualizado.** Antes de confirmar, o servidor recalcula tudo. Se algo mudou, você precisa aceitar os novos valores.
- **O recibo não muda depois.** Ele guarda uma "foto" dos valores no momento da compra.
- **Os dados de um usuário não aparecem para outro.** Ao sair ou trocar de conta, a memória do site é limpa.
- **Recarregar a página não perde nada.** Carrinho, sessão e pedido pendente continuam lá.
- **Acessibilidade.** O site pode ser usado só com o teclado, funciona com leitores de tela e não depende só de cores para comunicar.

---

# Parte 2 — Instalar, rodar, testar e configurar

## 2.1 O que você precisa instalar (uma única vez)

| Programa | Para quê | Versão | Onde baixar |
|---|---|---|---|
| Node.js | Roda todas as ferramentas do projeto | 18.18 ou mais nova (recomendado: 20 LTS) | https://nodejs.org (botão "LTS") |
| Google Chrome | Necessário para o Lighthouse | Qualquer versão recente | https://www.google.com/chrome |
| Git (opcional) | Baixar e versionar o código | Qualquer | https://git-scm.com |

O **npm** já vem junto com o Node.js.

**Como conferir se instalou certo:** abra o terminal e digite:

```
node -v
npm -v
```

Devem aparecer números de versão (ex.: `v20.11.0` e `10.2.4`). Se aparecer "comando não encontrado", feche e abra o terminal de novo, ou reinstale o Node.js.

**Como abrir o terminal:**

- **Windows:** menu Iniciar → digite "PowerShell" → Enter.
- **macOS:** Spotlight (Cmd + Espaço) → digite "Terminal" → Enter.
- **Linux:** Ctrl + Alt + T.

## 2.2 Colocar o projeto em outra máquina, passo a passo

**Passo 1 — Obter o código.** Escolha uma opção:

- **Pelo arquivo .zip:** copie `nft-marketplace.zip` para o computador e descompacte (botão direito → "Extrair tudo" no Windows; duplo clique no macOS). Será criada a pasta `nft-marketplace`.
- **Pelo Git:** `git clone <endereço-do-repositório>`.

**Passo 2 — Entrar na pasta pelo terminal.** Exemplo, se a pasta estiver na Área de Trabalho:

```
cd Desktop/nft-marketplace
```

Dica: no Windows, você pode digitar `cd ` (com espaço) e arrastar a pasta para dentro do terminal.

**Passo 3 — Instalar as dependências** (bibliotecas do projeto; leva de 1 a 3 minutos):

```
npm ci
```

Isso cria a pasta `node_modules`. O comando `npm ci` usa as versões exatas do arquivo `package-lock.json`, então todos instalam a mesma coisa.

**Passo 4 — Instalar o navegador dos testes** (só necessário para rodar os testes):

```
npx playwright install chromium
```

**Passo 5 — (Opcional) Criar o arquivo de configuração:**

```
cp .env.example .env
```

No Windows (PowerShell): `Copy-Item .env.example .env`. Sem esse arquivo, os valores padrão já funcionam.

**Passo 6 — Iniciar o site:**

```
npm run dev
```

O terminal mostra um endereço como `http://localhost:5173`. Abra-o no navegador. Para parar o site, volte ao terminal e aperte **Ctrl + C**.

## 2.3 Como acessar e usar

**Contas de teste prontas:**

| Usuário | E-mail | Senha | Particularidade |
|---|---|---|---|
| Ana Souza | `ana@nft.test` | `Senha@123` | Já tem 2 carteiras e 2 favoritos; ideal para comprar |
| Bruno Lima | `bruno@nft.test` | `Senha@123` | Sem carteiras; ideal para testar o cadastro de carteiras |

Você também pode criar uma conta nova em "Cadastrar". A senha precisa de 8 caracteres, uma letra maiúscula e um número.

**Cupons:**

| Código | Efeito |
|---|---|
| `WELCOME10` | 10% de desconto |
| `FLAT005` | 0,05 ETH de desconto |
| `EXPIRED20` | Cupom vencido (mostra o erro) |
| Qualquer outro | Cupom inválido (mostra o erro) |

**Roteiro para uma compra completa:**

1. No início, clique em uma arte.
2. Escolha a edição (1/1, 1/10, 1/50 ou ABERTA) e a quantidade e clique em "COMPRAR" (no celular, "Comprar NFT"). O NFT vai para o carrinho.
3. Clique em "Ir para o carrinho" e, se quiser, aplique `WELCOME10`.
4. Clique em "Entrar para finalizar" e entre com a Ana.
5. No pagamento, os dados do colecionador já vêm preenchidos com a carteira principal. Preencha o código de indicação (ex.: KURIO2026) e, em "Carteira e rede", escolha MetaMask, WalletConnect ou Coinbase Wallet: a conexão é simulada na hora.
6. Clique em "Confirmar compra", revise o resumo no diálogo e clique em "Confirmar e pagar".
7. Aparece "Aguardando confirmação" e, em cerca de 3 segundos, "Pedido confirmado" com o recibo.

## 2.4 Configuração (arquivo `.env`)

| Variável | Valor padrão | O que controla |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Liga o servidor simulado. Com `false`, o site tentaria um backend real. |
| `VITE_API_URL` | `/api` | Endereço base da API. |
| `VITE_SOCKET_URL` | `wss://realtime.nft.mock` | Endereço do tempo real. É fictício e só existe dentro do MSW. |
| `VITE_REQUEST_TIMEOUT_MS` | `8000` | Tempo máximo, em milissegundos, para esperar uma resposta. |

Depois de mudar o `.env`, pare o site (Ctrl + C) e rode `npm run dev` de novo.

## 2.5 Simulando problemas (cenários)

Para demonstrar como o site reage a falhas, existem **15 cenários**. Há três formas de ativar:

1. **Botão "Cenários"** no canto inferior direito do site: marque as opções e clique em "Aplicar e recarregar". O mesmo painel tem botões para alterar preço, esgotar item, derrubar a conexão, expirar a sessão e liquidar pedidos.
2. **Pelo endereço:** acrescente `?scenario=nome` à URL. Para combinar, separe por vírgula: `http://localhost:5173/?scenario=slow,favorite-fail`.
3. **Para recomeçar do zero:** `http://localhost:5173/?reset=1`. Isso apaga todas as mudanças e volta aos dados originais.

| Cenário | O que acontece |
|---|---|
| `slow` | Toda resposta demora 2,5 s; dá para ver os "esqueletos" de carregamento |
| `variable` | Demora varia, mas sempre na mesma sequência |
| `out-of-order` | Respostas chegam fora de ordem; o site mostra sempre a busca mais recente |
| `offline` | Simula internet desligada |
| `server-error` | O catálogo responde erro 500 |
| `flaky` | A primeira tentativa de cada operação falha; a nova tentativa funciona |
| `empty` | Catálogo sem nenhum item |
| `favorite-fail` | Favoritar falha, e o coração volta ao estado anterior |
| `price-change-checkout` | O preço sobe na hora de confirmar a compra |
| `sold-out-checkout` | A edição esgota na hora de confirmar |
| `order-timeout` | O servidor demora 15 s; o site reenvia e recupera o mesmo pedido |
| `payment-declined` | O pagamento é recusado |
| `wallet-reject` | A carteira recusa a conexão |
| `instant` | Sem nenhuma demora (usado nos testes) |
| `default` | Comportamento normal |

## 2.6 Testes automáticos

**O que são:** um robô (Playwright) abre um navegador Chromium, usa o site como uma pessoa (digita, clica, navega) e confere se o resultado está certo. São 37 testes, executados em duas telas (computador 1440 px e celular 390 px), somando **74 execuções** (o teste de teclado físico roda só no computador), todas passando.

**O que é testado:**

- Catálogo: busca, filtros combinados, ordenação, páginas, voltar e avançar do navegador, resultados fora de ordem, lentidão, erro e nova tentativa.
- Detalhe: acesso direto pelo endereço, NFT inexistente, edição esgotada e limite de quantidade.
- Conta: cadastro (incluindo e-mail repetido), login, sessão expirada, logout, troca de usuário sem vazar dados, favoritos com falha, perfil, foto, senha e carteiras.
- Carrinho e compra: quantidades, cupom, persistência após recarregar e após login, compra completa até o recibo, pagamento recusado, clique repetido, timeout, preço que muda e carteira recusada.
- Tempo real: aviso de mudança durante o pagamento, avisos repetidos ou antigos ignorados, queda de conexão com pedido pendente e reconexão.
- Acessibilidade: uso só pelo teclado, foco preso dentro de janelas, mensagens de erro ligadas aos campos e ausência de rolagem lateral.
- Visual: compara as telas de início, detalhe, carrinho e pagamento com fotos de referência.

**Como rodar:**

| Comando | O que faz |
|---|---|
| `npm run test:e2e` | Roda todos os testes. Gera o build e sobe o site sozinho. Leva cerca de 4 minutos. |
| `npx playwright test --project=desktop` | Só na tela de computador |
| `npx playwright test --project=mobile` | Só na tela de celular |
| `npx playwright test catalog` | Só o arquivo `catalog.spec.ts` |
| `npx playwright test -g "compra completa"` | Só os testes cujo nome contém o texto |
| `npx playwright test --headed` | Mostra o navegador enquanto o robô trabalha |
| `npx playwright test --ui` | Abre uma interface para escolher e assistir aos testes |
| `npx playwright show-report` | Abre o relatório HTML da última execução |
| `npm run test:e2e:update` | Atualiza as fotos de referência (use só quando a mudança visual for intencional) |

**Quando um teste falha:** o relatório mostra o erro, uma captura de tela, um vídeo e um "trace" (gravação passo a passo). Para abrir o trace: `npx playwright show-trace test-results/<pasta-do-teste>/trace.zip`.

**Observação sobre as fotos de referência:** elas foram geradas no Windows. Em macOS ou Linux, a renderização de fontes muda levemente e os 8 testes visuais podem falhar na primeira vez. Nesse caso, rode `npm run test:e2e:update` uma vez nessa máquina para criar as referências dela.

## 2.7 Outros comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Site em modo desenvolvimento (atualiza sozinho ao editar o código) |
| `npm run build` | Confere os tipos e gera a versão otimizada na pasta `dist/` |
| `npm run preview` | Abre a versão otimizada em `http://localhost:4173` |
| `npm run typecheck` | Só confere se o TypeScript está sem erros |
| `npm run lint` | Confere o padrão do código (ESLint) |
| `npm run lighthouse` | Mede desempenho e qualidade (ver 2.8) |

## 2.8 Medição de desempenho (Lighthouse)

`npm run lighthouse` gera o build, abre o Chrome, mede as páginas de início e detalhe três vezes em modo celular e três em modo computador e salva os resultados em `lighthouse/reports/`:

- `summary.md`: tabela com a mediana das notas.
- `*.html`: relatório completo de cada medição. Dê dois cliques para abrir.

Resultados obtidos (layout do Figma): 99 em desempenho no computador e 81–87 no celular, acessibilidade de 97–100 e SEO 100. As justificativas para as notas abaixo da meta estão no `ARCHITECTURE.md`. Uma delas é que o antivírus da máquina de medição injetou um script que reduziu a nota de "Boas práticas".

Para medir o site publicado: `LH_BASE_URL=https://seu-site.vercel.app npm run lighthouse`. No PowerShell: `$env:LH_BASE_URL="https://..."; npm run lighthouse`.

## 2.9 Publicar na internet (deploy)

O projeto já vem preparado para a Vercel (`vercel.json`) e para Netlify e Cloudflare Pages (`public/_redirects`). Esses arquivos garantem que abrir qualquer endereço direto, como `/cart`, funcione.

**Vercel:**

1. Crie uma conta em https://vercel.com.
2. No terminal: `npx vercel login`.
3. Depois: `npx vercel deploy --prod`.
4. Configurações: framework "Vite", comando de build `npm run build`, pasta de saída `dist`.

O servidor simulado continua ativo na versão publicada, então tudo funciona sem backend.

## 2.10 Problemas comuns

| Problema | Solução |
|---|---|
| `node` ou `npm` "não reconhecido" | Instale o Node.js e abra um terminal novo |
| Erro ao rodar `npm ci` | Confira a versão do Node (18.18+). Apague `node_modules` e rode de novo |
| A porta 5173 ou 4173 está em uso | Feche o outro terminal que está rodando o site, ou reinicie o computador |
| O site abre mas fica vazio | Recarregue com Ctrl + Shift + R; ou abra com `?reset=1` |
| Os dados ficaram estranhos depois de testes | Abra `/?reset=1` ou use "Resetar tudo" no painel de Cenários |
| Os testes visuais falham em outra máquina | Rode `npm run test:e2e:update` uma vez nessa máquina |
| O Lighthouse não encontra o Chrome | Instale o Chrome ou defina `CHROME_PATH` com o caminho do executável |
| No Windows, aparece "EPERM" durante o build | Feche o `npm run preview` que está aberto e tente novamente |
| Esqueci a senha de uma conta criada | Use `?reset=1` (apaga as contas criadas) ou as contas de teste |

## 2.11 Estrutura de pastas

```
nft-marketplace/
├── src/                  código do site
│   ├── api/              contratos, cliente HTTP e consultas
│   ├── mocks/            servidor simulado (MSW)
│   ├── realtime/         canal de tempo real
│   ├── lib/              sessão, utilitários, anúncios
│   ├── pages/            uma tela por arquivo
│   ├── components/       peças visuais reutilizáveis
│   ├── router.tsx        mapa de endereços
│   └── main.tsx          ponto de partida
├── tests/e2e/            testes automáticos e fotos de referência
├── public/               imagens, ícone e o service worker do MSW
├── scripts/              geração de arte e Lighthouse
├── lighthouse/           configuração e relatórios de desempenho
├── README.md             resumo e comandos
├── ARCHITECTURE.md       decisões técnicas
└── DOCUMENTACAO.md       este documento
```

---

# Parte 3 — Referência técnica explicada

Esta parte descreve **cada arquivo do código**. Para que qualquer pessoa consiga acompanhar, cada item segue o mesmo formato:

- **Em palavras simples:** o que aquele código faz, sem jargão.
- **Como funciona:** o passo a passo da lógica.
- **Por que assim:** o motivo da escolha.

Termos técnicos aparecem com uma explicação curta na primeira vez. O glossário da seção 1.3 também ajuda.

## 3.1 Conceitos que aparecem em todo o código

Antes dos arquivos, cinco ideias que se repetem:

- **Função:** um bloco de código com nome, que recebe dados e devolve um resultado. Exemplo: `formatEth("1.5")` devolve `"1.5 ETH"`.
- **Componente:** uma função que desenha um pedaço da tela (um botão, um card, uma página inteira). O nome começa com letra maiúscula, como `NftCard`.
- **Hook:** uma função especial do React cujo nome começa com `use` (como `useSession`). Ela deixa um componente "lembrar" de dados ou reagir a mudanças.
- **Tipo (TypeScript):** uma descrição do formato de um dado, por exemplo "um NFT tem `id` (texto), `name` (texto) e `editions` (lista)". O TypeScript avisa antes de rodar se algum código usa o dado do jeito errado.
- **Requisição HTTP:** um pedido do site ao servidor. Tem um **método**, que diz a intenção (GET = buscar, POST = criar, PATCH = alterar, PUT = colocar, DELETE = remover), e um **endereço** (como `/api/cart`). A resposta traz um **código de status**: 200/201 = deu certo, 204 = deu certo e não há conteúdo, 401 = não está logado, 403 = proibido, 404 = não existe, 409 = conflito, 422 = dados inválidos, 500/503 = erro do servidor.

## 3.2 Ponto de partida — `src/main.tsx`

**Em palavras simples:** é o "botão de ligar" do site. Prepara tudo na ordem certa e só depois mostra a tela.

**Como funciona (ordem de inicialização):**

1. **Liga o servidor simulado** (`startMocks`). O MSW só é carregado se `VITE_ENABLE_MOCKS=true`. Ele vem por **import dinâmico**: o código é baixado só quando necessário, o que deixa o carregamento inicial mais leve.
2. **Recupera a sessão** (`restoreSession`). Se havia um login salvo, pergunta ao servidor se ele ainda vale (`GET /session`). Se expirou, o servidor responde 401 e o login é apagado.
3. **Liga a limpeza de dados privados** (`wireSessionCache`). A partir daqui, sempre que o usuário mudar, a memória do site é limpa (detalhes em 3.8).
4. **Abre o canal de tempo real** (`startRealtime`). Isso precisa acontecer depois do passo 1 (motivo em 3.5).
5. **Cria o roteador** (`buildRouter`) e registra duas reações:
   - Se a sessão **expirar** numa página que exige login, leva para `/login`, guardando de onde a pessoa veio (`redirect`) e o motivo (`reason=expired`).
   - Se a pessoa **sair**, volta para o início.
6. **Marca o site como pronto** (`<html data-ready="true">`). Esse sinal é usado pelos testes para saber quando podem começar.
7. **Desenha a tela.**

**O QueryClient (a memória de dados do site), configurado aqui:**

- `staleTime: 15 s`: um dado buscado há menos de 15 segundos é considerado novo e não é pedido de novo.
- `gcTime: 5 min`: um dado que nenhuma tela usa é apagado da memória depois de 5 minutos.
- `refetchOnWindowFocus`: ao voltar para a aba do navegador, os dados na tela são atualizados.
- **Novas tentativas (retry):** só para falhas passageiras (servidor instável, sem internet, demora). São no máximo 2, com espera crescente (0,5 s, 1 s, até 3 s). Erros "definitivos", como senha errada, não são repetidos.
- **Mutations** (operações que alteram dados) nunca são repetidas automaticamente, para não fazer a mesma alteração duas vezes.

**Por que assim:** garantir a ordem evita que o site faça pedidos antes do servidor simulado existir, ou mostre dados de um login já vencido.

## 3.3 Contratos (formatos dos dados) — `src/api/types.ts`

**Em palavras simples:** é o "dicionário" do projeto. Define exatamente como é um NFT, um carrinho, um pedido, um erro etc. Servidor simulado, cliente HTTP, memória e telas usam o mesmo dicionário. Se alguém muda um campo, o TypeScript aponta todos os lugares afetados.

**Os principais formatos:**

| Formato | O que representa | Detalhe importante |
|---|---|---|
| `Eth` | Um valor em ETH | É **texto** (`"1.2345"`), nunca número, para não perder precisão |
| `Nft` | Uma obra | Tem `version`, um número que sobe a cada mudança |
| `Edition` | Uma versão da obra | `priceEth`, `available` (estoque) e `maxPerOrder` (limite por compra) |
| `NftListParams` | Os filtros da busca | `q`, `category`, `minPrice`, `maxPrice`, `availability`, `sort`, `page` |
| `Paginated<T>` | Uma página de resultados | `items`, `page`, `total`, `totalPages` |
| `User` / `Session` | Usuário e login | A sessão tem `token` (a "chave" do login) e `expiresAt` |
| `CartItem` / `Cart` | Carrinho | `previousPriceEth` aparece quando o preço mudou desde que o item foi adicionado |
| `Quote` / `QuoteLine` | Cotação (cálculo oficial) | `issues` lista os problemas que impedem a compra |
| `Order` | Pedido | `status`: `pending` (aguardando), `confirmed` ou `declined`; `quote` é a "foto" dos valores |
| `Wallet` | Carteira | `kind`: `primary` ou `secondary` |
| `ApiErrorBody` / `ErrorCode` | Erro padronizado | 14 códigos, como `VALIDATION` e `QUOTE_STALE` |
| `RealtimeEvent` | Aviso em tempo real | `eventId` (identidade), `resource` (o que mudou), `version`, `userId` (dono) e `data` |

**Por que o preço é texto:** em computadores, `0.1 + 0.2` dá `0.30000000000000004`. Para dinheiro, isso é inaceitável. Então o preço viaja como texto e só é calculado com a biblioteca **decimal.js**, que faz contas exatas.

**Todos os códigos de erro:**

| Código | Quando acontece |
|---|---|
| `VALIDATION` | Campo inválido (ex.: e-mail mal escrito) |
| `UNAUTHENTICATED` | Não logado ou sessão expirada |
| `FORBIDDEN` | Sem permissão |
| `NOT_FOUND` | O item não existe |
| `CONFLICT` | Dado repetido (ex.: e-mail já cadastrado) |
| `OUT_OF_STOCK` | Sem estoque suficiente |
| `QUOTE_STALE` | A cotação ficou desatualizada |
| `IDEMPOTENCY_CONFLICT` | A mesma "senha de tentativa" foi usada com dados diferentes |
| `COUPON_INVALID` / `COUPON_EXPIRED` | Cupom inexistente ou vencido |
| `WALLET_REJECTED` | A carteira recusou a conexão |
| `TRANSIENT` | Falha passageira do servidor |
| `NETWORK` / `TIMEOUT` | Sem conexão / demorou demais (gerados no próprio navegador) |

## 3.4 O servidor simulado — `src/mocks/`

Esta pasta é o "backend de mentira". Tem seis arquivos.

### 3.4.1 `fixtures.ts` — os dados iniciais

**Em palavras simples:** é o "estoque inicial" da loja.

**Como funciona:**

- **`buildNfts()`** cria 36 NFTs sempre iguais. Os 9 primeiros têm exatamente os nomes, preços e ilustrações do frame "Início" do Figma (Emerald Ape #042 a 1,19 ETH, Neon Vessel #552 com preço riscado de 2,29 etc.); os demais seguem o mesmo padrão por fórmula:
  - O preço base fica entre 0,05 e 2,54 ETH.
  - Cada NFT tem de 1 a 3 edições (Standard, Gold, Genesis). As edições seguintes custam mais.
  - Os NFTs de número múltiplo de 11 (11, 22, 33, 44) ficam totalmente esgotados, para testar "indisponível".
  - A edição Genesis está sempre esgotada.
  - Os NFTs 1 a 3 são os destaques.
- **`seedUsers`**: Ana e Bruno. A senha `Senha@123` **nunca é salva**. Guarda-se só o **hash** dela: uma "impressão digital" calculada por fórmula, da qual não dá para voltar à senha. O hash é misturado com um **sal** (texto aleatório por usuário), para que senhas iguais tenham hashes diferentes.
- **`seedWallets`**: as duas carteiras da Ana.
- **`coupons`**: WELCOME10 (10%), FLAT005 (0,05 ETH) e EXPIRED20 (vencido em 2025).
- **`networkFees`**: a taxa de cada rede (Ethereum 0,016 — a "taxa estimada" do Figma —, Polygon 0,002, Solana 0,001).

**Por que assim:** dados sempre iguais fazem os testes darem sempre o mesmo resultado (**determinismo**).

### 3.4.2 `scenarios.ts` — os interruptores de falha

**Em palavras simples:** um painel de interruptores ("deixe lento", "derrube a internet" etc.).

**Como funciona:**

- **`SCENARIOS`**: a lista dos 15 cenários com a descrição de cada um.
- **`readScenarios()`**: ao abrir o site, lê `?scenario=` do endereço, salva no navegador e devolve o conjunto ativo.
- **`setScenarios(nomes)`**: troca os cenários ativos (usado pelo painel e pelos testes).
- **`has(nome)`**: responde "este cenário está ligado?". Cada rota do servidor consulta essa função.
- **`seededRandom()`**: gera números "aleatórios", mas sempre na mesma sequência, porque começa da mesma semente (1234). Assim, até a "latência variável" é reproduzível.

### 3.4.3 `db.ts` — o banco de dados

**Em palavras simples:** a "memória" do servidor: tudo o que existe (NFTs, usuários, carrinhos, pedidos) fica aqui e é salvo no navegador (localStorage).

**Como funciona, função por função:**

- **`loadDb()`**: ao abrir, recupera o banco salvo. Se não houver, cria um novo a partir das fixtures.
- **`resetDb()`**: apaga tudo e volta ao estado inicial (usado por `?reset=1`).
- **`persist()`**: salva o banco após cada alteração, por isso nada se perde ao recarregar.
- **`sha256(texto)`**: calcula o hash de senhas usando a criptografia nativa do navegador.
- **`recalc(nft)`**: recalcula o "a partir de" (menor preço entre as edições) e o estoque total.
- **`hydrateCart(chave, id)`**: monta o carrinho completo. O banco guarda só o essencial (NFT, edição, quantidade e o **preço aceito**, isto é, o preço visto ao adicionar). Esta função junta isso com os dados atuais (nome, imagem, preço atual, estoque). Se o preço aceito for diferente do atual, preenche `previousPriceEth`, o que faz a tela mostrar o aviso.
- **`computeQuote(chave, rede, cupom)`**: **o cálculo financeiro oficial.** Exemplo com 2 unidades de 1,2000 ETH, cupom WELCOME10 e rede Ethereum:
  1. **Linhas:** cada item com o preço atual. Se algo estiver errado, a linha recebe um aviso: `SOLD_OUT` (esgotou), `INSUFFICIENT` (estoque menor que a quantidade) ou `PRICE_CHANGED` (preço mudou).
  2. **Subtotal:** 2 × 1,2000 = **2,4 ETH**.
  3. **Cupom:** 10% de 2,4 = **0,24 ETH** de desconto. Um cupom inexistente gera `COUPON_INVALID`; um vencido, `COUPON_EXPIRED`. O desconto nunca passa do subtotal.
  4. **Taxa de rede:** **0,0042 ETH** (só cobrada se houver itens).
  5. **Total:** 2,4 − 0,24 + 0,0042 = **2,1642 ETH**.
- **`quoteSignature(cotação)`**: cria um "resumo" de tudo que importa para a compra (rede, total, cupom e, por item, edição, quantidade, preço e se há estoque). Se dois resumos forem iguais, as cotações são equivalentes. É assim que o servidor descobre se algo mudou antes de confirmar.

### 3.4.4 `handlers.ts` — as rotas do servidor

**Em palavras simples:** é o "atendente" do servidor. Para cada pedido (ex.: `POST /api/cart/items`), há uma função que decide a resposta.

**Funções auxiliares (usadas por todas as rotas):**

- **`fail(status, código, mensagem, campos?, detalhes?)`**: monta uma resposta de erro no formato padrão.
- **`network(rota, opções)`**: roda **antes** de toda rota e simula a internet:
  - `offline` → responde com falha de rede.
  - Demora: `instant` = 0; `slow` = 2,5 s; `variable` = de 0,1 a 2 s (sequência fixa); normal = de 0,12 a 0,3 s.
  - `out-of-order` → buscas com quantidade ímpar de letras demoram 1,8 s; com quantidade par, 0,15 s. Assim a resposta de uma busca antiga chega depois da nova, para provar que o site mostra a mais recente.
  - `flaky` → a primeira chamada de cada rota falha com 503; as seguintes funcionam.
  - `server-error` → o catálogo responde 500.
- **`auth(pedido)`**: lê o token do cabeçalho `Authorization: Bearer <token>`, procura a sessão e confere a validade. Devolve o usuário ou um erro 401.
- **`cartKey(pedido)`**: decide de quem é o carrinho: `user:<id>` se logado, ou `guest:<id-do-visitante>` (vindo do cabeçalho `X-Cart-Id`).
- **`createSession(usuário, carrinho-do-visitante)`**: cria um token válido por 8 horas e **junta o carrinho do visitante ao do usuário**. Se o mesmo item estiver nos dois, soma as quantidades, sem passar do estoque nem do limite por compra.
- **`filterNfts(endereço)`**: filtra e ordena o catálogo.
  - Busca por texto no nome, no artista e nas tags.
  - Categorias se combinam (arte **ou** música).
  - Faixa de preço comparada com decimal.js.
  - Rede: Ethereum, Polygon, Solana (combináveis). As contagens ao lado de cada coleção e rede vêm da API (`facets`).
  - Abas: Todos os NFTs, Novos lançamentos (12 mais recentes) e Em alta (mais vendidos).
  - Disponibilidade: disponíveis ou esgotados (só pela URL; o painel do Figma não tem esse filtro).
  - Ordenação por mais recente, menor preço, maior preço ou mais popular. Em empate, desempata pelo id, para a ordem ser sempre a mesma.
- **`mutateNft(id, mudança)`**: **a única forma de alterar um NFT.** Altera o preço ou o estoque, aumenta a `version`, recalcula, salva e **avisa todos pelo tempo real** (`nft.updated`). Por haver uma porta única, o que a API responde e o que o aviso diz nunca divergem.
- **`settle(pedido)`**: decide o destino de um pedido pendente.
  - Recusa se o cenário `payment-declined` estiver ligado ou se faltar estoque.
  - Se confirmar: gera um código de transação simulado, baixa o estoque (avisando cada mudança) e tira do carrinho **somente a quantidade comprada**. Se havia 3 unidades no carrinho e o pedido era de 2, sobra 1.
  - Em ambos os casos, avisa o dono com `order.updated`.
- **`settleDueOrders()`**: liquida os pedidos cujo horário de liquidação (`settleAt`) já passou.
- **`publicOrder(pedido)`**: tira os campos internos (dono, chave de idempotência) antes de responder.

**As rotas, agrupadas:**

| Grupo | Rotas | O que fazem |
|---|---|---|
| Controle | `/api/__mock/*` | Reset, cenários, expirar sessões, alterar NFT, reenviar evento, derrubar socket, liquidar pedidos |
| Conta | `POST /auth/signup`, `POST /auth/login`, `GET /session`, `POST /auth/logout` | Cadastro (422 se inválido, 409 se repetido), login (401 genérico, para não revelar se o e-mail existe), sessão e saída |
| Catálogo | `GET /nfts`, `GET /nfts/featured`, `GET /nfts/:id` | Lista paginada, destaques e detalhe (404 se não existir) |
| Favoritos | `GET`, `PUT`, `DELETE /favorites/:id` | Listar, favoritar e desfavoritar. Repetir a operação não muda nada (idempotente) |
| Carrinho | `GET /cart`, `POST /cart/items`, `PATCH` e `DELETE /cart/items/:edição`, `POST /cart/acknowledge` | Ver, adicionar (409 se passar do limite), alterar, remover e "aceitar valores atuais" |
| Cotação | `POST /quote` | Calcula e guarda a cotação; 422 para cupom ruim |
| Pedidos | `POST /orders`, `GET /orders`, `GET /orders/:id` | Criar (detalhado abaixo), listar e consultar. O pedido de outro usuário responde 404 |
| Perfil | `GET` e `PATCH /profile`, `POST /profile/avatar`, `POST /profile/password` | Dados, foto (só imagem, até cerca de 300 KB) e senha |
| Carteiras | `GET /wallets`, `POST /wallets`, `PATCH /wallets/:id`, `POST /wallets/:id/connect` | Listar, criar, editar e conectar (simulado) |

**A criação de pedido em detalhe (`POST /orders`):**

1. Exige o cabeçalho **`Idempotency-Key`**, uma "senha de tentativa" que o site gera.
2. **Mesma chave e mesmos dados** → devolve o **mesmo pedido** (200), sem criar outro. **Mesma chave e dados diferentes** → erro 409 `IDEMPOTENCY_CONFLICT`.
3. Confere nome, e-mail, carteira e se a cotação pertence ao usuário.
4. Se os cenários `price-change-checkout` ou `sold-out-checkout` estiverem ligados, muda o preço ou esgota o item agora, uma única vez.
5. **Recalcula a cotação** e compara o resumo (`quoteSignature`) com o da cotação que o usuário viu. Se algo mudou ou expirou, responde 409 com a cotação nova, e o usuário precisa confirmar de novo.
6. Cria o pedido como `pending`, com liquidação marcada para dali a 3 segundos.
7. No cenário `order-timeout`, espera 15 s **depois de já ter criado** o pedido. Assim o site desiste antes da resposta, reenvia e recebe o mesmo pedido.

### 3.4.5 `socket.ts` — o servidor de tempo real

**Em palavras simples:** um "alto-falante" do servidor, que avisa o site na hora quando algo muda.

**Como funciona:**

- **`socketHandler`**: quando o site se conecta, lê o token que veio no endereço da conexão para saber **quem é o usuário**. Também envia um "sinal de vida" (ping) a cada 20 s, para a conexão não ser encerrada por inatividade.
- **`emitNftUpdated(nft)`**: avisa **todos** os conectados que um NFT mudou.
- **`emitOrderUpdated(pedido)`**: avisa **somente o dono** do pedido. É assim que se garante que um usuário nunca vê pedidos de outro.
- **`replay('duplicate' | 'stale')`**: para testes. Reenvia o último aviso (duplicado) ou um aviso "do passado", com versão menor e preço absurdo de 999 ETH, para provar que o site ignora esse tipo de aviso.
- **`disconnectAll()`**: derruba as conexões, para testar a reconexão.

**Tecnologia:** o MSW intercepta o WebSocket (o canal de tempo real do navegador). O pacote `@mswjs/socket.io-binding` "traduz" o protocolo Socket.IO. **Limitações:** só o transporte WebSocket funciona (o modo alternativo "long-polling" não); não há "salas" nem "namespaces", por isso a separação por usuário é feita à mão.

### 3.4.6 `browser.ts` — liga tudo

- **`startMocks()`**:
  - Se o endereço tiver `?reset=1`, recria o banco, apaga o login e o carrinho do navegador, aplica os cenários pedidos e limpa o endereço.
  - Liga o MSW com as rotas REST e de tempo real.
  - A cada meio segundo, liquida os pedidos vencidos. Como o horário de liquidação fica salvo, isso funciona mesmo depois de recarregar a página.

## 3.5 Tempo real no site — `src/realtime/socket.ts`

**Em palavras simples:** é o "ouvido" do site. Escuta o alto-falante do servidor e atualiza as telas, com cuidado para não aceitar avisos repetidos ou atrasados.

**Como funciona:**

- **`connection`**: guarda o estado da conexão (conectando, conectado, desconectado). Um selo no canto da tela mostra quando está desconectado.
- **`accept(aviso, versão-em-cache)`**: o "porteiro" dos avisos. Recusa o aviso se:
  - o `eventId` dele já foi visto (é duplicado). O site lembra dos últimos 500; ou
  - a versão dele é menor ou igual à mais recente conhecida (está atrasado). A comparação inclui a versão que já está na memória do site.

  **Exemplo:** o NFT está na versão 5. Chega um aviso da versão 4: é ignorado. Chega a versão 6: é aceito. Chega a versão 6 de novo: é ignorado.
- **`applyNft(memória, nft)`**: atualiza o NFT no detalhe, em todas as listas e nos destaques. Se o NFT estiver no carrinho, manda recalcular carrinho e cotação e anuncia: "Atualização em tempo real: … teve preço ou disponibilidade alterados".
- **`startRealtime(memória)`**:
  - Carrega a biblioteca `socket.io-client` **só depois** que o MSW ligou. Motivo: a biblioteca guarda uma referência ao WebSocket do navegador no momento em que é carregada. Se fosse carregada antes, usaria o WebSocket "de verdade" e tentaria acessar um endereço que não existe.
  - Conecta enviando o token. A cada conexão (inclusive a primeira), pede de novo à API todos os dados visíveis na tela. Isso recupera qualquer aviso perdido enquanto a conexão estava fora. Na reconexão, também anuncia "Conexão em tempo real restabelecida".
  - Ao receber `order.updated`, confere se o pedido é do usuário logado agora (segunda camada de proteção), atualiza o pedido e, se foi confirmado, atualiza o carrinho.
  - Ao trocar de usuário, fecha a conexão antiga e abre uma nova com o token novo.

## 3.6 Cliente HTTP (Axios) — `src/api/client.ts` e `src/api/endpoints.ts`

**Em palavras simples:** o "carteiro" do site. Leva todos os pedidos ao servidor, coloca o crachá (token) e traduz qualquer erro para um formato único.

**Como funciona:**

- **`ApiError`**: o formato único de erro. Tem `code` (ex.: `CONFLICT`), mensagem, `status`, `fields` (erros por campo, ex.: `{ email: "Já cadastrado" }`) e `details`. A propriedade `retryable` diz se vale tentar de novo (só para falhas passageiras).
- **`http`**: a instância do Axios, com endereço base e tempo máximo de 8 s.
- **Antes de cada pedido (interceptor de requisição):** coloca o crachá (`Authorization: Bearer <token>`) e a identificação do carrinho do visitante (`X-Cart-Id`).
- **Depois de cada resposta com erro (interceptor de resposta):**
  - Demorou demais → `TIMEOUT`.
  - Não houve resposta → `NETWORK`.
  - O servidor respondeu com erro → `ApiError` com o código dele.
  - Resposta 401 **num pedido que tinha crachá** → a sessão expirou, então avisa o resto do site. Um 401 de "senha errada" no login **não** desloga ninguém, porque esse pedido não tinha crachá.
- **`endpoints.ts`** (o objeto `api`) é o **único lugar com endereços**. Cada operação é uma função: `api.nfts(filtros)`, `api.addToCart(item)`, `api.createOrder(dados, chave)` etc. Todas aceitam um "sinal de cancelamento" (`AbortSignal`), para que um pedido que deixou de ser necessário seja cancelado.

## 3.7 Memória de dados (TanStack Query) — `src/api/queries.ts`

**Em palavras simples:** o "caderno de anotações" do site. Guarda as respostas para não perguntar de novo e sabe quando cada anotação está velha.

**Como funciona:**

- **`keys`**: o nome de cada anotação (chamado de **chave**). Alguns exemplos:
  - `['nfts', filtros]`: cada combinação de filtros tem a própria anotação. Por isso, ao voltar a uma busca anterior, o resultado aparece na hora.
  - `['nft', 'nft-1']`: o detalhe de um NFT.
  - `['cart', 'user:user-ana']` ou `['cart', 'guest:…']`: o carrinho de cada pessoa.
  - `['user', 'user-ana', …]`: **tudo o que é privado** fica sob o prefixo `user`, então apagar esse prefixo apaga tudo do usuário de uma vez.
- **`cartOwner()`**: diz de quem é o carrinho agora (usuário ou visitante).
- **Consultas prontas:**
  - `nftListQuery` guarda as anotações por 30 s e mostra o resultado anterior enquanto o novo carrega, para a tela não "piscar".
  - `nftQuery` não tenta de novo quando o NFT não existe (404).
  - `featuredQuery` busca os destaques; `cartQuery`, o carrinho.
- **`useToggleFavorite`** — a **atualização otimista**:
  1. Ao clicar, o coração fica preenchido **na hora**, antes da resposta do servidor.
  2. O valor anterior é guardado.
  3. Se o servidor responder erro, o coração **volta** ao que era (rollback) e aparece um aviso.
  4. Se der certo, a lista oficial do servidor é gravada.
- **`useQuote(rede, cupom)`**: a cotação nunca é considerada nova (`staleTime: 0`), porque o total precisa sempre vir do servidor.
- **`useCartMutation`**: uma "fábrica" de ações do carrinho (adicionar, alterar, remover, aceitar valores). Toda ação grava o carrinho novo, manda recalcular a cotação e anuncia o resultado.

## 3.8 Sessão e utilitários — `src/lib/`

### `session-store.ts` — o crachá

**Em palavras simples:** guarda "quem está logado" num lugar que qualquer parte do site pode consultar, e avisa quando isso muda.

- `get()` lê a sessão; `set(sessão)` grava e avisa "login"; `clear('logout')` e `expire()` apagam e avisam o motivo; `subscribe(função)` pede para ser avisado de mudanças.
- `guestCartId()` gera e guarda um identificador aleatório para o carrinho do visitante. `rotateGuestCart()` gera um novo depois do login, já que os itens foram transferidos para a conta.
- **Por que fora do React:** o carteiro (Axios), o roteador e o tempo real precisam saber quem está logado, e eles não são componentes de tela.

### `auth.ts` — login, cadastro e saída

- `useSession()` permite que um componente "assista" ao crachá e se redesenhe quando ele muda.
- `restoreSession()` confere o login salvo ao abrir o site.
- `wireSessionCache()`: quando o usuário muda, cancela os pedidos em andamento e apaga do caderno tudo sob `user`, `cart` e `session`. **É isso que impede um usuário de ver dados de outro.**
- `useLogin()` e `useSignup()` chamam a API, gravam o crachá e trocam o id do carrinho de visitante.
- `useLogout()` avisa o servidor e apaga o crachá **mesmo se o servidor falhar**, para o usuário nunca ficar "preso" logado.

### Outros utilitários

- **`announcer.ts`** (o "locutor"): `announce(mensagem, tom)` dispara uma mensagem que aparece como aviso visual (toast) e é lida por leitores de tela. O tom `polite` espera o leitor terminar a frase atual; `assertive` interrompe, para coisas urgentes.
- **`draft.ts`** (o "rascunho"): `useDraft(chave, inicial)` funciona como um estado normal, mas salvo no navegador durante a sessão da aba. Guarda o cupom e os dados do pagamento, para nada se perder se a sessão expirar.
- **`eth.ts`**: `formatEth("1.23456789")` devolve `"1.2346 ETH"` (só arredonda para mostrar). `mulEth("1.2", 3)` devolve `"3.6"`, com conta exata.
- **`env.ts`** lê as configurações do `.env` com valores padrão; **`utils.ts`** traz `cn()`, que junta classes de estilo sem conflitos.

## 3.9 Roteador (os endereços) — `src/router.tsx`

**Em palavras simples:** o "mapa" do site. Diz qual tela abre em cada endereço e quem pode entrar.

- **`validateHomeSearch`**: limpa os filtros que vêm no endereço. Exemplo: `/?q=robot&category=["art","art"]&page=0&sort=xyz` vira `q=robot`, `category=["art"]`, e página e ordenação ficam no padrão. Também:
  - limita a busca a 80 caracteres;
  - aceita só categorias conhecidas, sem repetição e em ordem alfabética, para a mesma busca sempre gerar a mesma anotação no caderno;
  - aceita preços só em formato numérico;
  - omite os valores padrão, para o endereço ficar limpo.
- **Por que os filtros ficam no endereço:** dá para recarregar, compartilhar o link e usar "voltar/avançar" sem perder a busca.
- **`authSearch`**: na página de login, só aceita `redirect` para endereços **internos** (começando com `/` e não com `//`). Isso impede que alguém use o link de login para mandar a pessoa a um site malicioso (o ataque chamado "open redirect").
- **Rota `authed`** (o "segurança"): agrupa checkout, pedido, perfil e carteiras. Antes de abrir qualquer uma delas, verifica se há sessão. Se não houver, manda para `/login?redirect=<onde-queria-ir>`.
- **Carregamento sob demanda (`lazyRouteComponent`)**: cada tela é um arquivo separado, baixado só quando visitada. O início é a exceção, porque é a primeira tela.

## 3.10 As telas — `src/pages/`

### `Home.tsx` — início

- **`Hero`**: o destaque do topo. Mostra "esqueleto" enquanto carrega, erro com botão "Tentar novamente" ou "Nenhum destaque".
- **`Filters`**: categorias (marque várias), faixa de preço (com aviso se o mínimo for maior que o máximo) e disponibilidade. No celular, abre numa gaveta lateral.
- **`Catalog`**:
  - A busca espera 350 ms depois da última tecla (**debounce**) para não pedir a cada letra, e **substitui** o histórico em vez de empilhar, para o "voltar" não passar letra por letra.
  - Qualquer filtro volta para a página 1.
  - Estados: carregando (6 esqueletos), erro, vazio, "atualizando…" e paginação com a página atual marcada para leitores de tela.

### `NftDetail.tsx` — detalhe

- Estados de NFT inexistente (página 404 própria), erro e carregando.
- Galeria com miniaturas clicáveis; a selecionada é anunciada como "pressionada".
- Escolha de edição por botões de opção; edições esgotadas ficam desabilitadas.
- Quantidade de 1 até o máximo permitido, que é o menor entre estoque e limite por compra, **menos o que já está no carrinho**.
- O total da linha é calculado com conta exata.
- O botão "Favoritar" leva ao login quando a pessoa é visitante.

### `Cart.tsx` — carrinho

- Se algum preço mudou ou o estoque ficou menor que a quantidade, aparece um aviso com a lista e o botão "Aceitar valores atuais". O pagamento fica bloqueado até aceitar.
- **`CartLine`**: cada item, com mais, menos e remover, respeitando o limite.
- **`CouponForm`**: antes de aplicar, testa o cupom no servidor. Se ele for inválido ou vencido, mostra o erro no próprio campo.
- **`Summary`**: subtotal, desconto, taxa e total, **exatamente** como o servidor calculou.

### `Checkout.tsx` — pagamento

1. **Dados**: nome e e-mail, validados; o foco vai para o primeiro campo com erro.
2. **Carteira e rede**: escolha e clique em "Conectar" (pode ser recusado ou desconectado).
3. **Revisão**: mostra itens, dados e a cotação recalculada.
4. **Confirmar**:
   - `idemKey(cotação)` cria a "senha de tentativa" daquela cotação e a guarda.
   - **Duas travas contra clique duplo**: o botão fica desabilitado enquanto envia, e uma variável interna barra um segundo clique antes mesmo de a tela atualizar.
   - **Timeout ou queda de rede**: reenvia sozinho, até 2 vezes, com a **mesma** chave. O servidor devolve o pedido que já existia.
   - **Cotação desatualizada (409)**: mostra o que mudou e pede "Aceitar novos valores" antes de confirmar de novo.
   - Se chegar um aviso de mudança de preço durante a revisão, a cotação é recalculada e o botão Confirmar fica desabilitado.
- Se houver pedido pendente, aparece um aviso com link para acompanhá-lo.

### `Order.tsx` — pedido e recibo

- **Pendente**: animação de espera. O aviso em tempo real é o caminho principal; como reserva, pergunta à API a cada 5 s.
- **Recusado**: motivo, aviso de que os itens continuam no carrinho e link de volta.
- **Confirmado**: recibo com número do pedido, data, código de transação, rede, carteira e itens. Os valores vêm da "foto" tirada na criação (`order.quote`), não do catálogo atual.
- O pedido de outro usuário mostra 404.

### `Auth.tsx` — entrar e criar conta

- Validação antes de enviar. Os erros do servidor (ex.: e-mail repetido) aparecem no campo certo.
- Se veio de uma sessão expirada, mostra "Sua sessão expirou".
- Depois de entrar, volta ao endereço guardado em `redirect`.

### `Profile.tsx` — perfil

- **`AvatarForm`**: aceita PNG, JPG ou WebP de até 5 MB. **Antes de enviar, recorta a imagem num quadrado de 256 × 256 e converte para WebP** dentro do navegador, para o envio ser pequeno.
- **`ProfileForm`**: nome de exibição, usuário, e-mail, nome ENS e apelido da carteira, mais a seção "Alterar senha". Um único botão "Salvar" (como no Figma) salva o perfil e, se os campos de senha foram preenchidos, troca a senha. Mostra os conflitos que o servidor apontar.
- **`PasswordForm`**: senha atual, nova e confirmação. A nova precisa ser forte e diferente da atual.
- Depois de salvar, o nome atualizado também é gravado no crachá.

### `Wallets.tsx` — carteiras

- Um formulário para a carteira principal e outro para a secundária. Cada um cria ou edita.
- O endereço precisa ter o formato `0x` seguido de 40 caracteres hexadecimais (0–9, a–f).
- O servidor recusa um segundo cadastro do mesmo tipo ou um endereço repetido.

### `NotFound.tsx`

Página "não encontrado", reutilizada para endereço inválido, NFT inexistente e pedido inexistente.

## 3.11 Componentes reutilizáveis — `src/components/`

### `ui/index.tsx` — as peças básicas (padrão shadcn/ui)

O **shadcn/ui** não é uma biblioteca instalada: é um conjunto de componentes cujo código é **copiado para o projeto** e adaptado. Por baixo, usa o **Radix**, que já resolve acessibilidade (teclado, foco, leitores de tela).

| Peça | Para que serve |
|---|---|
| `Button` | Botão com variantes (primário, contorno, fantasma, perigo, secundário) e tamanhos |
| `Input`, `Textarea`, `NativeSelect` | Campos de texto e seleção, que ficam vermelhos quando inválidos |
| `Label` | Rótulo ligado ao campo |
| `Field` | Junta rótulo, dica e erro e **liga tudo ao campo** para o leitor de tela ler junto |
| `Skeleton` | Bloco cinza com brilho animado no lugar do conteúdo que está carregando; o brilho some se o sistema pedir "menos movimento" |
| `Badge` | Etiqueta pequena (tags) |
| `Alert` | Caixa de aviso com **ícone e texto**, nunca só cor |
| `Dialog` | Janela sobreposta ou gaveta lateral; prende o foco dentro dela e o devolve ao fechar |

### `layout/RootLayout.tsx` — a moldura do site

- **Cabeçalho**: logo e menu. No celular, o menu vira uma gaveta. O link do carrinho mostra a quantidade de itens.
- **`ConnectionBadge`**: selo que aparece quando o tempo real está desconectado.
- **`Toaster`**: mostra os avisos e os entrega aos leitores de tela.
- **Link "Pular para o conteúdo"**: o primeiro item ao apertar Tab.
- A cada troca de página, o foco vai para o conteúdo principal, para quem usa teclado ou leitor de tela.
- **Rodapé**: links externos abrem em nova aba com proteção (`noopener`). A newsletter avisa que **não está disponível** na demonstração, em vez de fingir que cadastrou.

### Outros

- **`NftCard.tsx`**: o card do catálogo. A imagem tem tamanho fixo, para a página não "pular" quando carrega. As 3 primeiras carregam imediatamente; as outras só ao rolar. `NftCardSkeleton` é a versão "carregando", com as mesmas medidas.
- **`Summary.tsx`**: o quadro de valores (subtotal, desconto, taxa, total).
- **`MockPanel.tsx`**: o painel "Cenários". Todas as ações dele passam pela API do servidor simulado. Os avisos resultantes chegam pelo tempo real, como chegariam de um servidor de verdade.

## 3.12 Os testes — `tests/e2e/`

**`helpers.ts` (atalhos usados por todos os testes):**

- `fresh(página, endereço, cenários)`: abre o site com `?reset=1` e espera o sinal "pronto". Todo teste começa do zero.
- `ready(página)`: espera o sinal `data-ready`. Sem isso, um teste rápido demais podia pedir dados antes do MSW ligar.
- `mock(página, rota, dados)`: aciona o painel de controle do servidor simulado de dentro do site.
- `setScenarios`: liga e desliga cenários.
- `realtimeReady`: espera o tempo real conectar antes de disparar avisos.
- `login`, `addToCart`, `openMenuIfMobile`: atalhos para ações repetidas.

**O que cada arquivo testa:**

| Arquivo | Testes |
|---|---|
| `catalog.spec.ts` | Busca, filtros combinados, ordenação conferindo a ordem dos preços, paginação, recarregar, voltar e avançar, resultado vazio, preço inválido, lentidão com esqueletos, erro e nova tentativa, respostas fora de ordem, detalhe direto, NFT inexistente e rota inexistente |
| `account.spec.ts` | Cadastro com e-mail repetido, login com senha errada e retorno, sessão expirada com retomada, logout e troca de usuário sem vazamento, favoritos com falha e recuperação, perfil, foto, senha e carteiras com erros |
| `purchase.spec.ts` | Carrinho completo com cupom e persistência, valores iguais aos da API, compra até o recibo (e recibo inalterado depois de mudar o catálogo), recusa, clique triplo com timeout (uma única compra), conflito de idempotência, preço que muda e carteira recusada |
| `realtime.spec.ts` | Preço mudando durante o pagamento, esgotamento no carrinho e no detalhe, avisos duplicados e antigos ignorados, queda com pedido pendente e reconexão |
| `a11y-visual.spec.ts` | Teclado e link de pular, foco preso na janela, erros ligados aos campos, sem rolagem lateral e comparação visual de 4 telas |
| `smoke.spec.ts` | Verificação rápida: o início carrega sem erros no console e o tempo real conecta |

**Regra importante:** nos testes de tempo real, as mudanças são feitas **no servidor simulado** e chegam ao site **pelo canal de tempo real**, exatamente como em produção. Nenhum teste "trapaceia" mexendo direto na tela.

## 3.13 Ferramentas — `scripts/` e `lighthouse/`

- **`generate-art.mjs`**: gera os avatares SVG de artistas. As artes dos NFTs agora são as ilustrações do Figma em `public/nfts/kurio/`.
- **`figma-probe.cjs`**: lê a cor exata de pontos dos frames do Figma (usado para extrair a paleta).
- **`figma-compare.mjs`**: abre cada tela do app em 1440 e 414 px e salva a captura ao lado do frame correspondente em `design/compare/`.
- **`lighthouse.mjs`**: sobe o site otimizado, mede início e detalhe 3 vezes no modo celular e 3 no modo computador, salva os relatórios e calcula a mediana de cada nota e das métricas LCP (tempo até o maior elemento aparecer), CLS (o quanto a página "pula") e TBT (tempo em que a página fica travada).
- **`lighthouse/config.mjs`**: quais páginas medir, quantas vezes e quais metas.
- **`md2docx.cjs`**: transforma este documento (`DOCUMENTACAO.md`) na versão Word. Rode `npm run docs:word` sempre que editar o texto.

## 3.14 Tecnologias e ferramentas: o que são, onde estão e por que foram escolhidas

| Tecnologia | O que é (em palavras simples) | Onde é usada | Por que foi escolhida |
|---|---|---|---|
| **React 18** | Biblioteca para montar telas a partir de "peças" (componentes) que se redesenham quando os dados mudam | Todas as telas e componentes | Exigência do desafio; padrão de mercado |
| **TypeScript** | JavaScript com "tipos": descreve o formato dos dados e aponta erros antes de rodar | Todo o código | Exigência; garante que mock, cliente e telas falem a mesma "língua" |
| **Vite** | Ferramenta que roda o site em desenvolvimento e gera a versão otimizada | `vite.config.ts`, comandos `dev`, `build` e `preview` | Muito rápida, divide o código em pedaços (code splitting) automaticamente |
| **TanStack Router** | O "mapa" de endereços do site, com tipos | `src/router.tsx` | Exigência; valida os filtros na URL e protege rotas privadas |
| **TanStack Query** | O "caderno" de dados vindos da API: guarda, atualiza, tenta de novo e cancela | `src/api/queries.ts` e telas | Exigência; resolve cache, carregamento, erro e atualização otimista |
| **Axios** | O "carteiro" que envia os pedidos HTTP | `src/api/client.ts` | Exigência; interceptores permitem pôr o crachá e padronizar erros num só lugar |
| **Socket.IO (cliente)** | Canal de mão dupla para o servidor avisar o site em tempo real | `src/realtime/socket.ts` | Exigência; reconecta sozinho |
| **MSW** | "Servidor de mentira" que intercepta os pedidos dentro do navegador | `src/mocks/` | Exigência; simula a rede de verdade, sem alterar o código das telas |
| **@mswjs/socket.io-binding** | "Tradutor" que faz o MSW falar o protocolo do Socket.IO | `src/mocks/socket.ts` | Exigência (ou equivalente); permite testar o tempo real sem servidor |
| **Tailwind CSS** | Estilos escritos como classes curtas direto no HTML (`bg-accent`, `rounded-[20px]`) | Todos os componentes, `tailwind.config.js` | Exigência; estilização rápida e consistente com as cores do layout |
| **shadcn/ui + Radix** | Componentes acessíveis copiados para o projeto e adaptados | `src/components/ui/` | Exigência; Radix já cuida de foco, teclado e leitores de tela |
| **class-variance-authority / tailwind-merge / clsx** | Ajudantes para variações de estilo (botão primário, contorno…) sem conflito de classes | `ui/index.tsx`, `lib/utils.ts` | Padrão do shadcn/ui |
| **lucide-react** | Biblioteca de ícones | Cabeçalho, botões, avisos | Leve; os ícones combinam com o shadcn |
| **decimal.js** | Matemática decimal exata | `mocks/db.ts`, `lib/eth.ts` | Dinheiro não pode ter erro de arredondamento |
| **Playwright** | Robô que controla o navegador para testar o site | `tests/e2e/`, `playwright.config.ts` | Exigência; testa desktop e celular, gera relatório, vídeo e trace |
| **Lighthouse** | Auditoria de desempenho, acessibilidade, boas práticas e SEO | `scripts/lighthouse.mjs`, `lighthouse/` | Exigência |
| **chrome-launcher** | Abre o Chrome para o Lighthouse | `scripts/lighthouse.mjs` | Forma oficial de rodar o Lighthouse por script |
| **ESLint + typescript-eslint + react-hooks** | "Corretor ortográfico" do código | `eslint.config.js`, `npm run lint` | Pega erros comuns e uso incorreto de hooks |
| **docx** | Gera arquivos Word | `scripts/md2docx.cjs` | Produz a versão Word desta documentação |
| **Google Fonts (Roboto Mono)** | A fonte monoespaçada do Figma | `index.html` | Identidade visual do layout; carregada sem bloquear a tela |
| **sharp** | Processamento de imagens | `scripts/figma-*.{cjs,mjs}` | Recortar as ilustrações dos frames do Figma e comparar telas lado a lado |

## 3.15 Arquivos de configuração

| Arquivo | Para que serve |
|---|---|
| `package.json` | Lista das bibliotecas e dos comandos (`dev`, `build`, `test:e2e`, `lighthouse`, `docs:word` etc.) |
| `package-lock.json` | Versões exatas de tudo, para que `npm ci` instale o mesmo em qualquer máquina |
| `.env.example` / `.env` | Configurações (mocks ligados, endereços, tempo máximo); ver 2.4 |
| `tsconfig.json` | Regras do TypeScript: modo estrito (mais verificações) e o atalho `@/` que aponta para `src/` |
| `vite.config.ts` | Plugin do React, atalho `@/` e separação do React e do TanStack em arquivos próprios (melhor cache no navegador) |
| `tailwind.config.js` | Tokens do Figma: `bg` #140D0A, `surface` #241612, `band` #38220F, `line` #432C1B, `field` #3F2319, `accent` #D28A4C, `price` #E89B55, `ink` #F5F1EB, `muted` #CFB28C, `hint` #B39463, `required` #F0805F; fonte Roboto Mono; brilho dos esqueletos |
| `postcss.config.js` | Liga o Tailwind e o Autoprefixer (adiciona prefixos de compatibilidade entre navegadores) |
| `index.html` | Página base: idioma `pt-BR`, descrição para buscadores (SEO), ícone e fontes |
| `src/index.css` | Estilos globais: foco visível, redução de movimento e o contêiner de largura das páginas |
| `public/mockServiceWorker.js` | O "motor" do MSW, gerado pela própria ferramenta. Não editar |
| `vercel.json` / `public/_redirects` | Fazem qualquer endereço abrir o site quando publicado (Vercel / Netlify e Cloudflare) |
| `playwright.config.ts` | Testes em desktop 1440 px e celular 390 px, relatório HTML, traces e vídeos de falhas e servidor iniciado automaticamente |
| `eslint.config.js` | Regras do corretor de código |
| `lighthouse/config.mjs` | Páginas, número de medições e metas do Lighthouse |

## 3.16 Resumo dos números do projeto

| Item | Quantidade |
|---|---|
| Telas | 10 (incluindo a página 404) |
| Rotas da API simulada | cerca de 35 |
| NFTs nos dados de exemplo | 36, em 9 coleções e 3 redes (9 por página, como no Figma) |
| Usuários de teste | 2 |
| Cenários de falha | 15 |
| Testes automáticos | 37 testes × 2 telas = 74 execuções, todas passando |
| Telas com comparação visual | 4 (início, detalhe, carrinho e pagamento), em 2 tamanhos |
| Medições de desempenho | 12 (2 páginas × 2 perfis × 3 vezes) |

## 3.17 Fidelidade ao Figma (tela por tela)

**Em palavras simples:** o layout foi refeito para seguir os frames do arquivo Figma "Frontend Challenge" (marca **Kurio**), exportados em `design/figma/Desktop` e `design/figma/Mobile`. As cores foram medidas pixel a pixel nos próprios frames e as ilustrações dos macacos foram recortadas deles.

**Como conferir:** com o site rodando em `npm run build && npm run preview`, execute `node scripts/figma-compare.mjs`. Cada tela é capturada em 1440 px e 414 px e salva **ao lado do frame correspondente** em `design/compare/`.

| Frame do Figma | Onde está no código | O que foi reproduzido |
|---|---|---|
| Início (desktop) | `pages/Home.tsx` | Cabeçalho KURIO, hero "Seja dono do futuro da arte digital" com pontos do carrossel, painel Coleções/Faixa de preço (slider duplo)/Rede com contagens, "NFT em destaque — oferta limitada", abas Todos/Novos/Em alta, "Ordenar por", grade 3 × 3 com selo RARO e preço riscado, paginação quadrada, dois banners, "Diário da Cunhagem" e rodapé em blocos |
| Início (mobile) | `pages/Home.tsx`, `RootLayout.tsx` | Barra "Explorar coleções" + botão de filtros, hero compacto, abas, grade em duas colunas desalinhadas com coração no canto e barra inferior com botão central |
| Detalhes do NFT | `pages/NftDetail.tsx` | Trilha "Início / Mercado", 4 miniaturas, imagem com lupa (zoom), nome, preço, estrelas e avaliações, "Sobre este NFT", chips de edição, −/+, COMPRAR, Favoritar, ID/Coleção/Atributos, compartilhar, abas "Detalhes do NFT"/"Avaliações" e "Mais desta coleção" com pontos |
| Detalhes do NFT (mobile) | `pages/NftDetail.tsx` | Voltar + coração, imagem, painel com nota em pílula, edições, atributos e barra fixa "Qtd. / preço / Comprar NFT / carrinho" |
| Carrinho de NFTs | `pages/Cart.tsx` | Tabela NFTs/Preço/Edições/Total com lixeira, "Resumo da carteira", código promocional, subtotal, desconto do lançamento, taxa de rede (estimada), total, "Conectar e finalizar", "Continuar explorando" e "Colecionadores também viram" |
| Pagamento | `pages/Checkout.tsx` | "Perfil do colecionador" com todos os campos e asteriscos do Figma, "Usar outra carteira?", observação, "Seus NFTs", "Tem um código promocional? Aplique aqui", totais, "Carteira e rede" em rádio e "Confirmar compra" |
| Pagamento (mobile) | `pages/Checkout.tsx` | "Pagamento com carteira", carteiras cadastradas (Principal/Reserva), "Trocar carteira", lista WalletConnect/MetaMask/Coinbase, total e botão em pílula |
| Confirmação de Pedido | `pages/Order.tsx` | Cartão com ícone "Thank you", "Seus NFTs agora estão na sua carteira", faixa ID/Data/Total/Carteira, detalhes da transação, taxa, total e "Ver no Etherscan" |
| Login / Cadastro | `pages/Auth.tsx` | Modal com abas "Entrar" e "Criar conta"\| Criar conta" sobre o Início, olho de mostrar senha, "Esqueceu a senha?", "Ou continue com" Google/Facebook; no mobile, tela cheia com KURIO e "Criar perfil de colecionador" |
| Perfil do Colecionador | `pages/Profile.tsx`, `components/AccountLayout.tsx` | Menu "Meu perfil" (Dados do perfil, Carteiras, Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte, Sair), campos, avatar com Alterar/Remover, "Alterar senha" e Salvar |
| Carteiras | `pages/Wallets.tsx` | "Carteira principal" com todos os campos e "Salvar carteira"; "Carteira secundária" com "Igual à carteira principal" e "Adicionar" |

**Diferenças conscientes (e por quê):**
- Rótulos de campos que no Figma só têm placeholder existem para leitores de tela (invisíveis na tela).
- O filtro "Disponibilidade" não aparece no painel (não está no frame), mas continua funcionando pela URL.
- No mobile, "Ordenar por" fica dentro da gaveta de filtros (o frame não mostra ordenação).
- No pagamento mobile, o formulário do colecionador aparece abaixo das carteiras, porque os campos são obrigatórios.
- Antes de enviar o pedido, um diálogo de revisão é exibido (exigência do desafio: "permitir revisão antes do envio").
- Itens do layout fora do escopo (Criadores, Aprenda, Atividade, Ofertas, Arquivos baixados, Suporte, artigos do Diário, login com Google/Facebook, newsletter, leitor de QR) aparecem iguais ao Figma, mas avisam "disponível em breve" — nunca simulam sucesso.
- As ilustrações têm a resolução dos frames exportados (o arquivo não trazia os originais em alta).
