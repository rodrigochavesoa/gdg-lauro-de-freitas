-- ADMIN-JOB-DELETE-01: audita o hard delete no mesmo commit da remoção.
-- A policy existente continua exigindo admin + AAL2 para DELETE em jobs.

create or replace function public.redact_audit_metadata(p_metadata jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce((
    select jsonb_object_agg(entry.key, entry.value)
    from jsonb_each(coalesce(p_metadata, '{}'::jsonb)) as entry(key, value)
    where entry.key in ('reason', 'effect', 'fields', 'error_code', 'purpose_version', 'source', 'title', 'job_id')
      and (
        (entry.key = 'fields' and jsonb_typeof(entry.value) = 'array')
        or (entry.key <> 'fields' and jsonb_typeof(entry.value) = 'string')
      )
  ), '{}'::jsonb);
$$;

create or replace function public.audit_admin_job_delete()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.is_admin_aal2() then
    raise exception 'AAL2 required' using errcode = '42501';
  end if;

  perform public.write_privacy_audit_event(
    'admin.job_deleted',
    'F-10',
    'job',
    old.id::text,
    'success',
    jsonb_build_object('job_id', old.id::text, 'title', old.title),
    v_actor
  );
  return old;
end;
$$;

revoke all on function public.audit_admin_job_delete() from public, anon, authenticated;

drop trigger if exists audit_admin_job_deleted on public.jobs;
create trigger audit_admin_job_deleted
  after delete on public.jobs
  for each row
  execute function public.audit_admin_job_delete();

comment on function public.audit_admin_job_delete() is
  'ADMIN-JOB-DELETE-01: grava admin.job_deleted com job id, título e actor na transação do DELETE AAL2.';
