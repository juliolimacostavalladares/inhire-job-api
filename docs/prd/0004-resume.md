# PRD-004 — Currículo sob medida

Status: aprovado | Prioridade: P0

## Resultado

Quando solicitado, o serviço gera conteúdo factual e PDF válido antes da candidatura. Ausência sem solicitação significa `NOT_STARTED`, não falha.

## Requisitos

- `RES-FR-01`: geração é única por `(userId, jobId, profileVersion, jobVersion, templateVersion)`.
- `RES-FR-02`: request HTTP ou candidatura enfileira geração com `jobId` determinístico.
- `RES-FR-03`: worker valida prontidão antes de chamar IA.
- `RES-FR-04`: saída da IA segue schema e não adiciona fatos ausentes do perfil.
- `RES-FR-05`: PDF deve ter MIME correto, bytes não vazios, checksum e artifact ID.
- `RES-FR-06`: estados são `REQUESTED`, `GENERATING`, `RENDERING`, `READY`, `FAILED`.
- `RES-FR-07`: arquivos ficam no object storage; banco e filas guardam referência.
- `RES-FR-08`: `FAILED` só é gravado após tentativa; GET sem pedido retorna `RESUME_NOT_STARTED`.
- `RES-NFR-01`: timeout padrão 120 s e até 3 tentativas para erro transitório.
- `RES-NFR-02`: download exige ownership e streaming/URL assinada curta.

## Critérios de aceite

- `RES-AC-01`: candidatura `AI_TAILORED` não submete antes de `READY`.
- `RES-AC-02`: dez jobs iguais criam um currículo lógico.
- `RES-AC-03`: falha do provider registra tentativa sem apagar artefato pronto anterior.
- `RES-AC-04`: experiência inventada reprova a geração.
- `RES-AC-05`: checksum recuperado coincide com o PDF submetido.
