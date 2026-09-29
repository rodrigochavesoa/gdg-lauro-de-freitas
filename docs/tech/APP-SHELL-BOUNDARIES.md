# Fronteiras do shell da SPA

`App.jsx` só compõe layout, hooks e rotas. Sessão, prefetch, avatar e gates vivem em módulos com interface própria. Não há Context, Redux nem Zustand: o estado sobe pelos hooks e desce por props, como antes da extração.

Autorização continua na sessão e no RLS. Estes módulos não leem cache para decidir permissão. Freshness e invalidação estão em `docs/tech/CACHE-POLICY.md`.

## Mapa

| Módulo | Responsabilidade | Dependências | Testes |
|---|---|---|---|
| `src/app/useAppAuth.js` | `subscribeAuth`, `mergeAuthSnapshot`, `authReady`, flags de hidratação, `authGeneration`, troca de `userId` e logout | `auth-api.js`, `invalidateSessionCaches` | `App.smoke.test.jsx`, `App.admin-shell-auth.test.jsx` |
| `src/app/useAppAvatar.js` | Signed URL, `resolveHeaderIdentity`, upload guardado por `authGeneration` | `auth-api.js` (`avatarPublicUrl`, `saveProfileAvatar`, `invalidateAvatarSignedUrl`) | `App.smoke.test.jsx` (avatar e logout otimista) |
| `src/app/useCatalogPrefetch.js` | Aquece `loadApprovedJobs` fora de `/admin`, uma vez por montagem do shell | `jobs-api.js`, `isAdminAreaPath` | `src/app/useCatalogPrefetch.test.jsx` |
| `src/app/useCandidatePrefetch.js` | Aquece candidaturas e privacidade do candidato; staff e onboarding incompleto não puxam privacidade | `apply-api.js`, `privacy-api.js` | `App.smoke.test.jsx` |
| `src/app/AppRoutes.jsx` | `<Routes>` e props. Sem regra nova | gates em `src/app/routes/`, `Admin`, `adminChildRoutes` | `App.smoke.test.jsx`, `App.admin-shell-auth.test.jsx` |
| `src/features/jobs/JobDetailRoute.jsx` | Detalhe da vaga, cache parcial, apply/withdraw, `routeIdRef` | `jobs-api.js`, `apply-api.js`, `JobDetail` | `JobDetailRoute.test.jsx`, `App.smoke.test.jsx` |
| `src/App.jsx` | `Header`, `Footer`, `ScrollToTop`, `SkipLink` e a chamada dos hooks | os módulos acima | os dois testes de App |

## Sessão

`useAppAuth` assina `subscribeAuth` uma vez. Cada snapshot passa por `mergeAuthSnapshot`. `authReady` fica verdadeiro só se a geração do pedido ainda for `authGeneration`.

`authGeneration` começa em 0 e só aumenta. Sobe na troca de usuário (quando já havia um id, ou quando a sessão some) e no logout, antes do `await` de `signOutUser`. Efeitos de avatar e gravações de perfil comparam a geração capturada e descartam a resposta atrasada.

Hidratação: `hydratedUserId` no meta `hydrated`; `hydrateFailedUserId` no meta `failed`. O admin recebe `profileHydrated` e `profileHydrateFailed` com o `userId` da sessão atual.

Logout chama `invalidateSessionCaches()` sem `userId` (limpa candidaturas, privacidade, avatar e os dois mapas de curadoria) e zera a sessão no mesmo turno, junto com a foto do header. Troca de `userId` chama `invalidateSessionCaches(userId anterior)` antes de incrementar a geração.

## Prefetch

O catálogo aquece com `loadApprovedJobs()` na primeira rota que não é `/admin` nem `/admin/…`. Em `/admin` o efeito não dispara. A flag vive no hook, então a ida seguinte a `/` não repete a chamada.

Candidaturas (`loadMyApplications`) e privacidade (`loadPrivacyPreferences`) disparam para sessão com papel que não é staff (`admin`, `curator`, `moderator`). Sem papel, não disparam. Com `needsOnboarding`, candidaturas aquecem e privacidade não. O dedupe é o inflight/TTL de `docs/tech/CACHE-POLICY.md`.

## Avatar e header

`useAppAvatar` pede `avatarPublicUrl` quando há `profile.avatar_path`. A chave `userId:path` evita repetir a signed URL no `TOKEN_REFRESHED` do mesmo usuário. Falha da URL cai nas iniciais, com status `ready`. Upload, quando habilitado, captura `authGeneration` antes do `await`, invalida `invalidateAvatarSignedUrl` do usuário corrente e ignora a URL se a geração mudou.

`resolveHeaderIdentity` decide `pending`, nome e URL visível. O header não busca storage.

## Detalhe da vaga

`JobDetailRoute` lê `findApprovedJobInCache` na hora. Se houver linha, o status é `partial` enquanto `loadApprovedJob` corre. Falha de rede com cache mantém a vaga e o alerta de atualização. Sem cache, a falha é erro com retry, distinto de vaga ausente (`null` → “não encontrada”).

Apply e withdraw capturam o id clicado. `routeIdRef` acompanha o id da rota. Resposta que chega depois da navegação não grava status na vaga nova. `already applied`, perfil incompleto e autenticação exigida seguem para o status existente, `/onboarding` ou `/login`.

## Gates de rota

| Rota | Guard |
|---|---|
| `/`, `/vagas`, `/eventos`, `/eventos/:slug`, `/newsletter`, `/jobs/:id` | `CatalogGate`: `needsOnboarding` → `/onboarding` |
| `/eventos/:slug` | slug desconhecido → `/eventos` |
| `/onboarding` | sem `needsOnboarding` → `/` |
| `/login` | onboarding → `/onboarding`; sessão → `/` |
| `/minhas-candidaturas`, `/preferencias` | onboarding → `/onboarding`; sem sessão e `authReady` → `/login`; sem sessão e auth ainda não pronta, a página monta sem `userId` |
| `/perfil` | onboarding → `/onboarding`; staff → `/`; sessão sem perfil, ou auth ainda não pronta, mostra o título pendente; sem sessão e `authReady` → `/login` |
| `/admin` e filhas | contrato de `Admin` / `adminChildRoutes` inalterado; anônimo vê o login staff dentro do admin |
| `*` | → `/` |

Paths de URL não mudam nesta fronteira.
