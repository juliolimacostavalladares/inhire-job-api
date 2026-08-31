# SDD-006 — Estratégia de testes

## Níveis

1. **Domain/unitário:** invariantes, estados, readiness, matching, mapping e classificação; sem framework/I/O.
2. **Use case:** ports fake; sucesso, falha, idempotência e concorrência.
3. **Repository/integration:** Postgres real via Testcontainers, migrations e constraints.
4. **Queue integration:** Redis/BullMQ real, jobId, retry, stalled e reconciliação.
5. **HTTP component:** Nest app + Supertest, auth, validation, error contract e persistência.
6. **Browser component:** InHire fixture local + Playwright real.
7. **E2E backend:** API -> Postgres -> BullMQ -> worker -> fixture/storage -> estado final.
8. **Smoke externo:** opt-in e destino autorizado; nunca no CI padrão.

Mock que verifica somente `queue.add` não prova processamento. Teste de integração de fila usa Redis real e aguarda o estado persistido.

## Regressão mínima

| ID         | Cenário                                        | Evidência                                 |
| ---------- | ---------------------------------------------- | ----------------------------------------- |
| T-APP-01   | candidatura com currículo existente            | receipt + checksum + SUBMITTED            |
| T-APP-02   | currículo IA ausente é gerado antes do browser | step GENERATING_RESUME precede SUBMITTING |
| T-APP-03   | consultar vaga sem currículo                   | RESUME_NOT_STARTED, sem FAILED/job        |
| T-APP-04   | URL armazenada usada byte a byte               | URL capturada na fixture                  |
| T-APP-05   | botão desabilitado                             | código/fields específicos e worker vivo   |
| T-APP-06   | browser fecha durante response wait            | sem unhandled rejection                   |
| T-APP-07   | 2xx + confirmação                              | SUBMITTED e receipt                       |
| T-APP-08   | 2xx sem confirmação                            | OUTCOME_UNKNOWN e sem retry               |
| T-IDEM-01  | mesmo job 10 vezes                             | um efeito/receipt                         |
| T-QUEUE-01 | commit sem enqueue                             | reconciliador enfileira                   |
| T-QUEUE-02 | dois workers na mesma Application              | uma attempt ativa/submissão               |
| T-AUTO-01  | quota concorrente                              | limite exato                              |
| T-AUTO-02  | dado pessoal ausente                           | nenhum default inventado                  |
| T-CAT-01   | coleta parcial                                 | nenhuma vaga fechada                      |
| T-SEC-01   | URL privada/host falso                         | bloqueio antes do browser                 |
| T-SEC-02   | scanner de logs                                | zero segredo/PII                          |

## Gates

Commit: formatting staged, typecheck e lint. Push/CI: checks anteriores, unitários/integration disponíveis e build. PR P0: componente/E2E aplicável, migration dry-run e evidência ligada ao critério. Release: smoke interno, restore/rollback e observabilidade.

Meta: 100% das transições/invariantes críticas e todo requisito P0 ligado a teste; cobertura global orientativa 85% lines/80% branches.
