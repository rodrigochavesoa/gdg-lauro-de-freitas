# Comunidade — contrato e limites de segurança

**Feature:** `UX-COMMUNITY-PROFILES-01`  
**Estado:** implementação integrada no código da branch de promoção (UI, API, Edge Function, DTO e migration no manifesto de Production). A migration F-11 v3 registra a decisão do PO para disponibilizar a Comunidade em Production; publicação individual continua opcional e desligada por padrão. O schema ainda depende do procedimento de reconciliação e aplicação descrito abaixo.

**Decisão do PO para Production (2026-10-06):** a versão 3 de F-11 fica ativa com os estados formais registrados como aprovados na migration de Production. Essa alteração atende à decisão explícita do PO para esta promoção e não deve ser interpretada como parecer jurídico independente. A publicação individual segue opcional, com opt-in desligado por padrão, remoção da projeção e bloqueio de novas entregas do avatar após revogação ou exclusão; cópias já baixadas não são recuperáveis. Não criar perfis ou consentimentos fictícios para demonstrar a feature.

**Piloto Homolog/Preview (2026-10-01):** o flag privado `private.community_pilot_settings.enabled` habilita o cenário de teste sem aprovar os estados formais do catálogo; em Homolog eles permanecem `pending_dpo` e `privacy_purpose_is_authorized('F-11')` continua falso. A migration corretiva `homolog/20261001160000_community_pilot_gate_correction_homolog.sql` mantém esse comportamento e preserva opt-ins/projeções durante a troca. Isso é independente da decisão de Production registrada na versão 3. Registro operacional: `docs-local/community-homolog-preview-pilot.md`.

## Decisões de arquitetura

- `public.profiles` continua privada. A interface não consulta `profiles` nem lê a tabela de projeção diretamente.
- A migration cria `public.community_profiles`, uma projeção mínima para perfis que optaram explicitamente por compartilhar. As colunas `subject_id` e `avatar_path` nunca são retornadas por RPC de leitura ou DTO. O identificador exposto é um UUID aleatório (`public_id`), sem relação com o UID de autenticação.
- Somente RPCs com projeção allowlist servem os campos de lista/detalhe. A lista limita páginas a 24, usa cursor opaco e não faz `count exact`. Não há grants de tabela para `anon`, `authenticated` ou `service_role`; RLS fica habilitado sem policy de acesso direto.
- `community_access_settings` e `private.community_access_allowed(viewer_id)` formam o único seam server-side de audiência. Seu valor atual é `authenticated`; todas as RPCs de leitura também exigem sessão. A opção `public` no domínio não concede acesso por si: uma futura mudança exige revisão de segurança e migration separada para alterar configuração e grants `EXECUTE`. Não se deve abrir tabela, bucket ou usar flag de frontend para mudar audiência.
- Publicação exige sessão autenticada, audiência autenticada, papel `candidate`, perfil mínimo, aceite explícito da versão atual e um dos dois gates server-side: F-11 ativa com os três estados formais `approved`, ou F-11 ativa com o flag privado do piloto ligado. O flag começa `false`, não tem acesso direto por papéis da Data API e só pode ser alterado por migration ou backend administrativo restrito. A ação explícita chama `set_community_profile_publication(true)`, que trava F-11 `FOR SHARE`, o flag do piloto `FOR SHARE` e depois o perfil `FOR UPDATE`, nessa ordem, e grava aceite/auditoria/projeção na mesma transação. Desligar o flag espera publicação concorrente; se não houver aprovação formal, registra revogações e apaga as projeções no mesmo commit. Se F-11 estiver formalmente aprovada, desligar o flag não interrompe o caminho formal nem apaga publicação válida. Não encadear chamada de consentimento no cliente com publicação. `record_privacy_event` pode registrar aceite quando F-11 está `active`, mesmo com estados `pending_dpo`; isso não torna `privacy_purpose_is_authorized` verdadeiro nem habilita a Comunidade sem o gate específico.
- Opt-in inicia desligado: nenhuma linha de projeção é criada por default. Retirada remove a projeção e grava evento de revogação; o trigger também apaga a projeção se o aceite for revogado ou se F-11 deixar de estar aprovada/ativa. Não é possível recolher bytes que já tenham sido baixados por terceiros nem cancelar uma resposta que já estava em voo.

## Interface de descoberta (produto)

A listagem autenticada segue o layout de referência do piloto: **hero** (“Conecte-se com a comunidade tech”), **barra de busca** (“Buscar por nome, tecnologia ou área”) e **filtros** de nível e modalidade no cliente, seguidos do bloco **Profissionais da comunidade** com contagem dos perfis **já carregados** na sessão.

- A busca e os filtros atuam somente sobre o array retornado por `list_community_profiles` (paginação opaca de até 24 por chamada). Não há RPC de busca server-side nesta entrega.
- O texto de contagem **não** inventa total global: usa `formatCommunityLoadedCount` — quando existe `nextCursor`, indica “há mais” em vez de um número exato de catálogo (alinhado ao contrato sem `count exact`).
- O painel de opt-in (`community-share`) some após publicação; o hero e a barra permanecem como superfície principal de descoberta, no mesmo padrão visual de `/eventos` e do hero de vagas.

