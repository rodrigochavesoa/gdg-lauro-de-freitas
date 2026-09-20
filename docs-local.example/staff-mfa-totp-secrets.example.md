# Secrets TOTP staff — harness SEC-STAFF-MFA-02 (modelo)

Copie para `docs-local/staff-mfa-totp-secrets.md` (gitignored).

Preencher **após** enroll de cada conta staff (chave **manual** exibida na `/admin` no enroll — o Supabase **não** mostra essa chave de novo no Dashboard).

**Alternativa (recomendada para CI):** variáveis `ADMIN_TEST_TOTP_SECRET`, `CURATOR_TEST_TOTP_SECRET`, `CURATOR2_TEST_TOTP_SECRET`, `CURATOR3_TEST_TOTP_SECRET`, `MODERATOR_TEST_TOTP_SECRET` no `.env.local` **e** no GitHub Environment `homolog-rls`. Nunca prefixo `VITE_`.

**Precedência no harness:** se `*_TEST_TOTP_SECRET` existir no `.env.local`, o arquivo abaixo é **ignorado** para aquele papel. Mantenha env e tabela alinhados ou deixe a tabela vazia e use só env.

| Conta | E-mail (ref.) | TOTP secret (base32) | Enroll em |
|---|---|---|---|
| admin | _seu-admin-homolog@..._ | _colar base32 sem espaços_ | YYYY-MM-DD |
| curator | | | |
| curator2 | | | |
| curator3 | | | |
| moderator | | | |

Candidato: fora do escopo MFA staff.

Ver também: `rls-homolog-auth-troubleshooting.example.md` → cópia local.
