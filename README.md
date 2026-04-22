# RAG System

## Sobre o Projeto

API REST de Retrieval-Augmented Generation (RAG) que ingere documentação a partir de URLs, gera embeddings e responde perguntas com base no conteúdo indexado.

O pipeline é dividido em módulos independentes: **ingestion** (crawling e parsing), **chunking**, **embedding**, **storage** (PostgreSQL + pgvector), **retrieval** (busca híbrida vetorial + keyword) e **generation** (resposta via LLM).

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** NestJS
- **ORM:** Prisma
- **Banco de dados:** PostgreSQL com extensão `pgvector`
- **LLM / Embeddings:** OpenAI (`gpt-4o` / `text-embedding-3-small`) via LangChain
- **Containerização:** Docker / Docker Compose
- **Package manager:** pnpm

## Configuração

1. Copie o arquivo de variáveis de ambiente:

```bash
cp .env.example .env
```

2. Preencha as variáveis no `.env`:

| Variável | Descrição |
|---|---|
| `OPENAI_API_KEY` | Chave da API OpenAI |
| `OPENAI_MODEL` | Modelo de geração (ex: `gpt-4o`) |
| `OPENAI_EMBEDDING_MODEL` | Modelo de embedding (ex: `text-embedding-3-small`) |
| `DATABASE_URL` | Connection string do PostgreSQL |
| `DOCS_BASE_URL` | URL base para crawling de documentação |
| `RETRIEVAL_TOP_K` | Número de chunks retornados na busca |

3. Suba o banco de dados:

```bash
docker compose up -d
```

4. Instale as dependências e rode as migrations:

```bash
pnpm install
pnpm prisma:generate
```

## Execução

```bash
# Desenvolvimento (watch mode)
pnpm start:dev

# Produção
pnpm build
pnpm start:prod
```

A documentação interativa da API estará disponível em `http://localhost:3000/api` (Swagger).