Implementação: `CommunityBrowseHero`, `CommunityBrowseToolbar` e `src/lib/filter-community.js`.

## DTO permitido

Lista: `publicId`, `fullName`, `headline`, `skills`, `location`, `experienceLevel`, `workModel`, `avatarAvailable`, `publishedAt`. `avatarAvailable` é apenas um booleano para evitar chamadas ao proxy quando não há foto; não revela path, UID nem URL.  
Detalhe acrescenta: `bio`, `linkedinUrl`, `githubUrl`, `portfolioUrl`.

Não incluir e-mail, currículo/`cv_url`, papel, UID de autenticação, preferências brutas, caminho do avatar ou linha completa do banco. `community-api.js` valida sessão antes de qualquer RPC/invoke e adapta respostas ao contrato acima. Sem sessão, não faz leitura de comunidade. `loadCommunityProfile`, `loadMyCommunityPublicationStatus`, `loadCommunityAvatar` e `setMyCommunityPublication` são os nomes estáveis da API consumida pelo frontend.

## Avatar

O bucket `avatars` segue privado. A Edge Function `community-avatar` valida origem allowlist, método GET, JWT via Supabase Auth e UUID público; consulta por RPC service-role somente o caminho interno do avatar após confirmar a publicação e o consentimento atuais, e baixa o objeto privado no servidor. O caminho e a service-role key nunca são enviados ao browser. A resposta contém bytes de imagem JPEG/PNG/WebP, com limite de 2 MiB, `nosniff` e `private, no-store`; erros não revelam se um UID/caminho existe. O rate limit compartilhado é de 60 leituras por usuário autenticado por janela de minuto, incluindo status, lista, detalhe e proxy.

`COMMUNITY_AVATAR_ALLOWED_ORIGINS` deve conter origens exatas do app. Lista vazia falha fechada. Não usar CORS `*`.

No frontend, `CommunityAvatar` (`Community.jsx`) usa cache em memória (`peekCommunityAvatarObjectUrl`), prefetch da listagem e proxy via `getCommunityAvatarObjectUrl`. O detalhe monta o avatar com `eager` para não depender só de `IntersectionObserver`. Não reutilizar a foto do header por nome igual ao do card — cada membro usa apenas o proxy por `publicId`.

**Troubleshooting (Preview, CORS, shimmer lista→detalhe, o que não fazer):** [COMMUNITY-AVATARS-TROUBLESHOOTING.md](./COMMUNITY-AVATARS-TROUBLESHOOTING.md).

## Migrations, testes e gates

`20261001120000_ux_community_profiles_01.sql`, `20261006175804_community_f11_production_approval.sql` e `20261006175805_community_avatar_production_storage.sql` estão na raiz e no manifesto de Production desta branch. Os arquivos de piloto continuam em `supabase/migrations/homolog/`; `supabase db push` não os lê. `pnpm migrations:prod` apenas valida o manifesto e não aplica SQL. Production tem histórico remoto divergente: antes de qualquer apply, é necessário reconciliar cada versão histórica com os efeitos realmente presentes. Não use `db push` nem registre versões por suposição. Nenhum apply, deploy ou alteração remota faz parte deste PR.

O cenário 16 valida os estados de F-11 no piloto Homolog, sem registrar aceite F-11 no candidate compartilhado. Se o schema não estiver aplicado, o cenário 28 marca a migration ausente como `skipRequired` e o processo termina com falha. O cenário 28 é read-only no shared Homolog: verifica negação de anon, grants de tabela e `privacy_purpose_is_authorized`, sem chamar RPCs com contador de leitura e sem alterar consentimento/publicação. O cenário 29 é o único que executa mutações de publicação/aceite; exige `UX_COMMUNITY_RLS_ISOLATED_PROJECT_REF`, `UX_COMMUNITY_RLS_APPROVED_FIXTURE=true` e bloqueia homolog compartilhada e produção. Nesse projeto, valida publicação concorrente, gate genérico falso, desligamento do flag, revogação e bloqueio de status/lista/detalhe/avatar. A fixture restaura o flag para `false` e F-11 ao estado original em `finally`. Testes locais de API/DTO/handler cobrem visitante sem requests, campos descartados, limites de página, proxy autenticado, MIME/tamanho, origem e ausência de caminho/UID na resposta. A API não mantém cache de perfis; avatar usa `private, no-store`. A migration de aprovação ainda não foi aplicada remotamente.

Antes de abrir o tráfego de Production: concluir a reconciliação e aplicar a cadeia aprovada; revisar consentimento e RLS; implantar `community-avatar` com JWT obrigatório e origem HTTPS exata; manter bucket privado; configurar os segredos e flags do ambiente; remover dados fictícios; revisar advisors e validar o fluxo de opt-in/revogação. A decisão de disponibilizar F-11 em Production já está registrada na migration v3. Tornar a comunidade pública requer ainda revisão explícita de grants/RLS e migration própria.
