# SDD-002 — Especificação dos módulos

## Auth

Interface interna: `register`, `authenticate`, `refresh`, `revoke`, `getIdentity`. Agregados `User` e `RefreshSession`. Ports: `UsersRepository`, `SessionsRepository`, `PasswordHasher`, `TokenService`, `Clock`. Guards convertem JWT em `AuthContext`; casos de uso recebem actor explícito.

## Candidate Profile

Interface interna: `getProfile`, `updateProfile`, `importProfile`, `assessReadiness`, `prepareApplicationData`. Dono de `CandidateProfile` e source artifact. Import cria registro/tentativa e agenda `profile-analysis`; GET nunca agenda trabalho nem muda status. Snapshot de candidatura contém somente os campos exigidos e versão do perfil.

## Catalog

Interface interna: `listJobs`, `getJob`, `getApplicationForm`, `getApplicationSnapshot`, `upsertTenant`, `upsertJob`, `closeMissingJobs`. Dono de Tenant/Job. `getApplicationSnapshot` retorna `Job.url` sem transformação, estado, texto sanitizado e schema do formulário.

## Acquisition

Interface interna: `createRun`, `discoverTenants`, `collectTenant`, `completeRun`. Dono de CrawlRun/Item/Evidence. Scheduler e rotas Admin criam Run no banco e enfileiram por ID; processors usam clients externos e chamam casos de uso do Catalog.

## Resume

Interface profunda:

```ts
interface ResumeGenerator {
  ensureReady(input: {
    userId: string;
    jobId: string;
    applicationId?: string;
  }): Promise<ResumeArtifact>;
}
```

Esconde readiness, prompt, provider, validação factual, renderização e storage. A fila `resume-generation` chama a mesma interface para pedidos independentes. `TailoredResume`/`ResumeGenerationAttempt` guardam estado e metadados; PDF não fica em base64.

## Applications

Interface interna: `queueApplication`, `processApplication`, `getApplication`, `listApplications`, `retryApplication`. Dono de JobApplication, attempts e receipt. `queueApplication` cria snapshot e agenda `job-application`; `processApplication` coordena Candidate, Catalog/Job snapshot já salvo, Resume e OfficialSubmitter.

## Official InHire Adapter

Porta:

```ts
interface OfficialApplicationSubmitter {
  submit(input: ApplicationPackage): Promise<SubmissionOutcome>;
}
```

O adapter Playwright traduz pacote para formulário, sem decidir regra de candidato/currículo. `SubmissionOutcome` é `SUCCEEDED`, `RETRYABLE_FAILURE`, `PERMANENT_FAILURE`, `MANUAL_ACTION_REQUIRED` ou `OUTCOME_UNKNOWN`.

## Auto Apply

Interface interna: `evaluateCandidate`, `getStatus`, `listDecisions`. Usa repositories/use cases dos módulos donos, aplica regras puras e chama `queueApplication` para decisão positiva. Quota é reservada em transação/constraint; nenhum valor pessoal é inferido.

## Operations

Interface interna: health, metrics, `listRuns`, `getRun`, `retryJob` permitido e reconciliação. Controllers operacionais nunca injetam Prisma diretamente. Bull Board é protegido por ADMIN e não substitui a API de diagnóstico.

## Propriedade de dados

Um Postgres contém todas as tabelas. Cada model Prisma possui módulo dono; acesso cruzado passa por caso de uso/repository explícito. Transações podem envolver tabelas de módulos quando uma invariante exigir atomicidade, documentadas no caso de uso. Não criar repository genérico.
