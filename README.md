# Google Shopping Agent

Agente de IA que encontra **os melhores preços no Brasil** para **produtos, passagens aéreas e hotéis**. Ele usa um grafo do LangGraph com dois nós (pesquisa e resposta), um modelo via OpenRouter e três tools que consultam o Google Shopping, o Google Flights e o Google Hotels através da SerpApi. Todos os preços são em BRL.

## Como funciona

```
Pergunta do usuário
        |
        v
  [ researcher ]  -> LLM com tools: escolhe a tool certa e preenche os argumentos
        |               google_shopping | google_flights | google_hotels
        v
  JSON bruto da SerpApi (já normalizado e ordenado por preço)
        |
        v
  [ responder ]   -> LLM sem tools: lê os dados e escreve a recomendação
        |
        v
     Resposta
```

- **researcher** (`src/graph/nodes/researcherNode.ts`): recebe a pergunta, chama o agente com o prompt de roteamento e guarda o resultado bruto das tools no estado do grafo.
- **responder** (`src/graph/nodes/responderNode.ts`): recebe a pergunta e os dados e redige a resposta. Ele roda sem tools, então não faz novas buscas.
- **Roteamento**: o modelo decide qual tool usar pelo nome, pela descrição e pelo schema de cada tool, reforçados pelo prompt em `src/prompts/v1/keywords.ts`.

### Tools

| Tool | Quando é usada | Dados principais |
| --- | --- | --- |
| `google_shopping` | Comprar ou comparar preço de um produto | `query`, faixa de preço, frete grátis, em promoção |
| `google_flights` | Passagens aéreas | origem e destino (IATA), data de ida, data de volta (opcional), adultos, classe, só voo direto, preço máximo |
| `google_hotels` | Hospedagem | destino, check-in, check-out, adultos, faixa de preço, nota mínima, cancelamento grátis |

Cada tool valida os argumentos com Zod antes de chamar a SerpApi (por exemplo, código IATA com 3 letras maiúsculas e datas em `YYYY-MM-DD`), então argumentos inválidos não gastam créditos.

## Tecnologias

