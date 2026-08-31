# ADR-001 — Um microserviço backend modular

Status: aceito

O sistema será um único microserviço NestJS, implantável sozinho, organizado por módulos de negócio e Clean Architecture. Decomposição distribuída adicional foi rejeitada porque aumentaria coordenação e operação sem necessidade atual; processos API e worker podem escalar separadamente dentro do mesmo produto.
