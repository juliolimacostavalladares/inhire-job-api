# ADR-007 — JWT e autorização no limite HTTP

Status: aceito

Auth emite JWT curto assinado com segredo forte e rotacionável; guards validam identidade, papel e ownership antes dos casos de uso. Refresh sessions permanecem revogáveis e armazenam apenas hash do token. Uma migração para assinatura assimétrica só exige trocar o adapter de `TokenService`.
