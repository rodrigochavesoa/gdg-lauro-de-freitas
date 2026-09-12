-- MVP-002: GRANT SELECT do Data API independente do seed fictício.
-- Homologação já recebeu estes grants em 202608160002; re-GRANT é idempotente.
-- Produção aplica este arquivo e NÃO aplica 202608160002_seed_fictitious_catalog.sql.
-- Rollback: revoke select on public.companies, public.jobs, public.profiles, public.applications from anon, authenticated;

grant select on public.companies to anon, authenticated;
grant select on public.jobs to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.applications to anon, authenticated;
