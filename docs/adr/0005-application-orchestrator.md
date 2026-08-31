# ADR-005 — Candidatura coordenada por um orquestrador persistente

Status: aceito

Application mantém uma máquina de estados persistente e um processor BullMQ coordena validação, currículo e submissão. Em reinício, o processor retoma pelo estado salvo; estados terminais não regridem e uma tentativa com resultado oficial ambíguo não é repetida automaticamente.
