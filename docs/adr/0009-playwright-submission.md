# ADR-009 — Playwright isolado atrás de uma porta

Status: aceito

O envio oficial usa Playwright porque o formulário público é a integração disponível. A automação fica no adapter `OfficialApplicationSubmitter`, chamado apenas pelo worker, com contexto isolado, timeout, cleanup e concorrência configurável; sucesso exige resposta oficial e confirmação da página.
