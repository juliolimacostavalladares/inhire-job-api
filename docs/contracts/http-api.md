# Contrato HTTP v1

Base path `/v1`; JSON; timestamps UTC ISO-8601. Auth `Bearer <token>`. Operações assíncronas exigem `Idempotency-Key` e retornam `X-Correlation-Id`.

## Auth

| Método/path           | Auth          | Sucesso               |
| --------------------- | ------------- | --------------------- |
| `POST /auth/register` | público       | `201 User + session`  |
| `POST /auth/login`    | público       | `200 User + session`  |
| `POST /auth/refresh`  | refresh token | `200 rotated session` |
| `POST /auth/logout`   | sessão        | `204`                 |
| `GET /auth/me`        | User          | `200 identity`        |

## Candidate Profile

| Método/path                             | Sucesso                             |
| --------------------------------------- | ----------------------------------- |
| `GET /me/profile`                       | `200` ou `404 PROFILE_NOT_STARTED`  |
| `PUT/PATCH /me/profile`                 | `200 Profile`                       |
| `POST /me/profile/imports`              | `202 {importId,status,location}`    |
| `GET /me/profile/imports/:id`           | `200 ImportAttempt`                 |
| `GET /me/profile/readiness?purpose=...` | `200 {ready,missingFields,version}` |
| `GET/PUT /me/auto-apply-policy`         | `200 Policy`                        |

GET não agenda trabalho nem altera estado.

## Catalog

| Método/path                     | Auth    | Sucesso                                     | Descrição                                                              |
| ------------------------------- | ------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `GET /tenants`                  | público | `200 {items: Tenant[], total: number}`      | Lista todas as empresas ativas descobertas (`?page`, `?limit`, `?search`) |
| `GET /tenants/:idOrSlug`        | público | `200 Tenant`                                | Consulta detalhes de uma empresa por ID ou slug                         |
| `GET /tenants/:idOrSlug/jobs`   | público | `200 {items: Job[], total: number}`         | Lista todas as vagas publicadas de uma empresa específica              |
| `GET /jobs`                     | público | `200 {items: Job[], total: number}`         | Lista vagas do catálogo (`?tenantId`, `?tenantSlug`, `?search`, `?page`, `?limit`) |
| `GET /jobs/:id`                 | público | `200 Job`                                   | Consulta detalhes da vaga com snapshot e `url` canônica byte-a-byte    |
| `GET /jobs/:id/application-form`| público | `200 FormFieldSchema[]`                     | Obtém o formulário oficial de candidatura da vaga                      |

Escritas de Tenant exigem ADMIN. Job devolve `url` exatamente como persistida.

## Resume

| Método/path                         | Sucesso                                  |
| ----------------------------------- | ---------------------------------------- |
| `POST /jobs/:jobId/resumes`         | `202 {generationId,status,location}`     |
| `GET /resume-generations/:id`       | `200 Generation`                         |
| `GET /jobs/:jobId/resume`           | `200 Resume` ou `404 RESUME_NOT_STARTED` |
| `GET /resume-artifacts/:id/content` | stream `200` ou redirect assinado        |

## Applications

`POST /jobs/:jobId/applications`:

```json
{ "resumeMode": "AI_TAILORED", "existingArtifactId": null, "answers": {} }
```

Resposta `202`:

```json
{
  "applicationId": "uuid",
  "status": "QUEUED",
  "location": "/v1/applications/uuid",
  "correlationId": "uuid"
}
```

Consultas: `GET /applications`, `GET /applications/:id`, `GET /applications/:id/attempts`. Retry administrativo: `POST /admin/applications/:id/retry` com `{reason}`. `submittedAt` e receipt existem somente com `SUBMITTED` comprovado.

## Acquisition e operação

ADMIN: `POST /runs/collection`, `POST /runs/discovery`, `GET /runs`, `GET /runs/:id`, gestão de tenants e retry permitido. Saúde: `GET /health/live`, `GET /health/ready`; métricas em endpoint interno protegido. Não existe controller de resumo ligado a uma interface de usuário.

## Erro

```json
{
  "type": "https://errors.inhire.internal/PROFILE_NOT_READY",
  "title": "Perfil incompleto",
  "status": 422,
  "code": "PROFILE_NOT_READY",
  "detail": "Revise os campos obrigatórios antes de continuar.",
  "instance": "/v1/applications/...",
  "correlationId": "uuid",
  "fields": [{ "path": "phone", "code": "REQUIRED" }]
}
```

Clients tomam decisão por `code`, não por `detail`.
