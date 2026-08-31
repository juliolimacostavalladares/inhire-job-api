# ADR-008 — Catalog é dono da URL oficial da vaga

Status: aceito

`Job.url` persiste a URL oficial observada na InHire. Ao criar a candidatura, Application copia essa string para `JobApplication.jobUrl`, e Submission usa somente a cópia validada; reconstruir URL por slug, título ou ID é proibido porque já causou acesso à página incorreta.
