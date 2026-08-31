# SDD-003 — Fluxo de candidatura

Implementa PRD-005 e ADR-003/005/008/009/012.

## Criação

`POST /v1/jobs/:jobId/applications`:

1. autentica, valida body e `Idempotency-Key`;
2. carrega Job publicado e Candidate Profile;
3. cria `JobApplication` em `QUEUED` com `jobUrl=Job.url`, form schema, respostas, `resumeMode` e snapshots mínimos;
4. commit;
5. enfileira `job-application` com `jobId=application:<applicationId>`;
6. responde `202` com ID, estado e `Location`.

Se o enqueue falhar, o registro continua `QUEUED`; reconciliador tenta novamente. Request repetido devolve a mesma Application.

## Processor

O processor tem concorrência configurável, padrão 1:

1. carrega Application e adquire lock otimista/advisory pelo ID;
2. se terminal, retorna sucesso idempotente sem efeito;
3. muda para `PROCESSING`, incrementa attempt e registra subetapa;
4. valida URL HTTPS/allowlist, snapshots e campos obrigatórios conhecidos;
5. `EXISTING`: valida Artifact/ownership/checksum;
6. `AI_TAILORED`: chama `ResumeGenerator.ensureReady` e aguarda conclusão dentro do job; failure é classificado e persistido;
7. monta `ApplicationPackage` e chama `OfficialApplicationSubmitter.submit`;
8. persiste outcome, receipt/evidence e estado final na mesma transação;
9. libera recursos/lock em `finally`.

## Persistência

`JobApplication`: id, userId, jobId, jobUrl, formData, resumeMode, resumeArtifactId, status, processingStep, attempts, matchScore, autoApplied, errorCode/message, submittedAt, version, timestamps. Unique `(userId,jobId)`.

`ApplicationAttempt`: applicationId, ordinal, startedAt, finishedAt, step, outcome, errorCode, retryAt, evidenceRef. `SubmissionReceipt`: applicationId unique, attemptId, endpoint fingerprint, responseStatus, confirmation fingerprint, artifact SHA-256, externalRequestId?, submittedAt.

## Playwright

1. validar URL e bloquear hosts/IPs não permitidos;
2. abrir context isolado e confirmar vaga/formulário ativo;
3. mapear campos por schema, `name` e label; preencher país antes de cidade/estado;
4. anexar PDF e aguardar confirmação do upload;
5. não preencher campo pessoal ausente com fallback inventado;
6. antes do click, diagnosticar required fields e botão desabilitado;
7. criar `waitForResponse` antes do click; aceitar somente endpoints oficiais permitidos;
8. sucesso requer 2xx e confirmação visual/ID;
9. possível aceite sem confirmação vira `SUBMISSION_OUTCOME_UNKNOWN`, sem retry automático;
10. cancelar/aguardar promises pendentes e fechar context/browser em `finally`.

## Retry

Rede, 429, 5xx e crash antes de qualquer receipt são transitórios. URL inválida e artifact corrompido são permanentes. Vaga encerrada, schema desconhecido, dado obrigatório ausente e outcome ambíguo exigem ação manual. Retry cria nova attempt na mesma Application.
