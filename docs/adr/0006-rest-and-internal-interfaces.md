# ADR-006 — REST externamente e interfaces de casos de uso internamente

Status: aceito

A interface pública é HTTP REST versionada. Módulos internos não chamam a própria API: dependem de interfaces pequenas na camada de aplicação e recebem adapters por injeção. Isso preserva SOLID, testabilidade e baixo custo operacional.
