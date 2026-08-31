# Matriz de rastreabilidade

## Plataforma

| Requisito               | Design                   | Evidência                         |
| ----------------------- | ------------------------ | --------------------------------- |
| PLAT-FR-01/03           | ADR-002/012; SDD-001/004 | HTTP + Redis queue integration    |
| PLAT-FR-02/04           | ADR-001/006; SDD-001/002 | architecture dependency tests     |
| PLAT-FR-05              | SDD-001/005              | config boot tests                 |
| PLAT-NFR-01, PLAT-AC-02 | ADR-003; SDD-004         | T-IDEM-01/T-QUEUE-01/02           |
| PLAT-NFR-02..05         | SDD-005                  | load, trace, backup/restore       |
| PLAT-AC-01/03/04/05     | SDD-001/006/007          | isolation, E2E e rebuild manifest |

## Identity e Candidate

| Requisito         | Design           | Evidência                      |
| ----------------- | ---------------- | ------------------------------ |
| CAND-FR-01/02     | ADR-007; SDD-002 | CAND-AC-01/02                  |
| CAND-FR-03..05    | ADR-002/010/011  | CAND-AC-03 + not-started tests |
| CAND-FR-06/07     | SDD-002/003      | CAND-AC-04/05                  |
| CAND-FR-08/NFR-01 | ADR-011; SDD-005 | T-AUTO-02/T-SEC-02             |
| CAND-NFR-02       | ADR-004          | concurrency integration        |

## Catalog e Acquisition

| Requisito     | Design                   | Evidência                      |
| ------------- | ------------------------ | ------------------------------ |
| CAT-FR-01..03 | ADR-002/004; SDD-002/004 | repository + queue integration |
| CAT-FR-04/05  | ADR-008                  | CAT-AC-01/02, T-APP-04         |
| CAT-FR-06     | SDD-002                  | CAT-AC-03, T-CAT-01            |
| CAT-FR-07/08  | HTTP/queue contracts     | schema/run tests               |
| CAT-NFR-01/02 | ADR-003                  | CAT-AC-04 + load test          |

## Resume

| Requisito     | Design        | Evidência                      |
| ------------- | ------------- | ------------------------------ |
| RES-FR-01/02  | ADR-002/003   | RES-AC-02                      |
| RES-FR-03/04  | ADR-011       | RES-AC-04                      |
| RES-FR-05/07  | ADR-010       | RES-AC-05                      |
| RES-FR-06/08  | error catalog | RES-AC-03, T-APP-02/03         |
| RES-NFR-01/02 | SDD-004/005   | retry + artifact authorization |

## Applications

| Requisito     | Design               | Evidência                 |
| ------------- | -------------------- | ------------------------- |
| APP-FR-01/02  | ADR-003/012          | API contract + T-IDEM-01  |
| APP-FR-03..05 | ADR-005/008; SDD-003 | T-APP-02/04               |
| APP-FR-06/07  | ADR-009              | T-APP-01/07               |
| APP-FR-08     | error catalog        | T-APP-05/08               |
| APP-FR-09/10  | SDD-003/004          | T-APP-06 + retry tests    |
| APP-NFR-01/02 | SDD-003/004          | concurrency/restart tests |

## Auto Apply e Operations

| Requisito         | Design               | Evidência                        |
| ----------------- | -------------------- | -------------------------------- |
| AUTO-FR-01..05    | SDD-002              | AUTO-AC-01/04/05                 |
| AUTO-FR-06        | ADR-011              | AUTO-AC-03/T-AUTO-02             |
| AUTO-FR-07/NFR-01 | ADR-003/004          | T-AUTO-01/AUTO-AC-02             |
| OPS-FR-01..03     | SDD-002/005          | health/metrics/application query |
| OPS-FR-04..07     | ADR-003/006; SDD-004 | OPS-AC-01..03                    |
| OPS-NFR-01/02     | ADR-007; SDD-005     | OPS-AC-04/05 + alert tests       |

Novo requisito recebe ID, aceite, design e teste antes de implementação. Requisito P0 sem evidência bloqueia release.
