# Setup — GDGJobs (MVP)

Ambiente local para clonar, instalar e rodar o laboratório. Use **PowerShell (`pwsh`)** no Windows.

Este arquivo trata apenas de execução, configuração e operação segura. Para entender o produto e suas jornadas, leia [`ABOUT.md`](ABOUT.md); para arquitetura e contratos, leia [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md).

## Requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | **22** |
| pnpm | **10.30.1** (`packageManager` em `package.json`) |

## Variáveis de ambiente

O frontend lê **um** projeto Supabase por build. Nomes das variáveis estão em [`.env.example`](.env.example) — **sem valores**.

| Destino | Projeto Supabase | Seed fictício |
|---|---|---|
| `pnpm dev` / `.env.local` | Homologação | Sim |
| Vercel **Preview** | Homologação | Sim |
| Vercel **Production** (`*.vercel.app`) | Produção (projeto separado) | **Não** |

```powershell
Copy-Item .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ou o fallback `VITE_SUPABASE_ANON_KEY`) pelo canal seguro da equipe. **Nunca** commite `.env` / `.env.local` nem `service_role` no frontend, no Git ou nas env vars públicas da Vercel.

A raiz de [`supabase/migrations/`](supabase/migrations/) é o conjunto que a promoção de Production deve aplicar, controlado pelo manifesto [`supabase/migrations/prod.manifest.json`](supabase/migrations/prod.manifest.json). `pnpm migrations:prod` valida o manifesto; **não aplica SQL**. Homolog-only (`*_homolog.sql`, seeds fictícios e migrations de cenário) fica em [`supabase/migrations/homolog/`](supabase/migrations/homolog/). Migrations ainda não promovidas ficam em [`supabase/migrations/held/`](supabase/migrations/held/). `pnpm migrations:homolog` lista a cadeia. `pnpm migrations:homolog:plan` mostra `would-skip`, `would-register`, `blocked-legacy` e `would-apply` sem aplicar SQL. `pnpm migrations:homolog:repair` só registra versões locais cujo efeito já foi verificado no homolog. `pnpm migrations:homolog:apply` recusa reexecutar arquivos com `public.is_admin()` ou carimbo da lista de reparo. `HOMOLOG_SUPABASE_PROJECT_REF` tem de ser o ref oficial de homologação; o ref de produção é sempre recusado. A senha vai em `PGPASSWORD`.

**Promoção da versão Preview para Production:** levar apenas o código e o schema aprovados. Não copiar/restaurar o banco de Preview, Auth, objetos de Storage ou configurações de ambiente. Production deve começar sem contas, perfis, vagas, empresas, candidaturas, consentimentos, seeds ou objetos fictícios. Antes do deploy, comparar o histórico remoto com a cadeia local; em caso de versões divergentes, só registrar versões como aplicadas depois de comprovar que os efeitos correspondentes já existem. `migration repair` altera apenas o histórico, não aplica nem desfaz SQL. Nunca usar `supabase db reset --linked` em Production. Aplicar as migrations pendentes em ordem e conferir as tabelas/RLS, os advisors e as contagens vazias antes de publicar o frontend.

## OAuth (Google via Supabase Auth)

Redirect URLs permitidas neste recorte (sem domínio customizado — C-05):

- `http://127.0.0.1:5173/**` — local
- `https://*.vercel.app/**` — Preview e Production no Hobby

Configure as mesmas origens no provedor Google e em Authentication → URL Configuration **de cada** projeto Supabase (homologação e produção). Não aponte Production para o projeto de homologação.

## MFA staff (homolog)

**Alcance:** a flag Vite controla só a UI `/admin`. Com a migration `SEC-STAFF-AAL2-PROD-01` aplicada no ambiente, mutações e leituras privilegiadas staff na Data API exigem JWT `aal=aal2`. A presença da migration no manifesto não prova que Production já recebeu o apply. Candidatos (Google OAuth em `/login`) **não** entram neste fluxo.

