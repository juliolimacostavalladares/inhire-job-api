# ADR-004 — Um Postgres com propriedade lógica por módulo

Status: aceito

O microserviço usa um único banco e um único schema Prisma para transações simples e operação previsível. Cada tabela tem um módulo dono e só é acessada por seu repositório/caso de uso; joins necessários são permitidos na infraestrutura, mas controllers e regras de domínio não dependem de Prisma.
