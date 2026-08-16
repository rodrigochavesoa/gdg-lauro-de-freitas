# Supabase — ambiente de teste e variáveis (Sprint 2)

**Ambiente:** projeto Supabase **de desenvolvimento/teste** (Free tier). Dados fictícios ou autorizados — sem dados pessoais reais de titulares ([`docs/lgpd-data-inventory.md`](lgpd-data-inventory.md)).

**Produção:** projeto, chaves e políticas separados; só após gates C-02 a C-06 e LGPD.

## O que vai no Git vs. local

| Arquivo | Commitado? | Conteúdo |
|---|---|---|
| [`.env.example`](../.env.example) | **Sim** | Nomes das variáveis e comentários; **sem valores** |
| `.env`, `.env.local`, `.env.*` | **Não** | Valores reais do projeto de teste (`.gitignore`) |
| Secrets Supabase Edge Functions | **Não** | Painel Supabase → Edge Functions → Secrets |

Fluxo local (Vite):

```powershell
Copy-Item .env.example .env.local
# Editar .env.local com URL e chave publishable (ou legacy anon)
pnpm dev
```

## Chaves de API — qual usar

O dashboard Supabase expõe dois formatos ([documentação oficial](https://supabase.com/docs/guides/getting-started/api-keys)):

| Aba | Formato | Uso no GDGJobs |
|---|---|---|
| **API Keys** (novo) | `sb_publishable_...` | **Preferencial** no frontend (`VITE_SUPABASE_PUBLISHABLE_KEY`) |
| **Legacy anon** | JWT `eyJ...` | **Fallback** se o client pinado no Sprint 2 falhar com publishable (`VITE_SUPABASE_ANON_KEY`) |
| **Secret / Legacy service_role** | `sb_secret_...` ou `eyJ...` | **Somente** server/Edge Functions; nunca `VITE_*` |

### Regra para o Executor (Sprint 2)

1. Instalar `@supabase/supabase-js@2` **pinado** (não `latest`).
2. Conectar o frontend com **publishable key** + `VITE_SUPABASE_URL`.
3. Se houver erro de API/JWT na primeira integração, alternar para **Legacy anon** (`eyJ...`) e registrar no PR qual formato funcionou.
4. **Nunca** colocar `service_role` / secret key no frontend nem na Vercel como variável exposta ao browser.

### Edge Functions (Sprint 9+)

As funções em `supabase/functions/` usam JWT de **sessão do usuário** em `Authorization` e secrets no painel Supabase. Com chaves novas (`sb_secret_...`), pode ser necessário revisar `verify_jwt` no deploy — fora do escopo imediato do Sprint 2.

## Variáveis — frontend (teste)

| Variável | Obrigatória | Onde obter |
|---|---|---|
| `VITE_SUPABASE_URL` | Sim | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sim (preferencial) | Supabase → Settings → API Keys → Publishable |
| `VITE_SUPABASE_ANON_KEY` | Só fallback | Supabase → Legacy anon |

## Variáveis — server (nunca no Git)

| Variável | Uso |
|---|---|
| `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` | Scripts, seed server-side, Edge Functions |

Entrega humana: responsável do Supabase envia valores **fora do Git** (canal seguro). O Executor preenche `.env.local` localmente.

## Vercel (preview — fim do Sprint 2, se autorizado)

Mesmas variáveis `VITE_*` no painel Vercel (ambiente **Preview**), nunca secret keys. Projeto de teste Supabase pode ser o mesmo do dev inicialmente.

## Checklist do responsável Supabase (humano)

- [ ] Projeto **dev/teste** criado (região definida)
- [ ] Migration [`supabase/migrations/202608150001_ai_matching.sql`](../supabase/migrations/202608150001_ai_matching.sql) aplicada
- [ ] URL + publishable key entregues ao Executor (canal seguro)
- [ ] Secret/service_role só se necessário para seed server-side — nunca no frontend
- [ ] Confirmado: sem dados pessoais reais no banco de teste
