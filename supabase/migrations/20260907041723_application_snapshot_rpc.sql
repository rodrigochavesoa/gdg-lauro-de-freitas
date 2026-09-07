-- S6-01: snapshot D-08 + RPC apply/withdraw (D-09). UI só via RPC.
-- Rollback documentado em docs/s6-apply-flow.md.

alter table public.applications
  add column if not exists snapshot jsonb not null default '{}'::jsonb;

comment on column public.applications.snapshot is
  'Payload D-08 no momento do apply; não atualiza se o perfil mudar depois.';

-- Completude D-01 no servidor (espelha src/features/auth/profile-completeness.js).
create or replace function public.profile_meets_d01(
  p_full_name text,
  p_email text,
  p_skills text[],
  p_preferences jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    length(trim(coalesce(p_full_name, ''))) > 0
    and length(trim(coalesce(p_email, ''))) > 0
    and coalesce(p_preferences->>'experience_level', '') in ('intern', 'junior', 'mid', 'senior')
    and coalesce(p_preferences->>'work_model', '') in ('remote', 'hybrid', 'onsite')
    and length(trim(coalesce(p_preferences->>'location', ''))) > 0
    and exists (
      select 1
      from unnest(coalesce(p_skills, '{}'::text[])) as skill
      where length(trim(skill)) > 0
    );
$$;

revoke all on function public.profile_meets_d01(text, text, text[], jsonb) from public, anon, authenticated;

create or replace function public.apply_to_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_profile public.profiles%rowtype;
  v_job public.jobs%rowtype;
  v_snapshot jsonb;
  v_application public.applications%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

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
    raise exception 'already applied';
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
    raise exception 'already applied';
end;
$$;

create or replace function public.withdraw_application(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_application public.applications%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
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

  select * into v_application
  from public.applications
  where job_id = p_job_id
    and candidate_id = v_uid
  for update;

  if not found then
    raise exception 'application not found';
  end if;

  if v_application.status not in ('submitted', 'reviewing') then
    raise exception 'cannot withdraw application';
  end if;

  update public.applications
  set status = 'withdrawn',
      updated_at = now()
  where id = v_application.id
  returning * into v_application;

  return to_jsonb(v_application);
end;
$$;

revoke all on function public.apply_to_job(uuid) from public, anon;
revoke all on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;

comment on function public.apply_to_job(uuid) is
  'Candidatura 1 clique: sessão + D-01 + vaga approved + UNIQUE; candidate_id = auth.uid().';
comment on function public.withdraw_application(uuid) is
  'Retira candidatura própria: submitted|reviewing → withdrawn só se a vaga está approved.';

-- Escrita do candidato só via RPC. Admin opera pelas policies existentes.
drop policy if exists "Candidaturas: criação própria" on public.applications;
drop policy if exists "Candidaturas: atualização própria" on public.applications;

create policy "Candidaturas: inserção administrativa" on public.applications
  for insert
  with check (public.is_admin());

create policy "Candidaturas: atualização administrativa" on public.applications
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Candidaturas: exclusão administrativa" on public.applications
  for delete
  using (public.is_admin());

revoke insert, update, delete on public.applications from anon;
grant insert, update, delete on public.applications to authenticated;
