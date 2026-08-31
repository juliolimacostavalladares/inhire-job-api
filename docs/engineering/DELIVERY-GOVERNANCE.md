# Governança de commits, PRs, code review e merge

Status: obrigatório. Aplica-se a humanos, agentes de IA e automações.

## Princípio de verificabilidade

> **Regra prática:** se o agente ou o revisor humano não consegue dizer se a PR está “pronta” lendo apenas o PRD aplicável e o diff, o PRD está incompleto.

Nesse caso, o revisor não tenta completar a intenção por suposição. A PR volta para `draft`, o PRD recebe problema, escopo, critérios de aceite e casos-limite faltantes, e `TRACEABILITY.md` é atualizado. A revisão recomeça contra a versão corrigida. ADR e SDD ajudam a verificar decisões e execução, mas não substituem um PRD verificável.

## Commits atômicos e semânticos

Cada commit representa uma intenção única, deixa o repositório em estado verificável e não mistura refactor, feature e formatação não relacionada. O formato obrigatório é Conventional Commits:

```text
<type>(<scope opcional>)<! opcional>: <descrição imperativa>

<corpo opcional: por que, contexto, PRD/ADR e evidência>

<footers opcionais>
```

Tipos permitidos:

| Tipo       | Uso                                  | Efeito SemVer quando publicável |
| ---------- | ------------------------------------ | ------------------------------- |
| `feat`     | nova capacidade compatível           | minor                           |
| `fix`      | correção de comportamento            | patch                           |
| `perf`     | melhoria mensurável de desempenho    | patch                           |
| `refactor` | mudança interna sem alterar contrato | nenhum                          |
| `test`     | testes/fixtures                      | nenhum                          |
| `docs`     | documentação/spec                    | nenhum                          |
| `build`    | build/dependências                   | nenhum, salvo breaking          |
| `ci`       | pipelines/gates                      | nenhum                          |
| `chore`    | manutenção que não cabe acima        | nenhum                          |
| `revert`   | reversão explícita                   | conforme mudança revertida      |

Scopes recomendados: `identity`, `candidate`, `catalog`, `acquisition`, `resume`, `application`, `submission`, `auto-apply`, `operations`, `backend`, `contracts`, `infra`, `docs`, `deps`, `ci`.

Regras:

- descrição no imperativo, específica, sem ponto final e cabeçalho com até 100 caracteres;
- comportamento incompatível usa `!` e footer `BREAKING CHANGE:` com migração;
- corpo explica **por que** quando isso não é óbvio pelo diff;
- referenciar IDs como `PRD-005 APP-FR-07`, `ADR-009` e issue/PR quando aplicável;
- não usar “ajustes”, “mudanças”, “fixes”, “WIP” ou “final” sem explicar o resultado;
- não incluir segredo, PII, output bruto ou arquivo gerado acidentalmente;
- não executar commit ou push por agente sem solicitação/autorização explícita do usuário.

Exemplos:

```text
feat(application): wait for tailored resume before submission
fix(submission): preserve canonical job URL during browser attempt
docs(architecture): define queue idempotency and recovery
feat(contracts)!: publish application status schema v2

BREAKING CHANGE: consumers must read terminalCode from statusDetails.
```

## Hooks locais

| Hook         | Comandos                                  | Finalidade                                  |
| ------------ | ----------------------------------------- | ------------------------------------------- |
| `commit-msg` | `commitlint --edit`                       | rejeitar mensagem fora do padrão            |
| `pre-commit` | `lint-staged`, `typecheck`, `lint`        | formatar staged e impedir erro estático     |
| `pre-push`   | checks anteriores, testes backend, builds | impedir envio de uma árvore não verificável |

`lint-staged` altera somente arquivos staged reconhecidos pelo Prettier. Typecheck e lint são completos nos projetos configurados no repositório. Pre-push executa `pnpm run verify:push`. Hook local é feedback rápido; o CI é a autoridade, repete o gate e também valida o título da PR com Commitlint.

