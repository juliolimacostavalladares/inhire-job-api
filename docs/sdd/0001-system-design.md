# SDD-001 — Desenho do microserviço backend

Implementa PRD-001 e respeita ADR-001 a ADR-012.

## Topologia

```text
API Client -> NestJS HTTP process -> Application Use Cases -> Postgres / Redis
                                      |                     Object Storage
                                      +-> BullMQ queues
BullMQ worker process -> Processors -> mesmos Application Use Cases
                                      -> AI / InHire HTTP / Playwright
```

API e worker são entrypoints do mesmo código e da mesma imagem. Podem ser implantados e escalados separadamente, mas formam um único microserviço e compartilham schema/migrations.

## Estrutura alvo

```text
backend/src/
  modules/
    auth/
    candidate-profile/
    catalog/
    acquisition/
    resume/
    applications/
    auto-apply/
    operations/
      domain/          entidades, value objects, invariantes
      application/     use cases, DTOs internos, interfaces/ports
      infrastructure/  Prisma repositories, providers e processors
      presentation/    controllers, DTOs HTTP e guards locais
  shared/
    domain/             IDs, Clock e erros comuns estáveis
    infrastructure/    Prisma, BullMQ, logging, tracing e config
  main.ts               processo HTTP
  worker.ts             processo de filas/scheduler
```

Durante a migração, a estrutura global `domain/app/infra/presentation` pode coexistir, mas toda nova capacidade pertence a um módulo. Mover arquivos não pode alterar contratos sem requisito.

## Clean Architecture e SOLID

- dependências: Presentation/Infrastructure -> Application -> Domain;
- Domain não importa NestJS, Prisma, BullMQ, Playwright, Axios ou SDK de IA;
- controllers apenas validam/autorizam e chamam um caso de uso;
- processors apenas validam payload técnico e chamam um caso de uso idempotente;
- casos de uso dependem de interfaces pequenas e recebem adapters por injeção;
- cada módulo oferece uma interface interna pequena; implementação e tabelas ficam escondidas;
- interfaces só existem quando há variação real ou necessidade de isolar I/O.

## Tecnologias

Node.js 20+, TypeScript strict, NestJS 11, Prisma/Postgres, Redis/BullMQ, S3-compatible storage, Playwright, OpenTelemetry, Jest/Supertest/Testcontainers. Versões exatas ficam em lockfile/imagem; `latest` é proibido.

## Processos e configuração

`main.ts` não registra processors. `worker.ts` não expõe rotas de negócio, apenas health interno opcional. Variáveis são validadas no boot: `DATABASE_URL`, `REDIS_URL`, storage, JWT, IA, timeouts, concorrência e allowlists. Segredos vêm do ambiente/secret manager.

## Convenções

- UUID para recursos; UTC no banco; dinheiro em centavos+moeda;
- JSON camelCase; banco snake_case; paginação por cursor ou page/limit estável;
- cada operação longa possui registro no banco, status e `jobId` BullMQ determinístico;
- erros públicos usam `code`; mensagens não controlam fluxo;
- imports entre módulos passam pela interface pública do módulo, nunca por arquivo interno.

## Gates

CI falha para import de Infrastructure no Domain/Application, Prisma em controller/use case, processor com regra própria, rota sem auth/error contract, migration destrutiva sem rollback ou requisito P0 sem teste.
