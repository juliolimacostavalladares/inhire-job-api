# Context Map — InHire Backend

O produto é um único microserviço backend, implantável de forma isolada. Internamente ele é um monólito modular: cada contexto possui domínio, casos de uso, portas e adapters próprios, mas todos são empacotados no mesmo código, usam a mesma API HTTP, o mesmo Postgres e workers BullMQ.

## Contextos internos

| Contexto          | Módulo                  | Responsabilidade                              | Integração interna                            |
| ----------------- | ----------------------- | --------------------------------------------- | --------------------------------------------- |
| Identity & Access | Auth                    | conta, credencial, papel e sessão             | casos de uso e guards                         |
| Candidate         | Candidate Profile       | perfil, preferências e prontidão              | interfaces de aplicação                       |
| Job Catalog       | Jobs/Tenants            | vagas, tenants, formulário e URL oficial      | repositórios e casos de uso                   |
| Acquisition       | Collection/Discovery    | descoberta, coleta e runs                     | filas BullMQ e Catalog use cases              |
| Resume            | Resume Generation       | currículo sob medida, IA, PDF e artefatos     | fila de geração e interface `ResumeGenerator` |
| Application       | Job Applications        | intenção, estado e coordenação da candidatura | fila de candidatura e interfaces internas     |
| Submission        | Official InHire Adapter | preenchimento oficial via Playwright          | adapter chamado pelo Application worker       |
| Auto Apply        | Auto Apply              | políticas, matching, quota e enfileiramento   | scheduler/use case e fila de candidatura      |
| Operations        | Health/Runs             | saúde, execução e diagnóstico operacional     | queries e métricas do próprio backend         |

## Dependências permitidas

```text
HTTP Controllers -> Application Use Cases -> Domain
BullMQ Processors -> Application Use Cases -> Domain
Infrastructure Adapters -> Application Ports -> Domain

Application -> Candidate, Catalog, Resume e Submission por interfaces internas
Acquisition -> Catalog por caso de uso interno
Auto Apply -> Candidate, Catalog e Application por interfaces internas
```

Nenhum controller ou processor acessa regra de negócio diretamente. Módulos não importam adapters concretos de outros módulos; dependem de interfaces na camada de aplicação. Chamadas internas não usam HTTP.

## Processos do mesmo microserviço

- `api`: NestJS HTTP, validação, autenticação e consultas/comandos rápidos.
- `worker`: consumers BullMQ para coleta, descoberta, IA, PDF e submissão Playwright.
- `scheduler`: pode executar junto do worker; apenas agenda jobs idempotentes.

Os processos compartilham código e Postgres, mas podem escalar separadamente.

## Invariantes globais

1. Uma candidatura por `(userId, jobId)` enquanto reaplicação não for autorizada.
2. Estados terminais de candidatura não regridem.
3. A URL usada pelo Playwright é uma cópia exata de `Job.url`; nunca é reconstruída.
4. Currículo automático deve estar pronto antes da submissão oficial.
5. Reprocessar o mesmo job não duplica currículo, candidatura ou submissão.
6. Ausência de currículo sem tentativa retorna `NOT_STARTED`, nunca `FAILED`.
7. A API só informa `SUBMITTED` quando existe evidência do envio oficial.

## Glossários

Os termos de domínio ficam em `backend/docs/contexts/*/CONTEXT.md`.
