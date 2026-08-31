# SDD-007 — Migração e reconstrução

## Estado atual e alvo

O backend já usa NestJS, Prisma/Postgres, Redis/BullMQ, Playwright e uma porta de IA. O alvo preserva um único microserviço e corrige violações de Clean Architecture: Prisma direto em controllers/use cases, regra dentro de processors, estados insuficientes, arquivos base64 e jobs sem reconciliação.

## Migração incremental

1. **Baseline:** characterization/regression tests e métricas dos fluxos atuais.
2. **Módulos:** definir interfaces públicas e mover código por capacidade sem mudar HTTP.
3. **Persistência:** repositories por módulo; remover Prisma de controllers/use cases; adicionar constraints/version/attempts.
4. **Filas:** payloads por ID, jobIds determinísticos, retry classificado e reconciliador.
5. **Artifacts:** copiar PDF base64 para S3, validar SHA-256 e só então remover coluna antiga.
6. **Application:** introduzir orquestrador/attempt/receipt, shadow run sem click e canary autorizado.
7. **Auto Apply/Operations:** reutilizar casos de uso, remover defaults e acesso direto ao banco.
8. **Cleanup:** remover compatibilidade após janela de rollback e evidência.

## Mapeamento legado

| Modelo                 | Módulo dono       | Ajuste                                    |
| ---------------------- | ----------------- | ----------------------------------------- |
| User                   | Auth              | adicionar refresh sessions/audit          |
| CandidateProfile       | Candidate Profile | separar import attempts/artifact          |
| Tenant/Job             | Catalog           | `Job.url` preservada byte a byte          |
| CrawlRun/Item/Evidence | Acquisition       | processors chamam cases/repositories      |
| TailoredResume         | Resume            | artifact em storage, chave lógica/version |
| JobApplication         | Applications      | substep, attempts, receipt e version      |

Status: `QUEUED` permanece; `PROCESSING` antigo preso vira manual após análise; `FAILED`/`REQUIRES_MANUAL_ACTION` permanecem. `SUBMITTED` sem receipt verificável recebe `LEGACY_SUBMITTED_UNVERIFIED` e não é usado como prova de integração nova.

## Reconstrução do zero

1. toolchain, CI e config validation;
2. Postgres, Redis, MinIO e observabilidade local;
3. shared domain/infrastructure e migrations;
4. Auth e Candidate Profile;
5. Catalog e Acquisition;
6. Resume;
7. Applications + Playwright fixture;
8. Auto Apply e Operations;
9. E2E, failure tests, dashboards e release.

Cada etapa só avança após gate do SDD-006. Imagens/lockfiles usam versões fixas. Dois builds são equivalentes quando passam os mesmos contratos HTTP/queue, migrations, cenários e outcomes.

## Rollback

Schemas usam expand/contract; processors novos ficam sob feature flag; filas antigas são drenadas antes do corte; nenhuma coluna/artifact é apagado até backup, comparação e janela de rollback terminarem.
