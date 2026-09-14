-- MVP-005: trilha de auditoria mínima e minimização de metadata.
-- Retenção/descarte: pending_dpo — nenhum prazo jurídico hard-coded.
-- Rollback: drop das funções/trigger/tabela listadas no corpo da PR.

create or replace function public.redact_audit_metadata(p_metadata jsonb)
returns jsonb
language sql
immutable
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

create table public.privacy_audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type text not null check (event_type ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  subject_id uuid not null,
  purpose_code text not null check (purpose_code ~ '^F-[0-9]{2}$'),
  resource_type text not null check (length(trim(resource_type)) > 0),
  resource_id text,
  result text not null check (result in ('success', 'blocked', 'failed', 'revoked')),
  metadata_minimal jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata_minimal) = 'object')
    check (metadata_minimal = public.redact_audit_metadata(metadata_minimal)),
  retention_status text not null default 'pending_dpo'
    check (retention_status = 'pending_dpo'),
  created_at timestamptz not null default now()
);

create index privacy_audit_events_subject_occurred_idx
  on public.privacy_audit_events (subject_id, occurred_at desc);

create index privacy_audit_events_purpose_occurred_idx
  on public.privacy_audit_events (purpose_code, occurred_at desc);

comment on table public.privacy_audit_events is
  'MVP-005: auditoria mínima. Sem currículo, bio, snapshot, token, prompt, e-mail ou payload externo. Retenção pending_dpo.';
comment on column public.privacy_audit_events.retention_status is
  'Sem prazo jurídico hard-coded até decisão do DPO/PO.';

alter table public.privacy_audit_events enable row level security;

create policy "Auditoria: leitura do titular"
  on public.privacy_audit_events for select
  using (subject_id = auth.uid());

create policy "Auditoria: leitura administrativa"
  on public.privacy_audit_events for select
  using (public.is_admin());

revoke all on table public.privacy_audit_events from public, anon, authenticated;
grant select on table public.privacy_audit_events to authenticated;