| `VITE_STAFF_MFA_REQUIRED` | Comportamento |
|---|---|
| `true` | Após senha, a UI exige AAL2 (`getAuthenticatorAssuranceLevel`). Sem fator: enroll TOTP. Com fator: código do autenticador. |
| ausente, `false` ou qualquer outro valor | Fluxo atual (e-mail/senha). CI e clone local continuam sem MFA. |

Em Production, habilite `VITE_STAFF_MFA_REQUIRED=true` e TOTP somente depois de criar as contas individuais do staff e concluir o enrollment de cada pessoa. A migration `SEC-STAFF-AAL2-PROD-01` exige AAL2 no backend; sem MFA configurado, operações staff ficarão bloqueadas. Não compartilhar contas nem fatores TOTP.

Passos do mantenedor **só no projeto Supabase de homologação**:

1. Authentication → Multi-Factor Authentication → habilitar **TOTP**. Não habilitar SMS neste recorte.
2. Enroll TOTP nas contas staff de teste (`docs-local/*-test-user.md`, gitignored) **antes** de validar a flag `true` em Preview ou `pnpm dev`.
3. Offboarding (revogar fator, desativar usuário, rotacionar senha): procedimento local em `docs-local/sec-staff-mfa-offboarding.md`.

O toggle **Enhanced MFA Security** (AAL1 expira ~15 min) do Dashboard **não** substitui RLS AAL2.

## Upload de avatar (homolog / Preview / Production)

A flag Vite é só o gate de **UI/API de upload** (`isAvatarUploadEnabled`). Ela **não** substitui RLS do bucket `avatars` nem a autorização da função `community-avatar`.

| `VITE_AVATAR_UPLOAD_ENABLED` | Comportamento |
|---|---|
| `true` | UI de upload ligada (homologação / Preview). |
| ausente, `false`, `1`, `0` ou qualquer outro valor | Fail-closed: upload indisponível. |

Defina `true` em `.env.local` e nas env vars **Preview** da Vercel para validar o fluxo. Em Production, defina `true` apenas depois de aplicar a migration privada de Storage, implantar `community-avatar` com `verify_jwt=true` e configurar `COMMUNITY_AVATAR_ALLOWED_ORIGINS` com a origem HTTPS exata da aplicação. A função deve validar JWT e consentimento atual, responder sem cache público e usar as credenciais privilegiadas apenas no servidor. Nunca colocar `service_role` nas variáveis `VITE_*` nem na Vercel como variável exposta ao navegador.

**Contrato em homologação (PERF-AVATAR-02):**

- Bucket Storage `avatars` **privado**; leitura via **signed URL** (1 h). Path versionado `{userId}/{avatarVersion}.jpg` por upload (sem overwrite de `avatar.jpg` como desenho definitivo).
- `profiles.avatar_path` aponta para o objeto ativo; o objeto anterior é removido só depois do UPDATE bem-sucedido.
- `cacheControl` 3600 s (TTL da signed URL / default Storage). Troca de foto = path novo, então o browser/CDN não reutiliza o arquivo antigo.
- Policies: autenticado só lê/grava/apaga arquivos na própria pasta (`{uid}/{arquivo}.jpg`, um nível). Anon e terceiros não acessam Storage diretamente. A foto de outro perfil é entregue somente pelo proxy autenticado da Comunidade após verificar opt-in atual.
- Frontend: JPEG/PNG/WebP até 2 MB; recorte circular no cliente; popover no header (foto 96 px, nome, e-mail, ações). Sem foto ou falha de load → iniciais.
- Migrations legadas `avatars_*` continuam fora da cadeia de Production. A migration de Production para avatar é versionada na raiz e estabelece bucket privado, limites de tamanho/MIME e policies próprias; não aplicar seeds ou arquivos de Homolog em Production.
- Migrations `20260920010148_job_ingestions_source_contract_homolog.sql`, `20260920020100_job_ingestions_register_rpc_homolog.sql`, `20260920040000_job_ingestions_process_homolog.sql` e `20260923140000_job_ingestion_staff_list_homolog.sql` (MVP-013 / PERF-STAFF-LISTS-LIMIT-01) são **homolog-only** pelo sufixo `_homolog.sql`. O hash é recalculado na RPC; `process_job_ingestion` materializa só `pending`. A view de lista e a contagem de atenção não criam índice. **Não** aplicar em `gdg-jobs-prod`.
- Migration `20260920030000_staff_cannot_apply_homolog.sql` (SEC-STAFF-APPLY-01) é **homolog-only**: `apply_to_job` / `withdraw_application` recusam `admin`/`curator`/`moderator`. **Não** aplicar em `gdg-jobs-prod`.
- Mantenha `VITE_AVATAR_UPLOAD_ENABLED` ausente/false até bucket, policies e proxy estarem implantados e verificados. Após isso, `true` libera o upload no frontend; a autorização continua no banco e na função.

