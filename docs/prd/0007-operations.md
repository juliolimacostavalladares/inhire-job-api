# PRD-007 — Operação e diagnóstico do backend

Status: aprovado | Prioridade: P1

## Resultado

Administradores operam o microserviço por endpoints protegidos, métricas, logs e Bull Board, sem consultar tabelas manualmente.

## Requisitos

- `OPS-FR-01`: expor liveness e readiness de Postgres, Redis, storage e providers obrigatórios.
- `OPS-FR-02`: expor métricas de HTTP, filas, workers, runs, currículo e candidatura.
- `OPS-FR-03`: consultar candidatura retorna estado, attempts e receipt sanitizado.
- `OPS-FR-04`: Admin pode solicitar discovery, collection e retry permitido.
- `OPS-FR-05`: ação administrativa registra actor, motivo, alvo, correlação e resultado.
- `OPS-FR-06`: endpoints operacionais chamam casos de uso; não acessam Prisma em controller.
- `OPS-FR-07`: reconciliador detecta registros enfileiráveis ou presos e recupera com segurança.
- `OPS-NFR-01`: rotas administrativas exigem role `ADMIN` e rate limit.
- `OPS-NFR-02`: alertas disparam para fila parada, job antigo, erro elevado e resultado ambíguo.

## Critérios de aceite

- `OPS-AC-01`: Redis indisponível derruba readiness, mas não corrompe registros no Postgres.
- `OPS-AC-02`: retry de candidatura `SUBMITTED` é recusado.
- `OPS-AC-03`: summary operacional é derivado por use case/repository testável.
- `OPS-AC-04`: respostas e logs não expõem token, senha, PDF ou PII desnecessária.
- `OPS-AC-05`: falha das rotas operacionais não interrompe workers já ativos.
