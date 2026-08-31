# Catálogo de erros

| Code                          |    HTTP | Retry       | Semântica                               |
| ----------------------------- | ------: | ----------- | --------------------------------------- |
| `VALIDATION_FAILED`           |     400 | não         | payload inválido                        |
| `UNAUTHENTICATED`             |     401 | não         | credencial inválida                     |
| `FORBIDDEN`                   |     403 | não         | papel/ownership insuficiente            |
| `RESOURCE_NOT_FOUND`          |     404 | não         | recurso inexistente                     |
| `PROFILE_NOT_STARTED`         |     404 | não         | perfil ainda não criado                 |
| `RESUME_NOT_STARTED`          |     404 | não         | geração ainda não solicitada            |
| `IDEMPOTENCY_CONFLICT`        |     409 | não         | mesma chave com payload diferente       |
| `APPLICATION_ALREADY_EXISTS`  |     409 | não         | candidatura já existe                   |
| `INVALID_STATE_TRANSITION`    |     409 | não         | comando incompatível com estado         |
| `PROFILE_NOT_READY`           |     422 | não         | faltam dados objetivos                  |
| `JOB_NOT_PUBLISHED`           |     422 | não         | vaga fechada/inativa                    |
| `JOB_URL_NOT_ALLOWED`         |     422 | não         | URL inválida/fora da allowlist          |
| `RESUME_GENERATION_FAILED`    | 422/503 | depende     | tentativa real falhou                   |
| `RESUME_ARTIFACT_INVALID`     |     422 | não         | PDF/checksum/MIME inválido              |
| `FORM_REQUIRED_FIELD_MISSING` |     422 | não         | formulário bloqueado por campo          |
| `FORM_SCHEMA_UNSUPPORTED`     |     422 | não         | controle desconhecido                   |
| `EXTERNAL_JOB_CLOSED`         |     422 | não         | página oficial encerrada                |
| `EXTERNAL_RATE_LIMITED`       |     503 | sim         | resposta 429                            |
| `EXTERNAL_UNAVAILABLE`        |     503 | sim         | rede/5xx transitório                    |
| `SUBMISSION_OUTCOME_UNKNOWN`  |     422 | manual      | possível aceite sem prova; não reenviar |
| `SUBMISSION_RECEIPT_INVALID`  |     500 | manual      | sucesso sem evidência suficiente        |
| `QUOTA_EXCEEDED`              |     429 | após janela | limite de autoaplicação                 |
| `QUEUE_UNAVAILABLE`           |     503 | sim         | registro salvo; reconciliador tentará   |
| `INTERNAL_ERROR`              |     500 | depende     | detalhe oculto                          |

`NOT_STARTED` nunca usa texto de falha. Timeout de seletor é traduzido para campo/etapa ou `FORM_SCHEMA_UNSUPPORTED`.