- Node.js 24 e TypeScript (executado direto pelo Node, sem etapa de build)
- [Fastify](https://fastify.dev/) para a API HTTP
- [LangGraph](https://langchain-ai.github.io/langgraphjs/) e [LangChain](https://js.langchain.com/) (`createAgent`)
- [OpenRouter](https://openrouter.ai/) como provedor do modelo (configurável em `src/config.ts`)
- [SerpApi](https://serpapi.com/) (Google Shopping, Google Flights e Google Hotels)
- `@langchain/mcp-adapters` (servidor MCP de filesystem)
- Zod para validação de schemas

## Pré-requisitos

- Node.js 24 (versão usada no desenvolvimento) e npm
- Chave de API da [OpenRouter](https://openrouter.ai/keys)
- Chave de API da [SerpApi](https://serpapi.com/manage-api-key)

## Instalação

```bash
git clone https://github.com/SEU_USUARIO/google-shopping.git
cd google-shopping

# Instala as dependências exatamente como estão no package-lock.json
npm ci
```

## Configuração

Copie o arquivo de exemplo e preencha as chaves:

```bash
cp .env.example .env
```

No Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

Variáveis usadas:

```env
OPENROUTER_API_KEY=sua_chave_da_openrouter
SERPAPI_API_KEY=sua_chave_da_serpapi
```

- Escreva os valores **sem aspas** e **sem espaço** depois do `=`.
- Nunca faça commit do `.env` (ele está no `.gitignore`).
- O Node só lê o `.env` ao iniciar, então reinicie o servidor depois de alterá-lo.

Outros ajustes ficam em `src/config.ts`: modelo do OpenRouter, `temperature`, `maxTokens` e as opções da SerpApi (`cacheTTL`, `disabled`).

## Como executar

### 1. Servidor Fastify (endpoint `/chat`)

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000`. O `src/index.ts` já dispara uma pergunta de teste ao iniciar. Para testar manualmente:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  --data '{"question": "Qual o voo mais barato de BH para Salvador, saindo 20/11/2026 e voltando 25/11/2026?"}'
```

### 2. LangGraph Studio (`langgraph dev`)

Para depurar o grafo visualmente (nós, mensagens, chamadas de tool):

```bash
npx @langchain/langgraph-cli dev
```

O comando lê o `langgraph.json` da raiz do projeto, sobe o servidor da LangGraph API e abre o Studio no navegador. Se o terminal reclamar de versões incompatíveis, atualize os pacotes e limpe o cache do `npx`:

```bash
npm i @langchain/langgraph@latest @langchain/core@latest
```

## Exemplos de perguntas

- Produto: `Menor preço do Samsung Galaxy S24 128GB com frete grátis`
- Voo: `Voo mais barato de BH para São Paulo, saindo 20/11/2026 e voltando 23/11/2026`
- Hotel: `Hotéis em João Pessoa de 01/03/2027 a 10/03/2027`
- Misto: `Quero voo e hotel para Porto de Galinhas de 10/12/2026 a 14/12/2026`

Datas escritas em formato brasileiro (`DD/MM/AAAA`) são convertidas pelo modelo. Se faltar origem, destino ou data, o agente pergunta o que está faltando em vez de inventar.

## Estrutura do projeto

```
.
├── data/                      # fixtures usadas quando a SerpApi está desativada
├── src/
│   ├── config.ts              # modelo, OpenRouter e opções da SerpApi
│   ├── index.ts               # sobe o servidor e faz um teste em /chat
│   ├── server.ts              # configuração do Fastify e rotas
│   ├── graph/
│   │   ├── graph.ts           # definição do grafo (researcher -> responder)
│   │   ├── factory.ts         # criação do grafo e dos nós
│   │   ├── state.ts           # estado do grafo
│   │   └── nodes/
│   │       ├── researcherNode.ts
│   │       └── responderNode.ts
│   ├── prompts/v1/
│   │   ├── keywords.ts        # prompt do researcher (roteamento entre as tools)
│   │   └── shoppingResponder.ts  # prompt do responder
│   ├── services/
│   │   ├── mcpService.ts      # registra o MCP de filesystem e as tools de busca
│   │   ├── openRouterService.ts  # cliente do modelo e execução do agente
│   │   └── serpApiService.ts  # chamadas à SerpApi, parsing e cache
│   └── tools/
│       ├── googleShoppingTool.ts
│       ├── googleFlightsTool.ts
│       └── googleHotelsTool.ts
└── langgraph.json
```

> A estrutura reflete o estado atual do projeto. Ajuste os nomes se você renomear arquivos.

## Cache e consumo de créditos

- Cada chamada a uma tool que chega à SerpApi consome uma busca do seu plano.
- O `SerpAPIService` guarda os resultados em memória pelo tempo definido em `cacheTTL` (padrão: 1 hora). Buscas idênticas dentro desse prazo não vão de novo à SerpApi.
- O cache é apagado quando o servidor reinicia.
- Com `disabled: true` em `src/config.ts`, o Shopping devolve dados de exemplo e voos e hotéis devolvem uma lista vazia, sem gastar créditos.
- O responder não usa tools, então não faz buscas.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `Invalid API key` na resposta | Chave da SerpApi errada, revogada ou mal lida | Gere ou copie a chave de novo, ajuste o `.env` e reinicie |
| `does not provide an export named ...` | Arquivo vazio ou não salvo no editor | Salve todos os arquivos (`Ctrl+K S`) e confira o conteúdo |
| `Expected string, received array` (campo `question`) | Mensagem enviada pelo Studio chega como lista de blocos | Use a versão atual do `researcherNode.ts`, que normaliza o texto |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` ao rodar o `langgraph dev` | Versões incompatíveis entre o CLI e o `@langchain/langgraph` | Atualize os pacotes e limpe o cache do `npx` |
| Resposta fala em "problema técnico" | A tool devolveu um erro (data inválida, sem resultados, chave) | Veja o log `LLM Response` e a mensagem da tool |

## Limitações conhecidas

- Cada requisição é independente: o agente não guarda o histórico entre perguntas, então a pergunta precisa vir completa (origem, destino e datas, no caso de voos).
- Em voos de ida e volta, o preço é o retornado pelo Google Flights para a busca feita. Os detalhes do voo de volta não são consultados.
- Não há limite rígido de chamadas por pergunta. O LangChain oferece middlewares (`toolCallLimitMiddleware` e `modelCallLimitMiddleware`) para isso.

## Próximos passos

- Adicionar um limite de chamadas de tool e de modelo por pergunta.
- Dar memória de conversa ao agente.
- Testes automatizados para os parsers do `SerpAPIService`.
- Fixtures para voos e hotéis no modo `disabled`.

## Licença

Defina a licença do projeto (por exemplo, MIT) e adicione um arquivo `LICENSE`.