create or replace function public.write_privacy_audit_event(
  p_event_type text,
  p_purpose_code text,
  p_resource_type text,
  p_resource_id text,
  p_result text,
  p_metadata jsonb default '{}'::jsonb,
  p_subject_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_subject uuid := coalesce(p_subject_id, auth.uid());
begin
  if v_subject is null then
    raise exception 'authentication required';
  end if;

  insert into public.privacy_audit_events (
    event_type,
    actor_id,
    subject_id,
    purpose_code,
    resource_type,
    resource_id,
    result,
    metadata_minimal
  ) values (
    p_event_type,
    auth.uid(),
    v_subject,
    upper(trim(p_purpose_code)),
    p_resource_type,
    p_resource_id,
    p_result,
    public.redact_audit_metadata(p_metadata)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_privacy_audit_event(text, text, text, text, text, jsonb, uuid)
  from public, anon, authenticated;

create or replace function public.request_purpose_access(
  p_purpose_code text,
  p_event_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_purpose_code));
  v_authorized boolean;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_event_type not in (
    'recommendation.requested',
    'gemini.profile_match_requested',
    'gemini.job_enrichment_requested'
  ) then
    raise exception 'unsupported audit event';
  end if;

  v_authorized := public.privacy_purpose_is_authorized(v_code);

  if v_authorized then
    perform public.write_privacy_audit_event(
      p_event_type,
      v_code,
      'purpose',
      v_code,
      'success',
      jsonb_build_object('reason', 'authorized'),
      v_uid
    );
    return jsonb_build_object('authorized', true, 'result', 'success');
  end if;

  perform public.write_privacy_audit_event(
    p_event_type,
    v_code,
    'purpose',
    v_code,
    'blocked',
    jsonb_build_object('reason', 'purpose_not_authorized'),
    v_uid
  );
  return jsonb_build_object('authorized', false, 'result', 'blocked');
end;
$$;

revoke all on function public.request_purpose_access(text, text) from public, anon;
grant execute on function public.request_purpose_access(text, text) to authenticated;

create or replace function public.audit_profile_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fields text[] := '{}';
begin
  if NEW.full_name is distinct from OLD.full_name then v_fields := array_append(v_fields, 'full_name'); end if;
  if NEW.headline is distinct from OLD.headline then v_fields := array_append(v_fields, 'headline'); end if;
  if NEW.bio is distinct from OLD.bio then v_fields := array_append(v_fields, 'bio'); end if;
  if NEW.skills is distinct from OLD.skills then v_fields := array_append(v_fields, 'skills'); end if;
  if NEW.preferences is distinct from OLD.preferences then v_fields := array_append(v_fields, 'preferences'); end if;
  if NEW.avatar_path is distinct from OLD.avatar_path then v_fields := array_append(v_fields, 'avatar_path'); end if;

  if coalesce(array_length(v_fields, 1), 0) = 0 then
    return NEW;
  end if;

  perform public.write_privacy_audit_event(
    'profile.updated',
    'F-02',
    'profile',
    NEW.id::text,
    'success',
    jsonb_build_object('fields', to_jsonb(v_fields)),
    NEW.id
  );
  return NEW;
end;
$$;

drop trigger if exists privacy_audit_profile_updated on public.profiles;
create trigger privacy_audit_profile_updated
  after update on public.profiles
  for each row
  execute function public.audit_profile_mutation();

revoke all on function public.audit_profile_mutation() from public, anon, authenticated;

create or replace function public.record_privacy_event(
  p_purpose_code text,
  p_event_type text,
  p_source text default 'preferences'
)
returns public.privacy_consent_events
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_purpose public.privacy_purposes%rowtype;
  v_event public.privacy_consent_events%rowtype;
  v_audit_type text;
  v_audit_result text := 'success';
  v_audit_meta jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_event_type not in ('notice', 'accepted', 'refused', 'revoked') then
    raise exception 'unsupported privacy event';
  end if;

  if p_source not in ('preferences', 'onboarding', 'system') then
    raise exception 'unsupported privacy event source';
  end if;

  select * into v_purpose
  from public.privacy_purposes
  where purpose_code = upper(trim(p_purpose_code))
    and status = 'active'
  order by version desc
  limit 1;

  if not found then
    raise exception 'privacy purpose is not active';
  end if;

  if v_purpose.classification = 'necessary_notice' and p_event_type <> 'notice' then
    raise exception 'necessary purpose accepts notice only';
  end if;

  if v_purpose.classification = 'optional_consent' and p_event_type = 'notice' then
    null;
  end if;

  if p_event_type = 'revoked' and coalesce((
    select event_type
    from public.privacy_consent_events
    where subject_id = v_uid
      and purpose_code = v_purpose.purpose_code
    order by created_at desc
    limit 1
  ), '') <> 'accepted' then
    raise exception 'privacy purpose is not currently accepted';
  end if;

  insert into public.privacy_consent_events (
    subject_id,
    purpose_code,
    purpose_version,
    event_type,
    source,
    proof
  ) values (
    v_uid,
    v_purpose.purpose_code,
    v_purpose.version,
    p_event_type,
    p_source,
    jsonb_build_object('source', p_source, 'purpose_version', v_purpose.version)
  )
  returning * into v_event;

  v_audit_type := case p_event_type
    when 'notice' then 'consent.notice'
    when 'accepted' then 'consent.granted'
    when 'refused' then 'consent.refused'
    else 'consent.revoked'
  end;
  if p_event_type = 'revoked' then
    v_audit_result := 'revoked';
    v_audit_meta := jsonb_build_object('effect', 'blocked', 'source', p_source);
  else
    v_audit_meta := jsonb_build_object('source', p_source, 'purpose_version', v_purpose.version::text);
  end if;

  perform public.write_privacy_audit_event(
    v_audit_type,
    v_purpose.purpose_code,
    'consent',
    v_event.id::text,
    v_audit_result,
    v_audit_meta,
    v_uid
  );

  return v_event;
end;
$$;

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

revoke all on function public.record_privacy_event(text, text, text) from public, anon;
grant execute on function public.record_privacy_event(text, text, text) to authenticated;

revoke all on function public.apply_to_job(uuid) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated;

revoke all on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.withdraw_application(uuid) to authenticated;

comment on function public.write_privacy_audit_event is
  'MVP-005: escrita de auditoria só por funções SECURITY DEFINER. Metadata allowlist.';
comment on function public.request_purpose_access is
  'MVP-005: tenta operação de finalidade opcional e audita blocked sem expor dados profissionais.';
comment on function public.privacy_purpose_is_authorized is
  'Gate de servidor: necessárias ativas ou opcionais com versão aprovada e aceite vigente.';
