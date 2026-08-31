# PRD-002 — Identidade e perfil do candidato

Status: aprovado | Prioridade: P0

## Resultado

O serviço autentica usuários e mantém dados profissionais suficientes para currículo e candidatura, distinguindo claramente ausência, processamento, revisão e falha real.

## Escopo

Registro, login, sessão, papel, importação/análise de PDF, edição, prontidão e preferências de autoaplicação.

## Requisitos

- `CAND-FR-01`: e-mail normalizado é único; senha é armazenada somente como hash forte.
- `CAND-FR-02`: access token é curto; refresh session é rotativa e revogável.
- `CAND-FR-03`: importação valida MIME/tamanho, guarda o arquivo e enfileira análise.
- `CAND-FR-04`: estados do perfil são `PENDING_IMPORT`, `PROCESSING`, `NEEDS_REVIEW`, `COMPLETE`, `FAILED`.
- `CAND-FR-05`: `FAILED` exige tentativa real; ausência retorna `PROFILE_NOT_STARTED`.
- `CAND-FR-06`: readiness informa campos ausentes para `SUBMISSION` e `TAILORED_RESUME`.
- `CAND-FR-07`: candidatura recebe snapshot imutável dos dados exigidos pelo formulário.
- `CAND-FR-08`: valores sensíveis ou pessoais nunca recebem defaults inventados.
- `CAND-NFR-01`: PII é redigida de logs e protegida em repouso.
- `CAND-NFR-02`: atualizações concorrentes usam versão otimista ou transação equivalente.

## Critérios de aceite

- `CAND-AC-01`: credencial inválida não revela se o e-mail existe.
- `CAND-AC-02`: logout revoga a sessão indicada e reuse de refresh token é detectado.
- `CAND-AC-03`: PDF inválido não chega ao provider de IA.
- `CAND-AC-04`: campo obrigatório ausente bloqueia a finalidade correta com lista objetiva.
- `CAND-AC-05`: repetir a preparação da mesma candidatura produz o mesmo snapshot.