## Criação da pull request

1. A branch segue `<type>/<issue>-<slug>`; exemplo `feat/123-application-receipt`.
2. O título da PR segue Conventional Commits e vira o commit final no merge squash.
3. A PR trata uma capacidade/resultado principal. Mudança transversal explica por que não pode ser separada.
4. O autor liga PRD/requisitos, ADRs e SDDs aplicáveis.
5. O corpo descreve comportamento antes/depois, riscos, migração/rollback e evidência.
6. Contratos alterados incluem compatibilidade, versão e consumer impact; banco inclui migration e rollback.
7. Evidência do backend deve ser teste, trace, payload/receipt sanitizado ou demo reproduzível.
8. PR sem evidência ou com especificação ambígua permanece `draft`.

Alvo recomendado: até 400 linhas alteradas revisáveis, excluindo lockfiles, schemas gerados e migrations. Acima disso, justificar ou dividir por commits/PRs independentes.

## Processo de code review

O review acontece em duas dimensões explícitas:

### 1. Spec

- O diff resolve o problema e os critérios do PRD?
- Todo comportamento observável está coberto por requisito?
- Edge cases, estados e erros têm semântica correta?
- Contratos e rastreabilidade foram atualizados?

Se PRD + diff não permitirem concluir prontidão, o finding é **PRD incompleto**, bloqueante.

### 2. Standards

- O diff respeita `AGENTS.md`, context boundaries, ADRs aceitos e SDD?
- A regra está no serviço dono e atrás da interface adequada?
- Há Prisma fora de Infrastructure, URL reconstruída, default inventado, PII ou regra em controller/processor?
- Idempotência, concorrência, retries, segurança e observabilidade foram tratados?
- Testes provam o comportamento no nível correto, sem mocks que eliminem a integração sob teste?

### Severidade

- `P0`: segurança, perda/corrupção de dados, submissão duplicada; bloqueia imediatamente.
- `P1`: viola PRD/ADR, contrato ou regra central; bloqueia merge.
- `P2`: risco real de manutenção/correção sem quebra imediata; corrigir ou abrir follow-up aceito.
- `P3`: sugestão não bloqueante.

Review deve citar arquivo/linha, requisito ou ADR violado, cenário concreto e correção esperada. Preferência pessoal sem efeito verificável não bloqueia.

## Antes de mergear

- [ ] O diff atende o PRD?
- [ ] Não viola ADRs aceitos?
- [ ] Há evidência — teste, trace ou demo — de que a spec foi cumprida?
- [ ] PRD + diff são suficientes para decidir objetivamente que a PR está pronta?
- [ ] SDD, contratos e rastreabilidade refletem o comportamento entregue?
- [ ] CI obrigatório passou sem skips ou overrides?
- [ ] Findings P0/P1 foram resolvidos e P2 pendentes possuem owner/issue?
- [ ] Migração e rollback foram testados quando aplicáveis?
- [ ] Evidências e logs estão sanitizados, sem segredo ou PII?

## Merge e proteção de branch

- método padrão: **Squash and merge**; título da PR deve ser Conventional Commit válido;
- branch precisa estar atualizada com a base e todas as conversas resolvidas;
- exigir pelo menos uma aprovação; duas para auth, segurança, PII, contratos breaking ou submissão oficial;
- exigir o status check `quality-gates` e bloquear force push/deleção da branch principal;
- não permitir merge administrativo que ignore checks, exceto incidente formal com registro, owner e correção posterior;
- tags/releases derivam de commits semânticos; breaking change exige plano de migração e comunicação.

## Responsabilidade do autor

O autor — humano ou agente — entrega a prova, não transfere ao revisor a tarefa de descobrir a intenção. O revisor valida a prova contra PRD/ADR/SDD; passar nos testes sem cumprir a spec não torna a PR pronta.
