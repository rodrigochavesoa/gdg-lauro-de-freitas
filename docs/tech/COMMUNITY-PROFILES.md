# Comunidade — contrato e limites de segurança

**Feature:** `UX-COMMUNITY-PROFILES-01`  
**Estado:** implementação integrada local (UI, API, Edge Function, DTO e migration held); finalidade F-11 inativa e pendente do DPO. Não habilitar publicação ou deploy enquanto os gates abaixo estiverem abertos.

**Decisão do PO para o piloto Homolog/Preview (2026-10-01):** publicação opcional, audiência autenticada, opt-in desligado por padrão, remoção da projeção e bloqueio de novas entregas do avatar após revogação ou exclusão; fixtures removidas ao fim dos testes; cópias já baixadas não são recuperáveis; preferir dados fictícios ou voluntários com opt-in documentado. Isso registra **produto**, não parecer jurídico, não nomeia DPO e não fecha base legal nem prazo de retenção dos registros mínimos de consentimento.

**Exceção técnica Homolog/Preview (não produção):** o controlador autorizou dispensar o gate interno **F-11 pendente** só no projeto Supabase de homologação (Preview Vercel usa o mesmo backend). Produção permanece sem migration held, sem `homolog/20261001130000_community_f11_pilot_homolog.sql` e sem F-11 ativa. Passos: apply da cadeia homolog (held + SQL homolog-only de piloto), deploy da Edge `community-avatar`, origens allowlist incluindo a URL do preview. Registro operacional: `docs-local/community-homolog-preview-pilot.md`. Enquanto o piloto estiver ativo, `pnpm test:rls` ignora o cenário 28 nominal e ajusta o 16 para F-11 v2 ativa; ao encerrar o piloto, reverter F-11 v2 para `inactive`/`pending_dpo`.

## Decisões de arquitetura

- `public.profiles` continua privada. A interface não consulta `profiles` nem lê a tabela de projeção diretamente.
- A migration cria `public.community_profiles`, uma projeção mínima para perfis que optaram explicitamente por compartilhar. As colunas `subject_id` e `avatar_path` nunca são retornadas por RPC de leitura ou DTO. O identificador exposto é um UUID aleatório (`public_id`), sem relação com o UID de autenticação.
- Somente RPCs com projeção allowlist servem os campos de lista/detalhe. A lista limita páginas a 24, usa cursor opaco e não faz `count exact`. Não há grants de tabela para `anon`, `authenticated` ou `service_role`; RLS fica habilitado sem policy de acesso direto.
- `community_access_settings` e `private.community_access_allowed(viewer_id)` formam o único seam server-side de audiência. Seu valor atual é `authenticated`; todas as RPCs de leitura também exigem sessão. A opção `public` no domínio não concede acesso por si: uma futura mudança exige revisão de segurança e migration separada para alterar configuração e grants `EXECUTE`. Não se deve abrir tabela, bucket ou usar flag de frontend para mudar audiência.
- Publicação exige simultaneamente: sessão autenticada, papel `candidate`, perfil mínimo, F-11 ativa com base legal, retenção e texto aprovados pelo DPO, e aceite válido da versão atual. A ação explícita de opt-in chama um único `set_community_profile_publication(true)`: a RPC trava F-11 `FOR SHARE` e depois a linha do perfil `FOR UPDATE`, verifica os estados aprovados, grava o aceite F-11 e seu evento de auditoria apenas quando ainda não há aceite válido, cria/atualiza a projeção e retorna tudo na mesma transação. A desativação da finalidade adquire os locks na mesma ordem e remove a projeção/grava revogações no commit administrativo; isso evita corrida entre aprovação e inserção de projeção. Não se deve encadear uma chamada de consentimento no cliente com outra de publicação. Escritas de consentimento F-11 também travam a linha do titular. A migration cria F-11 como `inactive`/`pending_dpo`; enquanto assim permanecer, status próprio retorna apenas `{ available: false, reason: "approval_pending", published: false, can_publish: false }`, e lista, detalhe, avatar e publicação falham fechados.
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

O cenário 16 estende a validação do catálogo para F-11. Se o schema não estiver aplicado, o cenário 28 detecta a RPC ausente, marca o cenário como `skipRequired` e o processo termina com falha (exit diferente de zero); o harness não apresenta uma execução parcial como aprovação. O cenário 28 verifica: anon sem EXECUTE/leitura direta; status autenticado sem campos de perfil; F-11 sem aceite possível enquanto pendente; lista/detalhe/publicação indisponíveis; consulta interna de caminho do avatar devolve `null`; revogação própria disponível; RPC sem argumento para mutar outro titular. O cenário 29 verifica publicação/aceite atômicos, opt-in concorrente idempotente (duas chamadas, um evento) e revogação, mas só pode rodar em um projeto Supabase isolado declarado por `UX_COMMUNITY_RLS_ISOLATED_PROJECT_REF`, com `UX_COMMUNITY_RLS_APPROVED_FIXTURE=true` e aprovação específica para o teste. O harness bloqueia os refs conhecidos de homologação compartilhada e produção; nunca habilitar F-11 temporariamente no banco compartilhado. A fixture restaura a finalidade ao estado original e revoga a publicação no `finally`. Testes locais de API/DTO/handler cobrem visitante sem requests, campos descartados, limites de página, proxy autenticado, MIME/tamanho, origem e ausência de caminho/UID na resposta. A API não mantém cache de perfis; avatar usa `private, no-store`. O cenário RLS não foi executado remotamente nesta entrega.

Antes de habilitar: aprovação formal do DPO para base legal, retenção, texto e campos; revisão do produto/consentimento; revisão de segurança do pacote; configuração das origens exatas da Edge Function; apply somente em homolog e execução de `pnpm test:rls`; depois, decisão independente sobre qualquer promoção de produção. Tornar a comunidade pública requer ainda uma revisão explícita de grants/RLS e migration própria.
