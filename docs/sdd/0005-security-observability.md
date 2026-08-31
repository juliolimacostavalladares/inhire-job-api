# SDD-005 — Segurança e observabilidade

## Ameaças

Account takeover, SSRF por URL de vaga, vazamento de perfil/currículo, prompt injection na descrição, upload malicioso, job replay, abuso de rota Admin e automação externa duplicada.

## Controles

- JWT/refresh conforme ADR-007; RBAC e ownership em controllers/guards e use cases;
- `Idempotency-Key` vinculado a actor+route+body hash; conflito retorna `409`;
- URL InHire validada em criação e execução, com bloqueio de loopback/link-local/redes privadas;
- upload por magic bytes, PDF, até 10 MiB, checksum e malware scan;
- HTML sanitizado; texto de vaga é dado não confiável para IA;
- secrets no ambiente/manager; Postgres, Redis e storage sem exposição pública;
- filas contêm somente IDs; formData/PII não aparece em payload de job;
- rotas Admin exigem role, rate limit e audit;
- logs, traces, screenshots e receipts são sanitizados.

## Logs e tracing

JSON com timestamp, level, process (`api|worker`), module, traceId, correlationId, jobId, resourceId, operation, outcome, durationMs e errorCode. Nunca registrar senha, token, cookie, PDF/base64, prompt completo, e-mail, telefone, endereço ou respostas do formulário.

HTTP cria/propaga `X-Correlation-Id`; ao enfileirar, copia para job options/data técnica. Processor inicia span ligado à correlação e cria spans para DB, provider, storage e browser.

## Métricas

HTTP count/duration/status; Redis/DB readiness; queue waiting/active/failed/stalled/oldest; duração e outcome por job; Application por estado/step; submission por outcome; IA por attempts/duração/tokens; reconciliations e records stuck.

Alertas: failed jobs > 0 por 5 min, oldest waiting acima do SLO, stalled job, Application além do timeout, `OUTCOME_UNKNOWN` > 0, readiness falha e 5xx > 2%/10 min.

## Retenção

Audit/receipt 1 ano, evidência visual sanitizada 30 dias, logs 30 dias, traces 7 dias, failed jobs 30 dias. Valores de produção dependem de validação de privacidade.