## Comunidade profissional (F-11)

F-11 aparece apenas após a migration de aprovação formal. A publicação é opcional e desligada por padrão; o backend só projeta os campos permitidos para membros autenticados, registra aceitação por versão e remove a projeção ao revogar ou excluir a conta. A versão beta exibe o aviso de riscos antes do fluxo de criação de conta. Não criar permissões públicas, links de Storage públicos ou seeds para demonstrar a comunidade em Production.

Antes de abrir o tráfego de Production, confirmar: migration F-11 ativa e aprovada na versão vigente; RLS sem acesso direto às tabelas de projeção; RPCs acessíveis apenas aos papéis previstos; função `community-avatar` com JWT obrigatório e origem permitida exata; buckets privados; proteção contra senhas vazadas habilitada em Auth; contas/perfis/objetos de teste removidos; advisor de segurança revisado. O aviso beta comunica a fase de validação e não substitui controles técnicos, política de privacidade ou orientação jurídica.

## Teste SEC-STAFF-MFA-02 (RLS AAL2)

Após aplicar a migration de AAL2 **em um ambiente autorizado** (homologação ou Production com gate formal):

1. Preencha `docs-local/staff-mfa-totp-secrets.md` (gitignored) ou `ADMIN_TEST_TOTP_SECRET` / `CURATOR_TEST_TOTP_SECRET` / `CURATOR2_TEST_TOTP_SECRET` / `CURATOR3_TEST_TOTP_SECRET` / `MODERATOR_TEST_TOTP_SECRET` no `.env.local` e no GitHub Environment `homolog-rls`.
2. `pnpm test:rls` — logins staff usam TOTP (AAL2). Cenário 20: senha só (AAL1) **não** insere vaga (admin) nem chama `submit_curation_review` (admin, curator, moderator); AAL2 insere pending.
3. Teste humano na API: `signInWithPassword` sem verify MFA → mutação staff bloqueada; fluxo com TOTP → a mesma mutação ok. Candidato sem regressão.
4. Enhanced MFA Security do Dashboard é regra de **sessão Auth**, não de policy — não conta como este teste.

### Atenção: rate limit do Auth vs TOTP errado

O harness `pnpm test:rls` dispara muitos logins staff (senha + MFA) no **mesmo projeto Supabase de homologação**. O Auth pode responder `Request rate limit reached` ou `over_request_rate_limit` — inclusive no `signInWithPassword`, **antes** do TOTP. Isso **não** significa secret TOTP incorreto.

| Log / erro | Interpretação |
|---|---|
| `rate limit` / `over_request_rate_limit` no login ou no `mfa.challenge` | Throttling — pare `test:rls` local, evite vários `workflow_dispatch` seguidos na `main`, aguarde 30–60 min. O script `scripts/check-rls.mjs` aplica backoff extra no GitHub Actions. |
| `Invalid TOTP` (ou falha só no `mfa.verify`, com senha OK) | Secret base32 desatualizado — re-enroll ou alinhe `*_TEST_TOTP_SECRET` no `.env.local` e no Environment **`homolog-rls`**. |

