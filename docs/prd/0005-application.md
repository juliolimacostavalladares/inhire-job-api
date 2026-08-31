# PRD-005 — Candidatura oficial

Status: aprovado | Prioridade: P0

## Resultado

O serviço recebe uma intenção, prepara dados e currículo, preenche o formulário público da InHire e só confirma `SUBMITTED` com evidência verificável.

## Requisitos

- `APP-FR-01`: request cria `JobApplication`, enfileira processamento e retorna `202`, nunca sucesso externo.
- `APP-FR-02`: idempotency key e constraint `(userId,jobId)` impedem duplicata.
- `APP-FR-03`: Application copia `Job.url`, form schema e dados do candidato para snapshots.
- `APP-FR-04`: o worker usa exatamente `JobApplication.jobUrl`.
- `APP-FR-05`: modo `AI_TAILORED` gera/aguarda currículo; `EXISTING` valida artifact informado.
- `APP-FR-06`: Playwright preenche campos obrigatórios, anexa o PDF correto e respeita respostas fornecidas.
- `APP-FR-07`: `SUBMITTED` exige resposta HTTP 2xx oficial e confirmação de página/identificador externo.
- `APP-FR-08`: vaga encerrada, campo ausente, botão desabilitado ou confirmação ambígua gera código específico.
- `APP-FR-09`: erro transitório pode repetir; erro permanente/manual não é reenviado automaticamente.
- `APP-FR-10`: navegador e waits são encerrados sem promise órfã ou crash do worker.
- `APP-NFR-01`: concorrência padrão 1 por worker e limite configurável.
- `APP-NFR-02`: timeout total padrão 180 s; estado permanece consultável após reinício.

## Estados

`QUEUED -> PROCESSING -> SUBMITTED | REQUIRES_MANUAL_ACTION | FAILED`. `PROCESSING` pode registrar subetapa `PREPARING_DATA`, `GENERATING_RESUME` ou `SUBMITTING` sem ampliar a interface pública inicial.

## Critérios de aceite

- `APP-AC-01`: navegador recebe a URL armazenada sem transformação.
- `APP-AC-02`: botão desabilitado informa campos impeditivos, não timeout genérico.
- `APP-AC-03`: job duplicado/reinício não produz segunda submissão após receipt.
- `APP-AC-04`: fechar browser durante wait não gera rejection não tratada.
- `APP-AC-05`: erro de currículo só aparece depois de tentativa real.
- `APP-AC-06`: E2E controlado prova payload, arquivo e estado final.
