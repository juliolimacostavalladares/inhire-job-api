# PRD-006 — Autoaplicação segura

Status: aprovado | Prioridade: P1

## Resultado

O backend cria candidaturas automáticas apenas com consentimento, perfil pronto, aderência e quota, reutilizando o mesmo caso de uso e fila da candidatura manual.

## Requisitos

- `AUTO-FR-01`: política desabilitada impede novas avaliações.
- `AUTO-FR-02`: decisão usa versões de Profile, Policy, Job e algoritmo.
- `AUTO-FR-03`: elegibilidade exige vaga publicada, prontidão, preferências, quota e ausência de candidatura.
- `AUTO-FR-04`: score abaixo do mínimo registra rejeição explicável.
- `AUTO-FR-05`: decisão positiva chama `QueueJobApplicationUseCase` com `autoApplied=true`.
- `AUTO-FR-06`: salário, localização, diversidade e consentimento ausentes nunca são inventados.
- `AUTO-FR-07`: quota diária é reservada atomicamente no fuso configurado.
- `AUTO-FR-08`: desabilitar política não cancela candidatura já submetida.
- `AUTO-NFR-01`: scheduler/job repetido não duplica decisão ou candidatura.

## Critérios de aceite

- `AUTO-AC-01`: 21 vagas elegíveis com limite 20 criam exatamente 20 candidaturas.
- `AUTO-AC-02`: workers concorrentes respeitam a mesma quota.
- `AUTO-AC-03`: pergunta obrigatória sem dado encaminha para ação manual.
- `AUTO-AC-04`: decisão registra regras, score e versões.
- `AUTO-AC-05`: fluxo automático usa a mesma prova de submissão do manual.