**Onde o secret vive:** no enroll, copie a chave base32 **uma vez** (o Dashboard não a reexibe). Localmente: `*_TEST_TOTP_SECRET` no `.env.local` **sobrescreve** `docs-local/staff-mfa-totp-secrets.md`. No CI **só** entram os secrets de `homolog-rls` — não há `.env.local` no runner.

Diagnóstico sem imprimir o secret: `pnpm verify:staff-mfa` (fingerprints SHA-256 truncados + probe admin AAL2). Modelo de runbook: [`docs-local.example/rls-homolog-auth-troubleshooting.example.md`](docs-local.example/rls-homolog-auth-troubleshooting.example.md) → cópia em `docs-local/`.

## Rollback (Vercel Hobby)

1. Dashboard Vercel → Deployments → abrir o deploy **Production anterior** → Promote to Production.
2. Não reaplicar seed no banco de produção.
3. Confirmar que Production continua com a URL do projeto Supabase de produção.

Publicar Production exige aceite do PO. Este repositório não promove Production automaticamente.

## Caminho de backup (C-06, não fecha nesta história)

No Free/Hobby: backups do dashboard Supabase no projeto de **produção** (não copiar dump de homologação). PITR e plano pago só com autorização do PO. Simulação de restore é MVP-007.

## Comandos

```powershell
pnpm install
pnpm dev          # http://127.0.0.1:5173 (fixo em vite.config.js — não usar localhost)
pnpm lint
pnpm test         # inclui smoke P0 em src/App.smoke.test.jsx (sem Playwright)
pnpm run build
pnpm check:bundle  # falha se dist/ tiver service_role / sb_secret / chave privada
pnpm migrations:prod
pnpm migrations:homolog         # lista a cadeia; não aplica SQL
# Apply só se HOMOLOG_SUPABASE_PROJECT_REF bater com a URL (psql). Retoma pelo histórico.
# pnpm migrations:homolog:apply  (lê HOMOLOG_* de .env.local se o shell não exportou)
```

## Gates de release (CI)

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) tem dois jobs com papéis distintos:

| Job | Comando | Quando corre | Efeito de falha |
|---|---|---|---|
| `Lint, test and build` | `pnpm lint` → `pnpm test` → `pnpm run build` → `pnpm check:bundle` → `pnpm migrations:prod` | PR e push em `main`. É o **único** required check para merge. Sem `service_role` e sem senhas staff. | **Bloqueia** merge na PR e marca o workflow como falho. |
| `RLS homolog` | `pnpm test:rls` (cenários 1–26 e contratos associados, homologação) | Só após merge: `push` ou `workflow_dispatch` em `main`, GitHub Environment `homolog-rls`. Na PR o job aparece como **skipped** (não consome secrets). | **Não** bloqueia merge. Falha em `main` torna o release **não confiável** e exige rollback — ver abaixo. |

Na **PR**, apenas `Lint, test and build` precisa ficar verde. `RLS homolog` skipped é o comportamento esperado.

### Gate pós-merge e Vercel (SEC-CI-SECRETS-01)

Neste recorte (Vercel Hobby + deploy automático em `main`), **não** há promoção condicionada ao `RLS homolog`. A Vercel pode publicar antes do job terminar.

Se `RLS homolog` falhar após o merge:

1. tratar o deploy associado como **não confiável** (não promover nem assumir homologação íntegra);
2. seguir o rollback em [`docs-local/sec-ci-secrets-01-rollback.md`](docs-local/sec-ci-secrets-01-rollback.md) (gitignored; cópia local do mantenedor);
3. reexecutar `workflow_dispatch` em `main` ou `pnpm test:rls` local após corrigir (se o log for **rate limit**, espere cooldown antes de repetir — ver § Atenção: rate limit do Auth vs TOTP errado).

