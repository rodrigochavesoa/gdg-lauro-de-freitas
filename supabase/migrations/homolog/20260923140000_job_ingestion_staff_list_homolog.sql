-- PERF-STAFF-LISTS-LIMIT-01: lista enxuta e contagem de atenção.
-- Homologação: aplicar nesta história.
-- Produção: não aplicar (Camada B / PO). Fora de prod.manifest.json.
-- Não cria índice. Não altera policies, RPCs de processo nem grants das tabelas base.
-- Predicado “precisa atenção”: docs-local/tech/INGEST-ATTENTION-CONTRACT.md
-- Rollback:
--   drop function if exists public.count_job_ingestions_needing_attention();
--   drop view if exists public.job_ingestion_staff_list;

create or replace view public.job_ingestion_staff_list
with (security_invoker = true) as
select
  i.id,
  i.source_kind,
  i.normalized_locator,
  i.expires_at,
  i.job_id,
  i.created_at,
  i.canonical_payload ->> 'title' as payload_title,
  j.title as job_title,
  j.status as job_status,
  latest.outcome as latest_outcome
from public.job_ingestions i
left join public.jobs j on j.id = i.job_id
left join lateral (
  select a.outcome
  from public.job_ingestion_attempts a
  where a.ingestion_id = i.id
  order by a.created_at desc, a.id desc
  limit 1
) latest on true;

comment on view public.job_ingestion_staff_list is
  'Lista staff sem canonical_payload e sem o histórico de tentativas. payload_title e latest_outcome bastam para a listagem. Contrato de atenção: docs-local/tech/INGEST-ATTENTION-CONTRACT.md.';

revoke all on table public.job_ingestion_staff_list from public, anon, authenticated;
grant select on table public.job_ingestion_staff_list to authenticated;

create or replace function public.count_job_ingestions_needing_attention()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.job_ingestion_staff_list
  where (latest_outcome is null and job_id is null)
     or latest_outcome in ('failed', 'expired');
$$;

revoke all on function public.count_job_ingestions_needing_attention() from public, anon;
grant execute on function public.count_job_ingestions_needing_attention() to authenticated;

comment on function public.count_job_ingestions_needing_attention() is
  'Contagem server-side: sem tentativa e sem job, ou última tentativa failed/expired. RLS via security invoker. Contrato: docs-local/tech/INGEST-ATTENTION-CONTRACT.md.';
