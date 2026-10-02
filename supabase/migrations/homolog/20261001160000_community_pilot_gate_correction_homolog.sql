-- Correct the already-applied 20261001130000 pilot migration in shared Homolog.
-- Keep the pilot operational while restoring F-11's formal states to pending_dpo.
-- Homolog-only; never add to the production manifest.

create table if not exists private.community_pilot_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table private.community_pilot_settings enable row level security;
revoke all on table private.community_pilot_settings from public, anon, authenticated, service_role;
insert into private.community_pilot_settings (singleton, enabled)
values (true, false)
on conflict (singleton) do nothing;

create or replace function private.community_pilot_enabled()
returns boolean
language sql stable security definer
set search_path = private
as $$
  select coalesce((select enabled from private.community_pilot_settings where singleton), false);
$$;
revoke all on function private.community_pilot_enabled() from public, anon, authenticated, service_role;

create or replace function public.set_community_pilot_enabled(p_enabled boolean)
returns boolean
language plpgsql security definer
set search_path = private
as $$
begin
  if p_enabled is null then raise exception 'invalid community pilot setting'; end if;
  update private.community_pilot_settings
  set enabled = p_enabled, updated_at = clock_timestamp()
  where singleton;
  return found;
end;
$$;
revoke all on function public.set_community_pilot_enabled(boolean) from public, anon, authenticated;
grant execute on function public.set_community_pilot_enabled(boolean) to service_role;

create or replace function public.get_community_pilot_enabled()
returns boolean
language sql stable security definer
set search_path = private
as $$
  select private.community_pilot_enabled();
$$;
revoke all on function public.get_community_pilot_enabled() from public, anon, authenticated;
grant execute on function public.get_community_pilot_enabled() to service_role;

create or replace function private.cleanup_community_when_pilot_disabled()
returns trigger
language plpgsql security definer
set search_path = public, private
as $$
declare
  v_event record;
begin
  if old.enabled and not new.enabled and not exists (
    select 1 from public.privacy_purposes p
    where p.purpose_code = 'F-11' and p.status = 'active'
      and p.legal_basis_status = 'approved'
      and p.retention_status = 'approved'
      and p.text_status = 'approved'
  ) then
    for v_event in
      with latest_acceptance as (
        select distinct on (e.subject_id) e.subject_id, e.event_type
        from public.privacy_consent_events e
        where e.purpose_code = 'F-11'
        order by e.subject_id, e.created_at desc, e.id desc
      ), erased as (
        insert into public.privacy_consent_events (
          subject_id, purpose_code, purpose_version, event_type, source, proof
        )
        select c.subject_id, 'F-11', p.version, 'revoked', 'system',
          jsonb_build_object('source', 'system', 'purpose_version', p.version, 'effect', 'community_pilot_disabled')
        from public.community_profiles c
        join latest_acceptance a on a.subject_id = c.subject_id and a.event_type = 'accepted'
        join lateral (
          select version from public.privacy_purposes
          where purpose_code = 'F-11' order by version desc limit 1
        ) p on true
        returning subject_id, id
      ) select subject_id, id from erased
    loop
      perform public.write_privacy_audit_event(
        'consent.revoked', 'F-11', 'consent', v_event.id::text, 'revoked',
        jsonb_build_object('effect', 'community_pilot_disabled', 'source', 'system'), v_event.subject_id
      );
    end loop;
    delete from public.community_profiles;
  end if;
  return new;
end;
$$;
revoke all on function private.cleanup_community_when_pilot_disabled() from public, anon, authenticated, service_role;
drop trigger if exists cleanup_community_when_pilot_disabled on private.community_pilot_settings;
create trigger cleanup_community_when_pilot_disabled
  after update of enabled on private.community_pilot_settings
  for each row execute function private.cleanup_community_when_pilot_disabled();

-- If formal approval is removed while the pilot flag remains enabled, the pilot
-- is still the active authorization path. Turning the flag off performs cleanup.
create or replace function private.disable_community_after_purpose_change()
returns trigger
language plpgsql security definer
set search_path = public, private
as $$
declare
  v_event record;
begin
  if old.purpose_code = 'F-11'
    and old.status = 'active'
    and old.legal_basis_status = 'approved'
    and old.retention_status = 'approved'
    and old.text_status = 'approved'
    and not (
      new.status = 'active'
      and new.legal_basis_status = 'approved'
      and new.retention_status = 'approved'
      and new.text_status = 'approved'
    )
    and not private.community_pilot_enabled() then
    for v_event in
      with latest_acceptance as (
        select distinct on (e.subject_id) e.subject_id, e.event_type, e.purpose_version
        from public.privacy_consent_events e
        where e.purpose_code = 'F-11'
        order by e.subject_id, e.created_at desc, e.id desc
      ), erased as (
        insert into public.privacy_consent_events (
          subject_id, purpose_code, purpose_version, event_type, source, proof
        )
        select c.subject_id, 'F-11', new.version, 'revoked', 'system',
          jsonb_build_object('source', 'system', 'purpose_version', new.version, 'effect', 'community_disabled')
        from public.community_profiles c
        join latest_acceptance a on a.subject_id = c.subject_id and a.event_type = 'accepted'
        returning subject_id, id
      ) select subject_id, id from erased
    loop
      perform public.write_privacy_audit_event(
        'consent.revoked', 'F-11', 'consent', v_event.id::text, 'revoked',
        jsonb_build_object('effect', 'community_disabled', 'source', 'system'), v_event.subject_id
      );
    end loop;
    delete from public.community_profiles;
  end if;
  return new;
