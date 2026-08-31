# Especificação do microserviço InHire Backend

Este diretório é a fonte de verdade de um único backend NestJS, autônomo e implantável isoladamente. A arquitetura usa API REST, Postgres, Redis/BullMQ para tarefas demoradas, SOLID e Clean Architecture.

## Ordem de leitura

1. [`CONTEXT-MAP.md`](../../CONTEXT-MAP.md)
2. [`prd/0001-platform.md`](prd/0001-platform.md)
3. PRD da capacidade
4. ADRs aplicáveis
5. SDD e contratos
6. [`TRACEABILITY.md`](TRACEABILITY.md)
7. [`ai/REBUILD-RUNBOOK.md`](ai/REBUILD-RUNBOOK.md)

Regras de entrega: [`engineering/DELIVERY-GOVERNANCE.md`](engineering/DELIVERY-GOVERNANCE.md).

## PRDs

| Documento                  | Resultado                        |
| -------------------------- | -------------------------------- |
| `0001-platform`            | microserviço backend autônomo    |
| `0002-identity-candidate`  | conta, perfil e prontidão        |
| `0003-catalog-acquisition` | catálogo e coleta confiáveis     |
| `0004-resume`              | currículo sob medida verificável |
| `0005-application`         | candidatura oficial coordenada   |
| `0006-auto-apply`          | autoaplicação segura             |
| `0007-operations`          | operação e diagnóstico           |

## Decisões e desenho

- `adr/`: modularização, Postgres, BullMQ, idempotência, interfaces, autenticação, Playwright, artifacts e IA.
- `sdd/`: estrutura, módulos, candidatura, filas, segurança, testes e reconstrução.
- `contracts/http-api.md`: interface REST.
- `contracts/queue-contracts.md`: filas, payloads, job IDs e outcomes.
- `contracts/error-catalog.md`: códigos estáveis.
- `OPEN-QUESTIONS.md`: defaults ainda sujeitos a decisão de produção.

## Precedência

Contrato versionado > ADR aceito > SDD > PRD > código anterior. Conflito deve ser corrigido, nunca resolvido por suposição.

## Definição global de pronto

- PRD + diff permitem concluir objetivamente se a mudança está pronta;
- critérios de aceite estão ligados a testes;
- código respeita módulos, SOLID e Clean Architecture;
- API/queue contracts e migrations estão compatíveis;
- jobs são idempotentes e possuem recuperação;
- logs/traces não contêm PII;
- typecheck, lint, testes e build passaram.
