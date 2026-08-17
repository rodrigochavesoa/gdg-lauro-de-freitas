# ARQ-02 — rotas reais

Status: em PR (`feat/arq-02-router`).

## Mapa de rotas

| URL | Tela |
|---|---|
| `/` | Catálogo de vagas aprovadas (`Home`) |
| `/jobs/:id` | Detalhe de uma vaga aprovada, carregada pelo adaptador existente |
| `/login` | Login do candidato via Google OAuth |
| `/onboarding` | Perfil mínimo D-01 quando a sessão ainda precisa de onboarding |
| `/admin` | Admin e curadoria, incluindo login de staff por senha |

O shell mantém a sessão S5 (`loadAuthSnapshot`/`subscribeAuth`) e o gate de onboarding redireciona as rotas de catálogo para `/onboarding`, sem bloquear `/admin`.

## Vite e deep links

O `main.jsx` fornece `BrowserRouter`; a aplicação usa `Routes`, `Route`, `Link`, `NavLink` e `useNavigate`. O servidor de produção deve aplicar fallback de SPA para `index.html` nas URLs que não sejam arquivos estáticos, para que um acesso direto a `/jobs/:id` seja entregue ao Vite.
