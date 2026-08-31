# InHire Backend — regras para agentes

Este repositório usa desenvolvimento orientado a especificação. Antes de alterar o backend, leia nesta ordem:

1. `CONTEXT-MAP.md`;
2. `backend/docs/README.md`;
3. o `CONTEXT.md` do contexto alterado;
4. o PRD aplicável;
5. todos os ADRs aceitos citados pelo SDD;
6. o SDD e os contratos aplicáveis;
7. `backend/docs/TRACEABILITY.md`.

## Fonte de verdade

- PRD define problema, escopo e aceite.
- ADR define decisões caras de reverter. Um agente não pode contrariar um ADR aceito silenciosamente.
- SDD define contratos, estados, tarefas e evidências de verificação.
- Os contratos HTTP, de filas e de erros definem as interfaces externas/técnicas. Código e testes devem derivar deles.

## Regras obrigatórias

- O produto é um único microserviço backend com módulos internos em Clean Architecture.
- Cada módulo é dono lógico de suas tabelas e expõe casos de uso/interfaces pequenas; controllers e processors não acessam Prisma diretamente.
- Módulos internos não chamam a própria API HTTP; integração interna ocorre por interfaces da camada de aplicação.
- Postgres é a fonte de verdade. BullMQ executa apenas trabalhos lentos usando payloads mínimos por ID.
- Todo job precisa de `jobId` determinístico e `correlationId`; processors são idempotentes e reentrantes.
- Reprocessar o mesmo job não pode duplicar candidatura, currículo ou submissão.
- A URL oficial da vaga vem do Catálogo e é copiada como snapshot imutável para a candidatura. É proibido reconstruí-la por slug, título ou ID.
- Dados pessoais não aparecem em logs, métricas, traces, mensagens de erro ou payloads de fila.
- Binários ficam em storage S3-compatible; banco e filas guardam apenas chave, checksum e metadados.
- Automação Playwright só acessa hosts permitidos `*.inhire.app`, usa a URL do snapshot e comprova sucesso por resposta oficial e estado final da página.
- Sem `any`, dependências de infraestrutura atrás de portas e testes em todos os níveis exigidos pela matriz.

## Fluxo de mudança

1. Localize o requisito na rastreabilidade.
2. Escreva ou ajuste o teste de contrato/aceite antes da implementação.
3. Implemente a menor mudança no módulo dono da regra.
4. Verifique unitários, integração, contrato, componente e E2E aplicáveis.
5. Atualize contrato, ADR/SDD e rastreabilidade no mesmo change set se o comportamento mudou.

Não marque uma tarefa como concluída sem registrar os comandos executados e a evidência exigida pelo SDD de testes.

## Commits, PRs e review

- Siga `CONTRIBUTING.md` e `backend/docs/engineering/DELIVERY-GOVERNANCE.md`.
- Não crie commit, push ou PR sem solicitação/autorização explícita do usuário.
- Quando autorizado, use commits atômicos no formato Conventional Commits; commit-msg é validado por Commitlint.
- Nunca contorne Husky/CI com `--no-verify`, skip ou alteração oportunista dos gates.
- Antes do merge, compare o diff com PRD, ADRs aceitos, SDD e evidências.
- Se PRD + diff não permitem dizer objetivamente que a PR está pronta, o PRD está incompleto: interrompa o review e corrija a especificação antes de continuar.
