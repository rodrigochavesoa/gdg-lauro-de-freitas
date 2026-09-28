-- PERF-ADMIN-SHELL-SUMMARY-01: um round-trip para os indicadores do painel.
-- Não promove job_ingestions, job_ingestion_attempts nem job_ingestion_staff_list.
-- ingest_attention chama count_job_ingestions_needing_attention() só se essa função
-- já existir. Sem ela, ou se a contagem falhar, ingest_attention fica null e
-- ingest_available false. Não publica 0 no lugar de métrica ausente.
-- A falha da contagem de ingestão não descarta as contagens de jobs.
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
  v_ingest integer := null;
  v_ingest_available boolean := false;
  v_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  -- Leitura de jobs só depois do helper combinado. O papel isolado só escolhe a mensagem.
  if not private.can_review_curation_aal2() then
    if not private.can_review_curation() then
      raise exception 'not authorized to review';
    end if;
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
    begin
      execute 'select public.count_job_ingestions_needing_attention()' into v_ingest;
      v_ingest_available := true;
    exception
      when others then
        v_ingest := null;
        v_ingest_available := false;
    end;
  end if;

  return jsonb_build_object(
    'pending_curation', v_pending,
    'pending_jobs', v_pending,
    'approved', case when v_admin then v_approved else 0 end,
    'rejected_jobs', case when v_admin then v_rejected else 0 end,
    'rejected_queue', case when v_admin then v_rejected else 0 end,
    'ingest_attention', case when v_admin and v_ingest_available then v_ingest else null end,
    'ingest_available', v_admin and v_ingest_available
  );
end;
$$;

revoke all on function public.get_admin_dashboard_summary() from public, anon;
grant execute on function public.get_admin_dashboard_summary() to authenticated;

comment on function public.get_admin_dashboard_summary() is
  'PERF-ADMIN-SHELL-SUMMARY-01: contagens do painel numa query de jobs, após can_review_curation_aal2(). Campos de admin exigem is_admin_aal2. ingest_available false e ingest_attention null quando a contagem de ingestão não existe ou falha.';

notify pgrst, 'reload schema';
