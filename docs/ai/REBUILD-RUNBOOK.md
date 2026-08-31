# Runbook de reconstrução por agentes

Objetivo: reconstruir um único microserviço backend com API, workers BullMQ, Postgres, storage, SOLID e Clean Architecture.

## Protocolo

1. Leia `AGENTS.md`, `CONTEXT-MAP.md`, PRD, ADRs, SDD e contratos aplicáveis.
2. Declare requisito e teste antes de editar.
3. Não invente comportamento para preencher lacuna; registre em `OPEN-QUESTIONS.md`.
4. Uma task altera um módulo principal e preserva sua interface.
5. Teste primeiro o comportamento, implemente pela camada correta e guarde evidência.
6. Compilar não é conclusão; o gate vem do SDD-006.

## Layout obrigatório

```text
backend/
  src/modules/<module>/{domain,application,infrastructure,presentation}
  src/shared/{domain,infrastructure}
  src/main.ts
  src/worker.ts
  prisma/
  test/
```

## Ordem

| Ordem | Entrega                                           | Gate                      |
| ----: | ------------------------------------------------- | ------------------------- |
|    01 | toolchain, scripts, CI e config                   | clean install/build       |
|    02 | Postgres, Redis, MinIO e observabilidade local    | readiness                 |
|    03 | shared errors, Clock, IDs, Prisma e BullMQ config | unit/integration          |
|    04 | Auth                                              | CAND-AC-01/02             |
|    05 | Candidate Profile                                 | CAND-AC-03..05            |
|    06 | Catalog                                           | CAT-AC-01..05             |
|    07 | Acquisition                                       | collection parcial segura |
|    08 | Resume                                            | RES-AC-01..05             |
|    09 | Applications                                      | estados/idempotência      |
|    10 | fixture oficial + Playwright adapter              | T-APP-04..08              |
|    11 | Auto Apply                                        | AUTO-AC-01..05            |
|    12 | Operations/reconciler                             | OPS-AC-01..05             |
|    13 | E2E e failure tests                               | PLAT-AC completo          |

## Regras determinísticas

- versões/digests fixos; sem `latest`;
- UTC no banco, locale `pt-BR`, timezone de quota explícito;
- Clock/UUID injetáveis e fixtures com valores fixos;
- JSON canonicalizado antes de checksum;
- testes não dependem de IA externa;
- queue payload apenas com IDs/correlationId;
- jobId conforme `contracts/queue-contracts.md`;
- `Job.url` usada byte a byte.

## Template de task

```markdown
# TASK-<id> — <resultado>

Requisitos: <IDs>
ADRs/SDD: <refs>
Módulo e paths permitidos: <lista>
Interface alterada: <sim/não e contrato>
Invariantes: <lista>
Testes primeiro: <IDs>
Implementação: <passos pequenos>
Verificação: <comandos/evidência>
Rollback: <procedimento>
```

## Anti-padrões bloqueantes

- Prisma em controller/use case;
- regra de negócio em processor;
- módulo importando infrastructure interna de outro;
- chamar a própria API HTTP entre módulos;
- fila com perfil, formData, HTML ou PDF no payload;
- tratar `queue.add` como conclusão;
- construir URL de vaga;
- base64 no banco;
- default inventado para resposta humana;
- fechar browser com promise pendente;
- teste de integração com Redis/Postgres mockado.

## Evidência

Guardar manifest com commit, versões, migration head, hashes de contratos, comandos, suites e resultados. JUnit, E2E trace e receipts devem estar sanitizados.
