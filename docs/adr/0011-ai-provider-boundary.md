# ADR-0011 — Provedor de IA Desacoplado com OpenRouter como Padrão

Status: Aceito

## Contexto

O sistema necessita de inteligência artificial em três frentes centrais:
1. **Análise e Extração Factual de Currículos (PDF Parsing & JSON Structuring)**: extração estruturada de atributos do perfil sem inventar fatos (`fullName`, `headline`, `email`, `phone`, `location`, `skills`, `experiences`, `education`).
2. **Matching Inteligente de Vagas com o Perfil do Candidato**: análise semântica da compatibilidade entre descrição de vaga e histórico do usuário.
3. **Geração de Currículo Sob Medida (Tailored Resume)**: geração de resumo e headline ajustados aos requisitos da vaga.

Para manter a arquitetura limpa (Clean Architecture), o domínio e os casos de uso não podem depender de nenhum SDK proprietário ou fazer parsing heurístico amador no código de aplicação. Toda a inteligência de extração e decisão deve ser delegada aos modelos de linguagem através de uma porta abstrata.

## Decisão

1. **Porta Abstrata (`AiProvider` / `ProfileAiExtractor` / `JobProfileAiMatcher`)**:
   - Os casos de uso apenas invocam interfaces limpas da camada de aplicação.
2. **Provedor Padrão: OpenRouter (`OpenRouterAiProvider`)**:
   - O provedor padrão oficial é o **OpenRouter** (`https://openrouter.ai/api/v1`), permitindo alternar de forma transparente entre os melhores modelos de mercado (ex.: `google/gemini-2.0-flash-001`, `deepseek/deepseek-chat`, `meta-llama/llama-3.3-70b-instruct`, `openai/gpt-4o-mini`) apenas via variável de ambiente (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`).
3. **Extrator de IA 100% Estruturado**:
   - O texto extraído do PDF é enviado diretamente ao modelo de IA com schema JSON estrito.
   - O modelo retorna a estrutura pronta e factualmente validada.
   - É proibido o uso de heurísticas manuais de preenchimento ou dados inventados (`CAND-FR-08`).
4. **Provedor Determinístico para Testes Automatizados**:
   - Testes unitários utilizam uma implementação de teste determinística desacoplada, garantindo execução ultrarrápida sem chamadas de rede externas.

## Consequências

- **Flexibilidade Total**: Novos provedores (ex.: OpenAI direto, Anthropic, Ollama local) podem ser adicionados criando uma nova classe na camada de infraestrutura sem alterar nenhuma linha de código de domínio ou caso de uso.
- **Conformidade Factual**: O sistema elimina qualquer heurística frágil e delega a compreensão textual à IA.
