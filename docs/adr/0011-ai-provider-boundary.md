# ADR-0011 — Provedor de IA Desacoplado com 9Router como Padrão Oficial

Status: Aceito

## Contexto

O sistema necessita de inteligência artificial em três frentes centrais:
1. **Análise e Extração Factual de Currículos (PDF Parsing & JSON Structuring)**: extração estruturada de atributos do perfil sem inventar fatos (`fullName`, `headline`, `email`, `phone`, `location`, `skills`, `experiences`, `education`).
2. **Matching Inteligente de Vagas com o Perfil do Candidato**: análise semântica da compatibilidade entre descrição de vaga e histórico do usuário.
3. **Geração de Currículo Sob Medida (Tailored Resume)**: geração de resumo e headline ajustados aos requisitos da vaga.

Para manter a arquitetura limpa (Clean Architecture), o domínio e os casos de uso não podem depender de nenhum SDK proprietário ou fazer parsing heurístico no código de aplicação. Toda a inteligência de extração e decisão deve ser delegada aos modelos de linguagem através de uma porta abstrata.

## Decisão

1. **Porta Abstrata (`AiProvider` / `ProfileAiExtractor` / `JobProfileAiMatcher`)**:
   - Os casos de uso apenas invocam interfaces limpas da camada de aplicação.
2. **Provedor Padrão: 9Router (`NineRouterAiClient`)**:
   - O gateway padrão oficial é o **9Router** (`http://localhost:20128` ou URL remota/túnel via `NINEROUTER_URL` e `NINEROUTER_KEY`).
   - O 9Router expõe uma API REST compatível com OpenAI (`/v1/chat/completions`) e combos com auto-fallback entre múltiplos provedores (ex.: `bzl/gemini-3.1-flash-lite-preview`, `bzl/kimi-k2.6`, `ollama/glm-4.7-flash`, etc.).
3. **Extrator de IA 100% Estruturado**:
   - O texto extraído do PDF é enviado diretamente ao modelo de IA via 9Router com schema JSON estrito.
   - O modelo retorna a estrutura pronta e factualmente validada.
   - É proibido o uso de heurísticas manuais de preenchimento ou dados inventados (`CAND-FR-08`).
4. **Provedor Determinístico para Testes Automatizados**:
   - Testes unitários utilizam uma implementação determinística desacoplada, garantindo execução ultrarrápida sem chamadas de rede externas.

## Consequências

- **Flexibilidade Total**: Novos modelos e provedores podem ser acionados via 9Router apenas alterando `NINEROUTER_MODEL` ou `NINEROUTER_URL` no `.env`, sem alterar o código de domínio.
- **Conformidade Factual**: O sistema delega a compreensão textual à IA através do gateway 9Router.
