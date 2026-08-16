-- S3-01: autenticado (admin via RLS) precisa escrever empresas/vagas.
-- Rollback: revoke insert, update, delete on public.companies, public.jobs from authenticated;

grant insert, update, delete on public.companies to authenticated;
grant insert, update, delete on public.jobs to authenticated;
