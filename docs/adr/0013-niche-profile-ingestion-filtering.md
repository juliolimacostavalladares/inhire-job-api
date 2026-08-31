# ADR-0013 — Filtragem por Nicho Profissional na Ingestão de Vagas

Status: Aceito

## Contexto

A plataforma InHire atende empresas com vagas em diversas áreas (ex.: Logística, Vendas, Operações de Transporte, Atendimento e Almoxarifado).
Para garantir máxima assertividade nas candidaturas automáticas (Auto-Apply) e manuais do usuário, o sistema deve manter um catálogo de alta densidade e relevância, focado exclusivamente no nicho profissional do candidato: **Engenharia de Software, Backend, Arquitetura, Cloud, Tech Lead e Tecnologias de Desenvolvimento (TypeScript, Node.js, Go, Python, Microsserviços)**.

## Decisão

O componente de coleta (`JobCollectorClient`) aplica regras determinísticas de inclusão e exclusão semântica na ingestão:
1. **Regras de Inclusão (Must Match)**: Título e/ou descrição devem conter termos relacionados a desenvolvimento de software, backend, frontend/fullstack, engenharia de dados, infraestrutura/cloud/devops, arquitetura e liderança técnica.
2. **Regras de Exclusão (Exclude)**: Vagas de almoxarifado, operações logísticas de piso, aprendiz de operações, motorista, recepção, vendas externas ou cargos não correlatos são filtradas e descartadas antes do cadastro no Catálogo.
3. **Preservação de Evidência Canônica**: Para cada vaga aprovada no filtro, a URL oficial canônica (`Job.url`) e o formulário oficial continuam sendo rigorosamente preservados byte a byte.

## Consequências

- **Positivas:** O catálogo passa a conter somente vagas de alto valor e aderência direta ao perfil do usuário, otimizando o Auto-Apply e o consumo de IA na geração de currículos sob medida.
- **Governança:** Reduz drasticamente custos de processamento e submissão em vagas irrelevantes.
