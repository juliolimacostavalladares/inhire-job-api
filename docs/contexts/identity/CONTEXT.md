# Identity & Access — linguagem do domínio

- **User:** pessoa com uma conta no sistema.
- **Credential:** prova secreta usada para autenticar um User.
- **Role:** conjunto estável de permissões; inicialmente `CANDIDATE` ou `ADMIN`.
- **Access Token:** credencial curta e assinada que identifica User e Role.
- **Refresh Session:** sessão revogável que emite novos Access Tokens.
- **Subject:** identificador imutável do User (`userId`).
- **Revocation:** invalidação explícita de uma Refresh Session.