Um workflow de deploy condicionado ao RLS permanece **fora de escopo** desta história (follow-up DevOps).

Smoke dos fluxos P0 (portal, catálogo, detalhe, login) entra em `pnpm test` via `App.smoke.test.jsx`. **Não** há Playwright neste recorte.

### Observabilidade operacional (`ops.*`, MVP-014)

Eventos mínimos de login, busca, candidatura, ingestão e RPC staff vão para o **Console do navegador** (`console.info`), não para dashboard externo. **Production não emite** `ops.*`.

| Onde | Como validar |
|---|---|
| Local | `pnpm dev` → `http://127.0.0.1:5173` → DevTools → filtro `ops.`; opcional `VITE_OPS_ENVIRONMENT=homolog` em `.env.local` |
| Preview (PR) | URL do deploy da branch → mesmo filtro; esperar `environment: "preview"` |
| CI / merge | `pnpm test` (`ops-observability.test.js`, smoke) — sem smoke manual em Production |

Guia passo a passo e checklist ~5 min (aceite PO / ClickUp): [`docs-local.example/ops-observability-qa.example.md`](docs-local.example/ops-observability-qa.example.md). Cópia operacional com bloco colável: `docs-local/mvp-014-preview-qa-checklist.md`.

### `pnpm test:rls` local

```powershell
# Requer .env.local + contas em docs-local/*-test-user.md + secrets TOTP staff (docs-local/staff-mfa-totp-secrets.md ou *_TEST_TOTP_SECRET)
# Probe F-019 (cenário 13), cleanup MVP-003 (cenário 16) e MVP-005 (cenário 17): SUPABASE_SERVICE_ROLE_KEY no .env.local (local) ou GitHub Environment homolog-rls (CI) — nunca no frontend nem versionado
pnpm test:rls
pnpm verify:staff-mfa   # diagnóstico TOTP / rate limit (não substitui o harness completo)
```

No GitHub Actions o job `RLS homolog` recebe as mesmas variáveis por **secrets do Environment `homolog-rls`** (homologação, nunca produção; só `push`/`workflow_dispatch` em `main`). Nomes:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY`)
- `ADMIN_TEST_EMAIL` / `ADMIN_TEST_PASSWORD` / `ADMIN_TEST_TOTP_SECRET`
- `CURATOR_TEST_*`, `CURATOR2_TEST_*`, `CURATOR3_TEST_*`, `MODERATOR_TEST_*` (`EMAIL`, `PASSWORD`, `TOTP_SECRET`)
- `CANDIDATE_TEST_*` (`EMAIL` e `PASSWORD` — candidato sem MFA staff)
- `SUPABASE_SERVICE_ROLE_KEY` — probe F-019 (cenário 13), cleanup do histórico de teste do MVP-003 (cenário 16) e da trilha de auditoria do MVP-005 (cenário 17); se ausente esses cenários registram skip e o restante segue

Sem `VITE_SUPABASE_URL` e chave publishable/anon no Environment, `test:rls` **falha** (não ignora). Jobs de PR **não** recebem `SUPABASE_SERVICE_ROLE_KEY` nem senhas staff. Colar os secrets no Environment (e **remover** os privilegiados dos secrets de repositório) é ação do mantenedor; nenhum valor entra neste arquivo nem no Git.

Modelo de credenciais (sem senhas reais): copie [`docs-local.example/`](docs-local.example/) para `docs-local/`. Documentação operacional do time (backlog, DS, QA) também fica em `docs-local/` — ver o README dessa pasta exemplo.

## O que este setup não inclui

Segredos, evidências Visual QA e governança de agentes **não** vão no clone público. Mantenedores: `pwsh scripts/migrate-docs-to-local.ps1` se ainda tiverem `docs/` no histórico local.
