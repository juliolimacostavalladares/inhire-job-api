# SDD-004 — Filas, idempotência e recuperação

Implementa ADR-002 e ADR-003.

## Filas BullMQ

| Fila                | Job name                      | Payload mínimo                | Concorrência inicial |
| ------------------- | ----------------------------- | ----------------------------- | -------------------: |
| `tenant-discovery`  | `discover-tenants`            | `{runId}`                     |                    1 |
| `job-collection`    | `collect-tenant-jobs`         | `{runId,tenantId}`            |                    5 |
| `profile-analysis`  | `analyze-profile`             | `{importId,userId}`           |                    2 |
| `resume-generation` | `generate-tailored-resume`    | `{generationId,userId,jobId}` |                    2 |
| `job-application`   | `submit-official-application` | `{applicationId}`             |                    1 |
| `auto-apply`        | `evaluate-auto-apply`         | `{userId,evaluationDate}`     |                    2 |

Payload não carrega perfil, HTML ou PDF; processor recarrega dados do Postgres/storage. Queue names e job names são constantes compartilhadas apenas pela infraestrutura.

## Job IDs

- discovery/collection: `<type>:<runId>:<tenantId?>`;
- profile: `profile:<importId>`;
- resume: `resume:<generationId>` ou chave lógica hasheada;
- application: `application:<applicationId>`;
- autoapply: `autoapply:<userId>:<YYYY-MM-DD>`.

BullMQ rejeita job duplicado existente; o domínio também possui unique constraints e checagem de estado.

## Retry

Padrão: 3 attempts, exponential backoff 5 s com jitter configurado pelo processor. Collection pode usar 5 attempts. Erro de validação/permanente é descartado sem retry automático e fica registrado no recurso. Jobs esgotados permanecem consultáveis em failed set por 30 dias.

## Reconciliação

Scheduler a cada minuto procura:

- recursos `QUEUED` sem job ativo;
- `PROCESSING` além do timeout sem lock ativo;
- geração pronta sem artifact/checksum;
- Application com receipt mas estado não terminal;
- Run com contadores incompatíveis.

O reconciliador usa lock Postgres para uma instância ativa, reaplica apenas transições seguras e registra ação. Nunca reenvia `SUBMITTED` ou `OUTCOME_UNKNOWN`.

## Shutdown

API fecha HTTP e conexão DB. Worker pausa novas reservas, aguarda jobs ativos até grace period, fecha browsers, BullMQ, Redis e DB. Job interrompido antes de receipt pode ser reprocessado; após resposta possivelmente aceita segue para manual.

## Testes de falha

Cobrir crash depois do commit/antes do enqueue, enqueue duplicado, crash antes/depois de cada transição, Redis indisponível, job stalled, retry esgotado, dois workers concorrentes e restart durante Playwright.
