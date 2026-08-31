# ADR-002 — BullMQ para trabalhos assíncronos

Status: aceito

Redis/BullMQ será usado apenas para tarefas lentas, reprocessáveis ou com concorrência controlada: descoberta, coleta, análise de perfil, geração de currículo, autoaplicação e submissão Playwright. Filas não substituem regras de negócio nem integração entre módulos; controllers e processors chamam os mesmos casos de uso.
