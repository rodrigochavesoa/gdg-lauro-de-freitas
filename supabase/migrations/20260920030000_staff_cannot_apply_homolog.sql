-- SEC-STAFF-APPLY-01: apply/withdraw só para candidate.
-- Homologação: aplicar nesta história.
-- Produção: não aplicar (Camada B / PO). Fora de prod.manifest.json.
-- Rollback: restaurar o corpo de apply_to_job / withdraw_application em
--   20260914024020_privacy_audit.sql (sem o guarda de papel staff).

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

  if v_profile.role in ('admin', 'curator', 'moderator') then
    raise exception 'staff cannot apply';
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

  -- F-03 registra o processamento interno da candidatura. Não autoriza Gemini, Resend nem novo consumidor externo.
  perform public.write_privacy_audit_event(
    'application.created',
    'F-03',
    'application',
    v_application.id::text,
    'success',
    '{}'::jsonb,
    v_uid
  );

  return to_jsonb(v_application);
exception
  when unique_violation then
    return jsonb_build_object('error', 'already applied');
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
  v_role text;
  v_job public.jobs%rowtype;
  v_application public.applications%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select role into v_role
  from public.profiles
  where id = v_uid;

  if found and v_role in ('admin', 'curator', 'moderator') then
    raise exception 'staff cannot withdraw';
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

  perform public.write_privacy_audit_event(
    'application.withdrawn',
    'F-03',
    'application',
    v_application.id::text,
    'success',
    jsonb_build_object('effect', 'blocked'),
    v_uid
  );

  return to_jsonb(v_application);
end;
$$;

revoke all on function public.apply_to_job(uuid) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated;

revoke all on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.withdraw_application(uuid) to authenticated;

comment on function public.apply_to_job(uuid) is
  'SEC-STAFF-APPLY-01: candidatura 1-clique. Recusa admin/curator/moderator (staff cannot apply).';
comment on function public.withdraw_application(uuid) is
  'SEC-STAFF-APPLY-01: retirada. Recusa admin/curator/moderator (staff cannot withdraw).';
