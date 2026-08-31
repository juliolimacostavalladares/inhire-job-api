# PRD-003 — Aquisição e catálogo de vagas

Status: aprovado | Prioridade: P0

## Resultado

O serviço descobre tenants, coleta vagas e mantém um catálogo confiável. `Job.url` é a fonte interna única da página oficial.

## Requisitos

- `CAT-FR-01`: Tenant é único por slug; Job por `(tenantId, externalId)`.
- `CAT-FR-02`: discovery e collection executam em filas com runs e itens persistidos.
- `CAT-FR-03`: coleta normaliza dados, sanitiza HTML e atualiza o Catalog por caso de uso.
- `CAT-FR-04`: `Job.url` deve ser HTTPS em `*.inhire.app` e vir da fonte oficial.
- `CAT-FR-05`: nenhum consumidor reconstrói URL por slug, título ou ID.
- `CAT-FR-06`: somente coleta conclusiva fecha vagas não observadas.
- `CAT-FR-07`: application form mantém chave, label, tipo, opções e obrigatoriedade.
- `CAT-FR-08`: runs guardam trigger, status, contadores, itens e erro sanitizado.
- `CAT-NFR-01`: repetir coleta/upsert não duplica Tenant ou Job.
- `CAT-NFR-02`: consultas paginadas têm p95 abaixo de 250 ms para 100 itens.

## Critérios de aceite

- `CAT-AC-01`: a URL armazenada é devolvida byte a byte.
- `CAT-AC-02`: alterar título não altera `Job.url`.
- `CAT-AC-03`: coleta parcial não fecha vagas sem evidência.
- `CAT-AC-04`: execução repetida mantém os mesmos registros e contadores corretos.
- `CAT-AC-05`: Tenant inativo não recebe coleta agendada e mantém histórico.
