-- SEC-DATA-AUTHORITY-01: fecha match_jobs na Data API.
-- 202608150001_ai_matching.sql concede EXECUTE a anon e authenticated.
-- O default do Postgres também concede EXECUTE a PUBLIC; revogar só
-- anon/authenticated deixa o grant de PUBLIC intacto.
-- Assinatura única (sem overload): public.match_jobs(extensions.vector(768), text[], text[], text, integer).
-- A função permanece para uso futuro gated (MVP-005 / C-04 / MVP-006).
-- Não habilita matching na SPA. Edge match-jobs continua desligada.
-- service_role não entra neste REVOKE: o gate futuro decide o GRANT.

revoke execute on function public.match_jobs(
  extensions.vector(768),
  text[],
  text[],
  text,
  integer
) from public, anon, authenticated;

comment on function public.match_jobs(
  extensions.vector(768),
  text[],
  text[],
  text,
  integer
) is
  'SEC-DATA-AUTHORITY-01: score semântico mantido para uso futuro gated (MVP-005 / C-04 / MVP-006). EXECUTE revogado de PUBLIC, anon e authenticated. Sem matching na SPA até o gate de privacidade.';

notify pgrst, 'reload schema';
