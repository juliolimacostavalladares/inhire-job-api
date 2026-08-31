# Contratos BullMQ

Postgres é a fonte de verdade. Payloads de fila carregam apenas IDs e correlação; o processor recarrega o recurso e chama um caso de uso idempotente.

| Queue               | Job name                      | Payload                                     | Job ID                          |
| ------------------- | ----------------------------- | ------------------------------------------- | ------------------------------- |
| `tenant-discovery`  | `discover-tenants`            | `{runId,correlationId}`                     | `discovery:<runId>`             |
| `job-collection`    | `collect-tenant-jobs`         | `{runId,tenantId,correlationId}`            | `collection:<runId>:<tenantId>` |
| `profile-analysis`  | `analyze-profile`             | `{importId,userId,correlationId}`           | `profile:<importId>`            |
| `resume-generation` | `generate-tailored-resume`    | `{generationId,userId,jobId,correlationId}` | `resume:<generationId>`         |
| `job-application`   | `submit-official-application` | `{applicationId,correlationId}`             | `application:<applicationId>`   |
| `auto-apply`        | `evaluate-auto-apply`         | `{userId,evaluationDate,correlationId}`     | `autoapply:<userId>:<date>`     |

## Regras comuns

- payload rejeita chave extra e valida UUID/data;
- PII, HTML, answers e PDF nunca entram na fila;
- `attempts`, backoff, timeout e concurrency são definidos por queue/processor;
- processor verifica estado terminal antes de executar;
- falha atualiza o recurso/attempt com código estável antes de lançar quando retryable;
- concluído significa estado persistido, não apenas retorno do processor;
- jobs duplicados retornam o resultado persistido;
- reconciliador reenqueue somente estado seguro.

## Outcomes

- discovery/collection: `SUCCEEDED`, `PARTIAL`, `FAILED` no CrawlRun;
- profile/resume: status específico do recurso;
- application: `SUBMITTED`, `REQUIRES_MANUAL_ACTION` ou `FAILED`;
- falha técnica BullMQ não é exibida diretamente; API traduz o estado persistido pelo catálogo de erros.