end;
$$;
revoke all on function private.disable_community_after_purpose_change() from public, anon, authenticated, service_role;

create or replace function private.community_purpose_enabled()
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select exists (
    select 1 from public.privacy_purposes p
    where p.purpose_code = 'F-11' and p.status = 'active'
      and (
        (p.legal_basis_status = 'approved' and p.retention_status = 'approved' and p.text_status = 'approved')
        or private.community_pilot_enabled()
      )
  );
$$;
revoke all on function private.community_purpose_enabled() from public, anon, authenticated, service_role;

create or replace function private.community_subject_consented(p_subject_id uuid)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.privacy_purposes p
    join lateral (
      select e.event_type, e.purpose_version
      from public.privacy_consent_events e
      where e.subject_id = p_subject_id and e.purpose_code = p.purpose_code
      order by e.created_at desc, e.id desc limit 1
    ) latest on true
    where p.purpose_code = 'F-11' and p.status = 'active'
      and (
        (p.legal_basis_status = 'approved' and p.retention_status = 'approved' and p.text_status = 'approved')
        or private.community_pilot_enabled()
      )
      and latest.event_type = 'accepted' and latest.purpose_version = p.version
  );
$$;
revoke all on function private.community_subject_consented(uuid) from public, anon, authenticated, service_role;

create or replace function public.set_community_profile_publication(p_published boolean)
returns boolean
language plpgsql security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_latest record;
  v_purpose record;
  v_purpose_version integer;
  v_event_id uuid;
  v_profile_ready boolean;
  v_has_current_consent boolean;
  v_purpose_approved boolean := false;
  v_pilot_enabled boolean := false;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if p_published is null then raise exception 'invalid community publication choice'; end if;

  -- Lock order: F-11, pilot setting, profile. A concurrent disable then either
  -- waits for publish and cleans it, or commits first and makes publish fail.
  select p.version, p.status, p.legal_basis_status, p.retention_status, p.text_status
  into v_purpose from public.privacy_purposes p
  where p.purpose_code = 'F-11' order by p.version desc limit 1 for share;
  v_purpose_version := v_purpose.version;
  select enabled into v_pilot_enabled
  from private.community_pilot_settings where singleton for share;
  v_pilot_enabled := coalesce(v_pilot_enabled, false);
  v_purpose_approved := v_purpose.status = 'active' and (
    (v_purpose.legal_basis_status = 'approved'
      and v_purpose.retention_status = 'approved'
      and v_purpose.text_status = 'approved') or v_pilot_enabled
  );

  select p.role = 'candidate' and length(trim(p.full_name)) > 0
  into v_profile_ready from public.profiles p where p.id = v_uid for update;

  if not p_published then
    delete from public.community_profiles where subject_id = v_uid;
    select e.event_type, e.id into v_latest
    from public.privacy_consent_events e
    where e.subject_id = v_uid and e.purpose_code = 'F-11'
    order by e.created_at desc, e.id desc limit 1;
    if v_latest.event_type = 'accepted' then
      insert into public.privacy_consent_events (
        subject_id, purpose_code, purpose_version, event_type, source, proof
      ) values (
        v_uid, 'F-11', v_purpose_version, 'revoked', 'preferences',
        jsonb_build_object('source', 'preferences', 'purpose_version', v_purpose_version, 'effect', 'community_unpublished')
      ) returning id into v_event_id;
      perform public.write_privacy_audit_event(
        'consent.revoked', 'F-11', 'consent', v_event_id::text, 'revoked',
        jsonb_build_object('effect', 'community_unpublished', 'source', 'preferences'), v_uid
      );
    end if;
    return true;
  end if;

  if v_profile_ready is null or not private.community_access_allowed(v_uid) then raise exception 'authentication required'; end if;
  if not coalesce(v_profile_ready, false) then raise exception 'community profile incomplete'; end if;
  if not v_purpose_approved then raise exception 'community approval pending' using errcode = 'PT503'; end if;

  select e.event_type = 'accepted' and e.purpose_version = v_purpose_version
  into v_has_current_consent
  from public.privacy_consent_events e
  where e.subject_id = v_uid and e.purpose_code = 'F-11'
  order by e.created_at desc, e.id desc limit 1;
  if not coalesce(v_has_current_consent, false) then
    perform public.record_privacy_event('F-11', 'accepted', 'preferences');
  end if;
  perform private.refresh_community_profile_projection(v_uid);
  return exists (select 1 from public.community_profiles c where c.subject_id = v_uid);
end;
$$;
revoke all on function public.set_community_profile_publication(boolean) from public, anon;
grant execute on function public.set_community_profile_publication(boolean) to authenticated;

-- Enable the explicitly authorized shared pilot before resetting old approved
-- statuses, so the existing cleanup trigger does not revoke live pilot opt-ins.
update private.community_pilot_settings
set enabled = true, updated_at = clock_timestamp()
where singleton;

update public.privacy_purposes
set status = 'active', legal_basis_status = 'pending_dpo',
    retention_status = 'pending_dpo', text_status = 'pending_dpo'
where purpose_code = 'F-11' and version = 2;
