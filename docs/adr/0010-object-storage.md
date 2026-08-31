# ADR-010 — Arquivos em storage S3-compatible

Status: aceito

PDFs e documentos importados ficam em storage S3-compatible; Postgres guarda chave, MIME, tamanho e SHA-256. Isso evita base64 no banco, permite streaming e garante que o arquivo submetido seja verificado pelo checksum.
