-- SEC-APPLY-RATELIMIT-CONCURRENCY-01: promove o corpo canônico de apply_to_job
-- para a cadeia prod.manifest.json.
-- Supersede, na cadeia do manifesto, o throttle de
--   20260927080000_sec_data_authority_staff_apply.sql
-- (conta sem pg_advisory_xact_lock; RAISE desfaz o hit na mesma transação).
-- O corpo já vale em homolog, aplicado e não reescrito:
--   homolog/20260924140000_apply_rate_limit_raise_homolog.sql
--   homolog/20260927080200_apply_rate_limit_preserve_homolog.sql
-- Esta migration não altera withdraw_application.
-- Não executar supabase db push em Production neste PR.
-- Rollback: nova migration reversa, só com aprovação do Plan.
-- Restaurar o corpo de 20260927080000 não é o rollback recomendado.

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

  perform pg_advisory_xact_lock(hashtext('apply_to_job'), hashtext(v_uid::text));

  delete from public.apply_request_log
  where user_id = v_uid
    and created_at < now() - interval '60 seconds';

  select count(*)::int into v_hits
  from public.apply_request_log
  where user_id = v_uid;

  if v_hits >= 5 then
    raise exception 'rate limit exceeded' using errcode = 'PT429';
  end if;

  begin
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
      insert into public.apply_request_log (user_id) values (v_uid);
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

    perform public.write_privacy_audit_event(
      'application.created',
      'F-03',
      'application',
      v_application.id::text,
      'success',
      '{}'::jsonb,
      v_uid
    );

    insert into public.apply_request_log (user_id) values (v_uid);
    return to_jsonb(v_application);
  exception
    when unique_violation then
      insert into public.apply_request_log (user_id) values (v_uid);
      return jsonb_build_object('error', 'already applied');
    when raise_exception then
      insert into public.apply_request_log (user_id) values (v_uid);
      return jsonb_build_object('error', sqlerrm);
  end;
end;
$$;

revoke all on function public.apply_to_job(uuid) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated;

comment on function public.apply_to_job(uuid) is
  'SEC-DATA-AUTHORITY-01: recusa admin/curator/moderator (staff cannot apply). F-023: máx. 5 chamadas/60s com pg_advisory_xact_lock. SEC-APPLY-RATE-LIMIT-RAISE-01: falha de validação conta no throttle; o teto permanece PT429.';

notify pgrst, 'reload schema';
