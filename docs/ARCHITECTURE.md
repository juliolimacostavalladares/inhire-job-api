# Clean Architecture — InHire Backend

## Forma do sistema

Um microserviço NestJS com dois entrypoints: API HTTP (`main.ts`) e worker BullMQ (`worker.ts`). Ambos usam o mesmo domínio, casos de uso, Postgres e adapters configurados por injeção.

## Camadas por módulo

```text
modules/<module>/
  domain/          entidades, value objects e invariantes
  application/     casos de uso, DTOs internos e ports
  infrastructure/  Prisma repositories, providers e processors
  presentation/    controllers, DTOs HTTP e guards
```

Dependências apontam para dentro:

```text
Presentation -> Application -> Domain
Infrastructure -> Application -> Domain
```

## Regras obrigatórias

- Domain não importa framework ou I/O.
- Application não importa Prisma, BullMQ, Playwright, Axios ou provider concreto.
- Controller e processor não contêm regra; chamam casos de uso.
- Prisma aparece somente em Infrastructure repositories/transaction adapters.
- Integração interna ocorre por interfaces/casos de uso, não por HTTP.
- Cada módulo é dono lógico de suas tabelas e expõe uma interface pequena.
- SOLID: responsabilidade única, extensão por adapters, contratos substituíveis, interfaces específicas e inversão de dependência.
- Não criar abstração sem variação real; interfaces devem esconder complexidade e ser a superfície de teste.
- Todo caso de uso e processor possui testes proporcionais ao risco.
- IA usa `AiProvider`; submissão usa `OfficialApplicationSubmitter`; arquivos usam `ArtifactStorage`.
