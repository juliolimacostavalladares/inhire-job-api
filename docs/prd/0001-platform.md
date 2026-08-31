# PRD-001 — Microserviço backend autônomo

Status: aprovado | Prioridade: P0

## Problema

O backend precisa executar cadastro, catálogo, geração de currículo e candidatura oficial com contratos próprios, estados confiáveis e processamento assíncrono controlado. A arquitetura deve ser simples de operar, testável e reconstruível a partir desta documentação.

## Usuários

- Candidate: cria perfil, consulta vagas e solicita candidatura.
- Administrator: gerencia tenants, runs e falhas operacionais.
- API Client: integra por HTTP documentado.
- Engineering Agent: implementa e verifica o serviço contra PRDs, ADRs e SDDs.

## Objetivos

- entregar um único serviço NestJS isolado e implantável;
- organizar o código por módulos, SOLID e Clean Architecture;
- usar Postgres como fonte de verdade e BullMQ apenas para trabalho demorado;
- tornar candidatura, currículo e coleta idempotentes e observáveis;
- permitir reconstrução determinística com contratos e testes.

## Fora de escopo

- decomposição em vários microserviços;
- infraestrutura distribuída adicional para comunicação interna;
- execução síncrona de IA, crawling ou navegador em request HTTP;
- integração com outros sites de recrutamento.

## Requisitos

- `PLAT-FR-01`: o serviço deve expor API HTTP versionada e workers BullMQ.
- `PLAT-FR-02`: módulos devem acessar regras por casos de uso e interfaces internas.
- `PLAT-FR-03`: operação longa deve criar registro consultável antes de enfileirar.
- `PLAT-FR-04`: API e workers devem compartilhar domínio e casos de uso, sem duplicar regra.
- `PLAT-FR-05`: configuração deve ser validada no boot e não conter segredo no repositório.
- `PLAT-NFR-01`: jobs são idempotentes, reprocessáveis e reconciliáveis pelo estado no Postgres.
- `PLAT-NFR-02`: disponibilidade mensal alvo da API 99,9% e workers 99,5%.
- `PLAT-NFR-03`: p95 de comandos HTTP rápidos abaixo de 300 ms, sem contar integrações externas.
- `PLAT-NFR-04`: logs e traces usam `correlationId` e não contêm PII.
- `PLAT-NFR-05`: RPO 5 minutos e RTO 60 minutos.

## Critérios de aceite

- `PLAT-AC-01`: API continua respondendo consultas se um worker estiver parado.
- `PLAT-AC-02`: executar o mesmo job dez vezes produz um único efeito de negócio.
- `PLAT-AC-03`: uma candidatura pode ser explicada do request ao receipt por timeline e correlação.
- `PLAT-AC-04`: regras de domínio são testadas sem NestJS, Prisma, Redis ou rede.
- `PLAT-AC-05`: ambiente vazio é criado pelo runbook e passa todos os gates.

## Métricas

Latência/erro HTTP, profundidade e idade das filas, duração por job, taxa de retry, registros presos e cobertura de requisitos.
