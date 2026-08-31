# ADR-0013 — Filtragem Dinâmica de Vagas pelo Perfil Profissional do Candidato

Status: Aceito

## Contexto

A plataforma InHire agrega vagas de empresas em múltiplos departamentos e segmentos (ex.: Operações, Logística, Vendas, Design, Engenharia, Atendimento).
Para que o sistema seja verdadeiramente personalizado, inteligente e livre de hardcodes estáticos no código-fonte, a seleção de vagas a serem persistidas no Catálogo deve ser **dinâmica e derivada diretamente do Perfil Profissional do Candidato** (`CandidateProfile.headline`, `CandidateProfile.skills`, `CandidateProfile.experiences` e `AutoApplyPolicy.targetRoles`).

## Decisão

1. **Ingestão Dinâmica Baseada em Perfil (`Profile-Driven Ingestion`)**:
   - O `JobCollectorClient` coleta os dados brutos oficiais dos Tenants na InHire.
   - O caso de uso `ProcessJobCollectionUseCase` avalia a aderência de cada vaga contra o perfil profissional ativo do usuário.
   - Uma vaga é aprovada e persistida no Catálogo se e somente se possuir correlação semântica positiva com os atributos do perfil do candidato (título/cargo compatível com a headline/targetRoles ou habilidades/skills demandadas no texto da vaga).
2. **Sem Hardcode de Cargos ou Tecnologias**:
   - É proibido chumbar listas fixas de tecnologias ou áreas no código. O nicho é determinado 100% pelos dados dinâmicos do perfil do candidato cadastrado no banco.
3. **Preservação Canônica e Idempotência**:
   - Vagas aprovadas mantêm a URL canônica oficial e o esquema de formulário intactos.
   - Re-execuções são idempotentes e garantem que o catálogo reflita a qualquer momento o estado atual do perfil do candidato.

## Consequências

- **Positivas:** Máxima flexibilidade e personalização. Qualquer candidato (seja Desenvolvedor, Product Manager, Designer, Arquiteto, QA ou Cientista de Dados) terá um catálogo personalizado e perfeitamente ajustado ao seu perfil.
- **Governança:** Elimina ruídos no banco de dados e otimiza o pipeline de Auto-Apply e geração de currículos sob medida por IA.
