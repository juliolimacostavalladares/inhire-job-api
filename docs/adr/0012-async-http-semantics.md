# ADR-012 — HTTP assíncrono representa intenção, não conclusão

Status: aceito

Operações enfileiradas respondem `202 Accepted` com ID, estado e `Location`; `201` fica reservado a criação local concluída. O resultado é consultado pela API. Enfileirar uma candidatura nunca significa que o site oficial confirmou o envio.
