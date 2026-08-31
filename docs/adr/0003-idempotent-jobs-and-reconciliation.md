# ADR-003 — Jobs idempotentes com reconciliação pelo banco

Status: aceito

Postgres é a fonte de verdade do estado; BullMQ é o mecanismo de execução. Cada job usa `jobId` determinístico, processors verificam o estado antes do efeito e constraints impedem duplicatas. Como salvar e enfileirar não é uma transação única, um reconciliador busca registros `QUEUED` sem execução e os enfileira novamente.
