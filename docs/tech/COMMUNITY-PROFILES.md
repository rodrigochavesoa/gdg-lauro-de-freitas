# Comunidade — contrato e limites de segurança

**Feature:** `UX-COMMUNITY-PROFILES-01`  
**Estado:** implementação integrada local (UI, API, Edge Function, DTO e migration held); finalidade F-11 inativa e pendente do DPO. Não habilitar publicação ou deploy enquanto os gates abaixo estiverem abertos.

**Decisão do PO para o piloto Homolog/Preview (2026-10-01):** publicação opcional, audiência autenticada, opt-in desligado por padrão, remoção da projeção e bloqueio de novas entregas do avatar após revogação ou exclusão; fixtures removidas ao fim dos testes; cópias já baixadas não são recuperáveis; preferir dados fictícios ou voluntários com opt-in documentado. Isso registra **produto**, não parecer jurídico, não nomeia DPO e não fecha base legal nem prazo de retenção dos registros mínimos de consentimento.

**Exceção técnica Homolog/Preview (não produção):** o controlador autorizou dispensar o gate interno **F-11 pendente** só no projeto Supabase de homologação (Preview Vercel usa o mesmo backend). O flag privado `private.community_pilot_settings.enabled` habilita esse caminho técnico sem aprovar `legal_basis_status`, `retention_status` ou `text_status`; os três permanecem `pending_dpo` e `privacy_purpose_is_authorized('F-11')` continua falso. Produção permanece sem migration held e sem migrations homolog-only. A migration corretiva `homolog/20261001160000_community_pilot_gate_correction_homolog.sql` corrige o estado já aplicado da migration 1300 e preserva opt-ins/projeções durante a troca. Registro operacional: `docs-local/community-homolog-preview-pilot.md`.

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

## Migrations, testes e gates

`20261001120000_ux_community_profiles_01.sql` fica em `supabase/migrations/held/`, fora de `prod.manifest.json` e da raiz lida por `supabase db push`. Usei `held/` (Camada B), não `homolog/`, porque é uma fronteira de schema/privacidade potencialmente promovível depois de decisão formal; não é SQL exclusivo de seed/teste. O cabeçalho marca **Produção: não aplicar** e `pnpm migrations:prod` confirma `hold`, sem adicionar ao manifesto. Após aprovação para homolog, a cadeia existente inclui arquivos `held/` e pode ser aplicada somente pelo gate `pnpm migrations:homolog:apply`, que exige URL/ref oficiais de homolog. `supabase db push` não lê `held/`. Nenhum apply, deploy ou push remoto foi feito neste trabalho.

O cenário 16 valida os estados de F-11, que permanecem `pending_dpo` no piloto, e o gate genérico falso sem registrar aceite F-11 no candidate compartilhado. Se o schema não estiver aplicado, o cenário 28 marca a migration ausente como `skipRequired` e o processo termina com falha. O cenário 28 é read-only no shared Homolog: verifica negação de anon, grants de tabela e `privacy_purpose_is_authorized`, sem chamar RPCs com contador de leitura e sem alterar consentimento/publicação. O cenário 29 é o único que executa mutações de publicação/aceite; exige `UX_COMMUNITY_RLS_ISOLATED_PROJECT_REF`, `UX_COMMUNITY_RLS_APPROVED_FIXTURE=true` e bloqueia homolog compartilhada e produção. Nesse projeto, valida publicação concorrente, gate genérico falso, desligamento do flag, revogação e bloqueio de status/lista/detalhe/avatar. A fixture restaura o flag para `false` e F-11 ao estado original em `finally`. Testes locais de API/DTO/handler cobrem visitante sem requests, campos descartados, limites de página, proxy autenticado, MIME/tamanho, origem e ausência de caminho/UID na resposta. A API não mantém cache de perfis; avatar usa `private, no-store`. Nenhuma RLS remota ou migration foi executada nesta entrega.

Antes de habilitar: aprovação formal do DPO para base legal, retenção, texto e campos; revisão do produto/consentimento; revisão de segurança do pacote; configuração das origens exatas da Edge Function; apply somente em homolog e execução de `pnpm test:rls`; depois, decisão independente sobre qualquer promoção de produção. Tornar a comunidade pública requer ainda uma revisão explícita de grants/RLS e migration própria.
