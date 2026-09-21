-- SEC-DB-FUNCTION-HARDENING-01: search_path fixo em redact_audit_metadata.
-- Homologação: aplicar nesta história.
-- Produção: não aplicar. Fora de prod.manifest.json.
-- Não revoga EXECUTE das RPCs SECURITY DEFINER usadas pelo frontend.
-- Rollback:
--   restaurar public.redact_audit_metadata sem SET search_path (migration 20260914024020);
--   GRANT EXECUTE ON FUNCTION public.redact_audit_metadata(jsonb) TO PUBLIC;

create or replace function public.redact_audit_metadata(p_metadata jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce((
    select jsonb_object_agg(entry.key, entry.value)
    from jsonb_each(coalesce(p_metadata, '{}'::jsonb)) as entry(key, value)
    where entry.key in ('reason', 'effect', 'fields', 'error_code', 'purpose_version', 'source')
      and (
        (entry.key = 'fields' and jsonb_typeof(entry.value) = 'array')
        or (entry.key <> 'fields' and jsonb_typeof(entry.value) = 'string')
      )
  ), '{}'::jsonb);
$$;

revoke all on function public.redact_audit_metadata(jsonb) from public, anon, authenticated;

comment on function public.redact_audit_metadata(jsonb) is
  'MVP-005: allowlist de metadata de auditoria. search_path vazio; CHECK/SECURITY DEFINER. Sem GRANT Data API.';

notify pgrst, 'reload schema';
