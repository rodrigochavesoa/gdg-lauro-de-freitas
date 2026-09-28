-- PERF-ADMIN-SHELL-SUMMARY-01: um round-trip para os indicadores do painel.
-- Não promove job_ingestions, job_ingestion_attempts nem job_ingestion_staff_list.
-- ingest_attention chama count_job_ingestions_needing_attention() só se essa função
-- já existir e devolver um inteiro >= 0. Sem ela, com retorno nulo ou com falha,
-- ingest_attention fica null, ingest_available false e ingest_unavailable traz o
-- código estável. A causa vai para o log do servidor, sem a mensagem SQL.
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
  if v_admin and to_regprocedure('public.count_job_ingestions_needing_attention()') is null then
    -- Só o código estável. A mensagem SQL não volta no jsonb.
    raise log 'get_admin_dashboard_summary ingest_unavailable missing_function';
  elsif v_admin then
    begin
      execute 'select public.count_job_ingestions_needing_attention()' into v_ingest;
      if v_ingest is not null and v_ingest >= 0 then
        v_ingest_available := true;
      else
        v_ingest := null;
        raise log 'get_admin_dashboard_summary ingest_unavailable null_count';
      end if;
    exception
      when others then
        v_ingest := null;
        v_ingest_available := false;
        raise log 'get_admin_dashboard_summary ingest_unavailable sqlstate=%', sqlstate;
    end;
  end if;

  return jsonb_build_object(
    'pending_curation', v_pending,
    'pending_jobs', v_pending,
    'approved', case when v_admin then v_approved else 0 end,
    'rejected_jobs', case when v_admin then v_rejected else 0 end,
    'rejected_queue', case when v_admin then v_rejected else 0 end,
    'ingest_attention', case when v_admin and v_ingest_available then v_ingest else null end,
    'ingest_available', v_admin and v_ingest_available,
    'ingest_unavailable', case
      when v_admin and not v_ingest_available then 'ingest_unavailable'
      else null
    end
  );
end;
$$;

revoke all on function public.get_admin_dashboard_summary() from public, anon;
grant execute on function public.get_admin_dashboard_summary() to authenticated;

comment on function public.get_admin_dashboard_summary() is
  'PERF-ADMIN-SHELL-SUMMARY-01: contagens do painel numa query de jobs, após can_review_curation_aal2(). Campos de admin exigem is_admin_aal2. Sem contagem inteira, ingest_available é false, ingest_attention é null e ingest_unavailable é o código estável. A causa fica só no log do servidor, com sqlstate, sem a mensagem SQL.';

notify pgrst, 'reload schema';
