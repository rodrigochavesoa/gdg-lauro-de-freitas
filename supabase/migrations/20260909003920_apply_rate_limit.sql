-- F-023 / QA-SEC-06: throttle apply_to_job — 5 calls / 60s per auth.uid().
-- Counts attempts that fail with already applied. Rollback: docs/s6-apply-flow.md.

create table if not exists public.apply_request_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists apply_request_log_user_created_idx
  on public.apply_request_log (user_id, created_at desc);

comment on table public.apply_request_log is
  'F-023: tentativas de apply_to_job por usuário (janela 60s). Sem PII.';

alter table public.apply_request_log enable row level security;

drop policy if exists "apply_request_log: admin" on public.apply_request_log;
create policy "apply_request_log: admin" on public.apply_request_log
  for all
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.apply_request_log from public, anon;
grant select, delete on table public.apply_request_log to authenticated;

create or replace function public.apply_to_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_hits int;
  v_profile public.profiles%rowtype;
  v_job public.jobs%rowtype;
  v_snapshot jsonb;
  v_application public.applications%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  delete from public.apply_request_log
  where user_id = v_uid
    and created_at < now() - interval '60 seconds';

  select count(*)::int into v_hits
  from public.apply_request_log
  where user_id = v_uid;

  if v_hits >= 5 then
    raise exception 'rate limit exceeded' using errcode = 'PT429';
  end if;

  insert into public.apply_request_log (user_id) values (v_uid);

  select email into v_email
  from auth.users
  where id = v_uid;

  if not found or length(trim(coalesce(v_email, ''))) = 0 then
    raise exception 'authentication required';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'profile incomplete';
  end if;

  if not public.profile_meets_d01(
    v_profile.full_name,
    v_email,
    v_profile.skills,
    v_profile.preferences
  ) then
    raise exception 'profile incomplete';
  end if;

  select * into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'job not found';
  end if;

  if v_job.status <> 'approved' then
    raise exception 'job is not approved';
  end if;

  if exists (
    select 1
    from public.applications
    where job_id = p_job_id
      and candidate_id = v_uid
  ) then
    -- RETURN (não RAISE): RAISE abortaria a transação e apagaria o log da tentativa.
    return jsonb_build_object('error', 'already applied');
  end if;

  v_snapshot := jsonb_build_object(
    'full_name', v_profile.full_name,
    'email', v_email,
    'skills', to_jsonb(v_profile.skills),
    'preferences', v_profile.preferences,
    'bio', v_profile.bio
  ) || jsonb_strip_nulls(
    jsonb_build_object(
      'linkedin', nullif(trim(coalesce(v_profile.preferences->>'linkedin', '')), ''),
      'github', nullif(trim(coalesce(v_profile.preferences->>'github', '')), ''),
      'cv_url', nullif(trim(coalesce(v_profile.preferences->>'cv_url', '')), '')
    )
  );

  insert into public.applications (job_id, candidate_id, status, snapshot)
  values (p_job_id, v_uid, 'submitted', v_snapshot)
  returning * into v_application;

  return to_jsonb(v_application);
exception
  when unique_violation then
    return jsonb_build_object('error', 'already applied');
end;
$$;

revoke all on function public.apply_to_job(uuid) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated;

comment on function public.apply_to_job(uuid) is
  'Candidatura 1 clique: sessão + D-01 + vaga approved + UNIQUE; candidate_id = auth.uid(). F-023: máx. 5 chamadas / 60s por usuário (inclui already applied); erro rate limit exceeded (PT429).';
