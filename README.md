# LumaMart Chatbot

![Status Build](https://img.shields.io/badge/build-pronto%20para%20deploy-1E90FF?style=flat-square) ![Status Lint](https://img.shields.io/badge/lint-ESLint-4B32C3?style=flat-square) ![Status Tests](https://img.shields.io/badge/tests-Vitest-28a745?style=flat-square) ![Node Version](https://img.shields.io/badge/node-%3E%3D20-026e00?style=flat-square)

LumaMart Chatbot e um concierge digital construido com Next.js e IA generativa para guiar clientes pela vitrine online da LumaMart. A aplicacao entrega respostas rapidas, links relevantes e resiliencia contra falhas externas, funcionando tanto com o modelo hospedado na OpenRouter quanto com respostas de fallback embarcadas.

## Visao geral
- Atendimento em tempo real com prompt afinado para o tom da marca LumaMart.
- Interface responsiva com framer-motion, tema claro/escuro e feedbacks sonoros.
- Fluxo de conversa resiliente com rate limiting, circuito de protecao e logging estruturado.
- Dados de fallback (departamentos, trocas, pagamentos) mantidos no repo para operacao offline.

## Principais recursos
- **Chat inteligente**: integra-se ao endpoint de chat do OpenRouter com mensagens de contexto e instrucao de sistema especifica (`src/data/botInstructions.json`).
- **Respostas de emergencia**: em caso de erro na IA, o bot simula respostas a partir de `src/data/responses.json`, incluindo sugestoes de links uteis.
- **Contencao de abuso**: limitacao de taxa via Upstash Redis com alternativa em memoria para ambientes sem Redis.
- **Circuit breaker**: suspende chamadas ao provedor de IA quando ha falhas consecutivas, reduzindo custos e melhorando estabilidade.
- **Telemetry**: `src/lib/logger.ts` centraliza logs JSON, respeitando o nivel definido em `LOG_LEVEL`.
- **UX refinada**: componentes reutilizaveis (`ChatBox`, `MessageBubble`, `ChatInput`, `ThemeToggle`) com animacoes suaves e atalhos de teclado.

## Stack e arquitetura
- **Framework**: Next.js 15 (App Router) com React 19 e TypeScript.
- **UI**: Tailwind CSS 4, framer-motion e variaveis CSS personalizadas.
- **Backend**: API Route (`src/app/api/chat/route.ts`) que orquestra validacao, protecoes e chamada ao provider.
- **Infra opcional**: Upstash Redis para rate limiting persistente.
- **Testes**: Vitest + Testing Library para cobranca de API e utilitarios (`tests/`).

## Requisitos
- Node.js >= 20
- npm >= 10
- Conta no OpenRouter e (opcional) instancia Upstash Redis

## Configuracao do ambiente
1. Instale as dependencias:
   ```bash
   npm install
   ```
2. Crie um arquivo `.env.local` na raiz e defina pelo menos a chave da OpenRouter:
   ```dotenv
   OPENROUTER_API_KEY=coloque_sua_chave_aqui
   ```
3. (Opcional) Configure Redis para garantir rate limiting persistente:
   ```dotenv
   UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=seu_token
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Acesse `http://localhost:3000` e abra o chat em `/chat`.

## Variaveis de ambiente
| Variavel | Obrigatorio | Descricao |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Sim | Token da OpenRouter usado pelo endpoint `/api/chat`. |
| `UPSTASH_REDIS_REST_URL` | Nao | Endpoint REST do Redis para rate limit (opcional, usa memoria quando ausente). |
| `UPSTASH_REDIS_REST_TOKEN` | Nao | Token REST do Redis. |
| `RATE_LIMIT_WINDOW_MS` | Nao | Janela do rate limit em ms (padrao 15000). |
| `RATE_LIMIT_MAX_REQUESTS` | Nao | Numero maximo de chamadas por janela (padrao 10). |
| `RATE_LIMIT_ALLOW_MEMORY` | Nao | Define se o fallback em memoria pode ser usado (`true`/`false`). |
| `RATE_LIMIT_MEMORY_MAX_KEYS` | Nao | Limite de chaves controladas no fallback em memoria. |
| `CIRCUIT_COOLDOWN_MS` | Nao | Tempo de espera apos o circuito abrir (padrao 30000). |
| `CIRCUIT_FAILURE_THRESHOLD` | Nao | Falhas consecutivas para abrir o circuito (padrao 5). |
| `MAX_CONTEXT_MESSAGES` | Nao | Limite de mensagens mantidas antes de enviar ao provedor. |
| `MAX_MESSAGE_CHARS` | Nao | Tamanho maximo de cada mensagem enviada. |
| `LOG_LEVEL` | Nao | Nivel minimo de log (`debug`, `info`, `warn`, `error`). |

## Scripts npm
- `npm run dev`: inicia o servidor Next.js em modo desenvolvimento.
- `npm run build`: gera a versao de producao.
- `npm run start`: roda a build em ambiente de producao.
- `npm run lint`: executa o linting com ESLint.
- `npm run test`: executa a suite de testes com Vitest.

## Estrutura de pastas
```text
src/
  app/
    page.tsx                # Landing page com chamada para o chat
    chat/page.tsx           # Entrada principal do chatbot
    api/chat/route.ts       # Endpoint que integra IA + protecoes
  components/
    ChatBox.tsx             # Orquestra mensagens, fallback e UI
    ChatInput.tsx           # Campo de envio com interacoes
    MessageBubble.tsx       # Baloes de usuario e bot
    ThemeProvider.tsx       # Contexto de tema claro/escuro
  data/
    responses.json          # Respostas predefinidas para fallback
    botInstructions.json    # Prompt base do assistente
  lib/
    chatGuards.ts           # Rate limiting e circuito
    logger.ts               # Utilitario de log
public/
  sounds/notification.mp3   # Feedback sonoro ao receber resposta
tests/
  chatRoute.test.ts         # Testes da API de chat
  chatGuards.test.ts        # Testes dos guardas de protecao
```

## Testes e qualidade
- Execute `npm run test` para validar a API, guardas e mocks de Redis.
- Utilize `npm run lint` antes de subir mudancas para garantir padrao de codigo.
- Testes de UI utilizam Vitest + Testing Library com setup em `tests/setup.ts`.

## Personalizacao
- Ajuste o tom de voz do bot editando `src/data/botInstructions.json`.
- Edite os cenarios de fallback em `src/data/responses.json` para alinhar com novas campanhas.
- Altere cores e variaveis de tema em `src/app/globals.css` e nos componentes de tema.

## Implantacao
- Execute `npm run build` seguido de `npm run start` em um ambiente com as variaveis configuradas.
- Garanta que o Redis (quando usado) esteja acessivel a partir do ambiente de deploy.