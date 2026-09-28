-- PERF-ADMIN-SHELL-SUMMARY-01: um round-trip para os indicadores do painel.
-- Não promove job_ingestions, job_ingestion_attempts nem job_ingestion_staff_list.
-- ingest_attention usa count_job_ingestions_needing_attention() só se essa função
-- já existir no ambiente (homolog). Sem ela, o campo volta 0.
-- Rollback, só com aprovação do Plan:
--   drop function if exists public.get_admin_dashboard_summary();

create or replace function public.get_admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pending integer := 0;
  v_approved integer := 0;
  v_rejected integer := 0;
  v_ingest integer := 0;
  v_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not private.can_review_curation() then
    raise exception 'not authorized to review';
  end if;
  if not private.jwt_aal2() then
    raise exception 'aal2 required';
  end if;

  select
    (count(*) filter (where status = 'pending'))::integer,
    (count(*) filter (where status = 'approved'))::integer,
    (count(*) filter (where status = 'rejected'))::integer
  into v_pending, v_approved, v_rejected
  from public.jobs;

  v_admin := private.is_admin_aal2();
  if v_admin and to_regprocedure('public.count_job_ingestions_needing_attention()') is not null then
    execute 'select public.count_job_ingestions_needing_attention()' into v_ingest;
  end if;

  return jsonb_build_object(
    'pending_curation', v_pending,
    'pending_jobs', v_pending,
    'approved', case when v_admin then v_approved else 0 end,
    'rejected_jobs', case when v_admin then v_rejected else 0 end,
    'rejected_queue', case when v_admin then v_rejected else 0 end,
    'ingest_attention', case when v_admin then coalesce(v_ingest, 0) else 0 end
  );
end;
$$;

revoke all on function public.get_admin_dashboard_summary() from public, anon;
grant execute on function public.get_admin_dashboard_summary() to authenticated;

comment on function public.get_admin_dashboard_summary() is
  'PERF-ADMIN-SHELL-SUMMARY-01: contagens do painel numa query de jobs. Campos de admin e ingest_attention exigem is_admin_aal2. Ingestão só entra se count_job_ingestions_needing_attention já existir.';

notify pgrst, 'reload schema';
