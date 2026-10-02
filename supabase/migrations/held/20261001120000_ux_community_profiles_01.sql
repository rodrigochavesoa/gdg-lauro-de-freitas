-- UX-COMMUNITY-PROFILES-01 — projeção privada da Comunidade e gate F-11.
-- Produção: não aplicar. A finalidade F-11 permanece inativa/pending_dpo.
-- Escopo do piloto Homolog/Preview aprovado pelo PO em 2026-10-01: opt-in,
-- audiência autenticada, remoção ao revogar/excluir e limpeza das fixtures.
-- Isso não altera os gates formais de finalidade: status permanece pending_dpo.
-- Nenhum GRANT para anon nem acesso direto às tabelas da projeção.
--
-- Futuro modo público exige revisão de segurança e migration explícita para a
-- configuração do gate e EXECUTE apenas nas RPCs de leitura apropriadas. Não
-- alterar RLS/grants de profiles, Storage ou a flag do frontend para abrir acesso.

insert into public.privacy_purposes (
  purpose_code, version, title, specific_description, classification, status,
  legal_basis_status, retention_status, text_status, revocation_effect
) values (
  'F-11', 2,
  'Compartilhar seu perfil profissional na Comunidade GDG Jobs',
  'Por escolha opcional e desligada por padrão, exibir aos membros autenticados da Comunidade GDG Jobs o nome, foto de perfil (se houver), título profissional, competências, localização, experiência, modelo de trabalho, apresentação e links profissionais para descoberta e conexões. Não exibir e-mail, telefone, currículo, UID, papel ou preferências privadas. A publicação permanece enquanto o titular mantiver o opt-in; revogação ou exclusão da conta remove a projeção e bloqueia novas entregas do avatar. Cópias já obtidas por membros não podem ser recolhidas. A base legal, retenção geral e texto final permanecem sujeitos ao gate formal do projeto.',
  'optional_consent', 'inactive', 'pending_dpo', 'pending_dpo', 'pending_dpo',
  'Retirar a publicação remove o perfil das consultas da Comunidade e bloqueia a entrega da foto; URLs ou cópias já obtidas por terceiros não podem ser recolhidas.'
)
on conflict (purpose_code, version) do update set
  status = 'inactive',
  legal_basis_status = 'pending_dpo',
  retention_status = 'pending_dpo',
  text_status = 'pending_dpo';

create table private.community_access_settings (
  singleton boolean primary key default true check (singleton),
  audience text not null check (audience in ('authenticated', 'public')),
  updated_at timestamptz not null default now()
);

alter table private.community_access_settings enable row level security;
revoke all on table private.community_access_settings from public, anon, authenticated, service_role;
insert into private.community_access_settings (singleton, audience)
values (true, 'authenticated')
on conflict (singleton) do update set audience = 'authenticated', updated_at = now();

-- Separates the temporary Homolog/Preview authorization from formal privacy approval.
-- Production and clean held installs remain disabled until an admin migration enables it.
create table private.community_pilot_settings (
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
language sql
stable
security definer
set search_path = private
as $$
  select coalesce((select enabled from private.community_pilot_settings where singleton), false);
$$;
revoke all on function private.community_pilot_enabled() from public, anon, authenticated, service_role;

-- Narrow service-role control exists for isolated RLS fixtures and backend operations only.
create or replace function public.set_community_pilot_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
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
language sql
stable
security definer
set search_path = private
as $$
  select private.community_pilot_enabled();
$$;
revoke all on function public.get_community_pilot_enabled() from public, anon, authenticated;
grant execute on function public.get_community_pilot_enabled() to service_role;

create or replace function private.cleanup_community_when_pilot_disabled()
returns trigger
language plpgsql
security definer
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
        select distinct on (e.subject_id)
          e.subject_id, e.event_type
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

create table public.community_profiles (
  public_id uuid primary key default extensions.gen_random_uuid(),
  subject_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  headline text check (headline is null or length(headline) <= 160),
  bio text check (bio is null or length(bio) <= 2000),
  skills text[] not null default '{}',
  location text check (location is null or length(location) <= 120),
  experience_level text check (experience_level is null or length(experience_level) <= 40),
  work_model text check (work_model is null or work_model in ('remote', 'hybrid', 'onsite')),
  linkedin_url text check (linkedin_url is null or (length(linkedin_url) <= 2048 and linkedin_url ~* '^https://[^[:space:]]+$')),
  github_url text check (github_url is null or (length(github_url) <= 2048 and github_url ~* '^https://[^[:space:]]+$')),
  portfolio_url text check (portfolio_url is null or (length(portfolio_url) <= 2048 and portfolio_url ~* '^https://[^[:space:]]+$')),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.community_profiles is
  'UX-COMMUNITY-PROFILES-01: projeção interna com allowlist. Sem grants de leitura/escrita à Data API; acesso somente por RPCs restritas.';
comment on column public.community_profiles.subject_id is
  'Identificador interno de titular; nunca retornado pela Data API nem pelo DTO da Comunidade.';

create index community_profiles_publication_order_idx
  on public.community_profiles (published_at desc, public_id desc);

alter table public.community_profiles enable row level security;
revoke all on table public.community_profiles from public, anon, authenticated, service_role;

create table public.community_read_budgets (
  subject_id uuid primary key references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 60)
);
alter table public.community_read_budgets enable row level security;
revoke all on table public.community_read_budgets from public, anon, authenticated, service_role;
comment on table public.community_read_budgets is
  'UX-COMMUNITY-PROFILES-01: contador mínimo por titular, uma janela fixa de 60 segundos; sem IP ou conteúdo consultado.';

create or replace function private.community_access_allowed(p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce((
    select s.audience = 'public'
      or (s.audience = 'authenticated' and p_viewer_id is not null)
    from private.community_access_settings s
    where s.singleton
  ), false);
$$;
revoke all on function private.community_access_allowed(uuid) from public, anon, authenticated, service_role;

create or replace function private.community_purpose_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
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
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.privacy_purposes p
    join lateral (
      select e.event_type, e.purpose_version
      from public.privacy_consent_events e
      where e.subject_id = p_subject_id
        and e.purpose_code = p.purpose_code
      order by e.created_at desc, e.id desc
      limit 1
    ) latest on true
    where p.purpose_code = 'F-11'
      and p.status = 'active'
      and (
        (p.legal_basis_status = 'approved' and p.retention_status = 'approved' and p.text_status = 'approved')
        or private.community_pilot_enabled()
      )
      and latest.event_type = 'accepted'
      and latest.purpose_version = p.version
  );
$$;
revoke all on function private.community_subject_consented(uuid) from public, anon, authenticated, service_role;

create or replace function private.consume_community_read_budget(p_subject_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('minute', clock_timestamp());
  v_count integer;
begin
  if p_subject_id is null then return false; end if;

  insert into public.community_read_budgets (subject_id, window_started_at, request_count)
  values (p_subject_id, v_window, 1)
  on conflict (subject_id) do update
    set window_started_at = excluded.window_started_at,
        request_count = case
          when public.community_read_budgets.window_started_at < excluded.window_started_at then 1
          else public.community_read_budgets.request_count + 1
        end
    where public.community_read_budgets.window_started_at < excluded.window_started_at
       or public.community_read_budgets.request_count < 60
  returning request_count into v_count;

  return found;
end;
$$;
revoke all on function private.consume_community_read_budget(uuid) from public, anon, authenticated, service_role;

create or replace function private.refresh_community_profile_projection(p_subject_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = p_subject_id and p.role = 'candidate'
  ) then
    delete from public.community_profiles where subject_id = p_subject_id;
    return;
  end if;

  insert into public.community_profiles (
    subject_id, full_name, headline, bio, skills, location,
    experience_level, work_model, linkedin_url, github_url, portfolio_url,
    published_at, updated_at
  )
  select
    p.id,
    left(trim(p.full_name), 120),
    nullif(left(trim(coalesce(p.headline, '')), 160), ''),
    nullif(left(coalesce(p.bio, ''), 2000), ''),
    coalesce((
      select array_agg(left(trim(skill), 80) order by skill_order)
      from (
        select value as skill, ordinality as skill_order
        from unnest(coalesce(p.skills, '{}'::text[])) with ordinality as skill_rows(value, ordinality)
        where length(trim(value)) > 0
        order by ordinality
        limit 30
      ) limited_skills
    ), '{}'::text[]),
    nullif(left(trim(coalesce(p.preferences ->> 'location', '')), 120), ''),
    nullif(left(trim(coalesce(p.preferences ->> 'experience_level', '')), 40), ''),
    case when p.preferences ->> 'work_model' in ('remote', 'hybrid', 'onsite') then p.preferences ->> 'work_model' else null end,
    case when coalesce(p.preferences ->> 'linkedin', '') ~* '^https://[^[:space:]]+$' then left(p.preferences ->> 'linkedin', 2048) else null end,
    case when coalesce(p.preferences ->> 'github', '') ~* '^https://[^[:space:]]+$' then left(p.preferences ->> 'github', 2048) else null end,
    case when coalesce(p.preferences ->> 'portfolio_url', '') ~* '^https://[^[:space:]]+$' then left(p.preferences ->> 'portfolio_url', 2048) else null end,
    clock_timestamp(), clock_timestamp()
  from public.profiles p
  where p.id = p_subject_id and p.role = 'candidate'
  on conflict (subject_id) do update set
    full_name = excluded.full_name,
    headline = excluded.headline,
    bio = excluded.bio,
    skills = excluded.skills,
    location = excluded.location,
    experience_level = excluded.experience_level,
    work_model = excluded.work_model,
    linkedin_url = excluded.linkedin_url,
    github_url = excluded.github_url,
    portfolio_url = excluded.portfolio_url,
    updated_at = clock_timestamp();
end;
$$;
revoke all on function private.refresh_community_profile_projection(uuid) from public, anon, authenticated, service_role;

create or replace function private.sync_community_profile_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if exists (select 1 from public.community_profiles c where c.subject_id = new.id) then
    perform private.refresh_community_profile_projection(new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.sync_community_profile_after_update() from public, anon, authenticated, service_role;
drop trigger if exists sync_community_profile_after_profile_update on public.profiles;
create trigger sync_community_profile_after_profile_update
  after update of full_name, headline, bio, skills, preferences, role, avatar_path on public.profiles
  for each row execute function private.sync_community_profile_after_update();

create or replace function private.erase_community_projection_after_revoke()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.purpose_code = 'F-11' and new.event_type in ('refused', 'revoked') then
    delete from public.community_profiles where subject_id = new.subject_id;
  end if;
  return new;
end;
$$;
revoke all on function private.erase_community_projection_after_revoke() from public, anon, authenticated, service_role;
drop trigger if exists erase_community_projection_after_revoke on public.privacy_consent_events;
create trigger erase_community_projection_after_revoke
  after insert on public.privacy_consent_events
  for each row execute function private.erase_community_projection_after_revoke();

create or replace function private.lock_community_consent_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.purpose_code = 'F-11' then
    perform 1 from public.profiles p where p.id = new.subject_id for update;
  end if;
  return new;
end;
$$;
revoke all on function private.lock_community_consent_subject() from public, anon, authenticated, service_role;
drop trigger if exists lock_community_consent_subject on public.privacy_consent_events;
create trigger lock_community_consent_subject
  before insert on public.privacy_consent_events
  for each row execute function private.lock_community_consent_subject();

create or replace function private.disable_community_after_purpose_change()
returns trigger
language plpgsql
security definer
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
    and not private.community_pilot_enabled()
    and not (
      new.status = 'active'
      and new.legal_basis_status = 'approved'
      and new.retention_status = 'approved'
      and new.text_status = 'approved'
    ) then
    for v_event in
      with latest_acceptance as (
        select distinct on (e.subject_id)
          e.subject_id, e.event_type, e.purpose_version
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
drop trigger if exists disable_community_after_purpose_change on public.privacy_purposes;
create trigger disable_community_after_purpose_change
  after update of status, legal_basis_status, retention_status, text_status on public.privacy_purposes
  for each row execute function private.disable_community_after_purpose_change();

-- Fail closed even if a later F-11 version already exists in this environment.
update public.privacy_purposes
set status = 'inactive',
    legal_basis_status = 'pending_dpo',
    retention_status = 'pending_dpo',
    text_status = 'pending_dpo'
where purpose_code = 'F-11'
  and (status <> 'inactive' or legal_basis_status <> 'pending_dpo'
    or retention_status <> 'pending_dpo' or text_status <> 'pending_dpo');

create or replace function public.get_community_feature_status()
returns jsonb
 language plpgsql
 volatile
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_can_publish boolean;
  v_published boolean;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if not private.consume_community_read_budget(v_uid) then
    raise exception 'community rate limit exceeded' using errcode = 'PT429';
  end if;
  if not private.community_purpose_enabled() then
    return jsonb_build_object('available', false, 'reason', 'approval_pending', 'published', false, 'can_publish', false);
  end if;

  select p.role = 'candidate' and length(trim(p.full_name)) > 0
  into v_can_publish from public.profiles p where p.id = v_uid;
  v_can_publish := coalesce(v_can_publish, false);
  v_published := v_can_publish
    and private.community_subject_consented(v_uid)
    and exists (select 1 from public.community_profiles c where c.subject_id = v_uid);
  return jsonb_build_object(
    'available', true,
    'reason', null,
    'published', coalesce(v_published, false),
    'can_publish', v_can_publish
  );
end;
$$;
revoke all on function public.get_community_feature_status() from public, anon;
grant execute on function public.get_community_feature_status() to authenticated;

create or replace function private.community_profile_avatar_available(p_avatar_path text, p_subject_id uuid)
returns boolean
language sql
immutable
as $$
  select p_avatar_path is not null
    and p_avatar_path ~ ('^' || p_subject_id::text || '/[A-Za-z0-9._-]+[.]jpg$')
    and position('..' in p_avatar_path) = 0;
$$;
revoke all on function private.community_profile_avatar_available(text, uuid) from public, anon, authenticated, service_role;

create or replace function public.list_community_profiles(
  p_limit integer default 24,
  p_before_id uuid default null,
  p_before_published_at timestamptz default null
)
returns table (
  public_id uuid,
  full_name text,
  headline text,
  skills text[],
  location text,
  experience_level text,
  work_model text,
  avatar_available boolean,
  published_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 24);
begin
  if v_uid is null or not private.community_access_allowed(v_uid) then raise exception 'authentication required'; end if;
  if (p_before_id is null) <> (p_before_published_at is null) then raise exception 'invalid community cursor'; end if;
  if not private.consume_community_read_budget(v_uid) then
    raise exception 'community rate limit exceeded' using errcode = 'PT429';
  end if;
  if not private.community_purpose_enabled() then
    raise exception 'community approval pending' using errcode = 'PT503';
  end if;

  return query
  select c.public_id, c.full_name, c.headline, c.skills, c.location, c.experience_level, c.work_model,
    private.community_profile_avatar_available(p.avatar_path, p.id), c.published_at
  from public.community_profiles c
  join public.profiles p on p.id = c.subject_id
  where private.community_subject_consented(c.subject_id)
    and (p_before_id is null or (c.published_at, c.public_id) < (p_before_published_at, p_before_id))
  order by c.published_at desc, c.public_id desc
  limit v_limit;
end;
$$;
revoke all on function public.list_community_profiles(integer, uuid, timestamptz) from public, anon;
grant execute on function public.list_community_profiles(integer, uuid, timestamptz) to authenticated;

create or replace function public.get_community_profile(p_public_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not private.community_access_allowed(v_uid) then raise exception 'authentication required'; end if;
  if not private.consume_community_read_budget(v_uid) then
    raise exception 'community rate limit exceeded' using errcode = 'PT429';
  end if;
  if not private.community_purpose_enabled() then
    raise exception 'community approval pending' using errcode = 'PT503';
  end if;

  select jsonb_build_object(
    'public_id', c.public_id,
    'full_name', c.full_name,
    'headline', c.headline,
    'skills', c.skills,
    'location', c.location,
    'experience_level', c.experience_level,
    'work_model', c.work_model,
    'avatar_available', private.community_profile_avatar_available(p.avatar_path, p.id),
    'published_at', c.published_at,
    'bio', c.bio,
    'linkedin_url', c.linkedin_url,
    'github_url', c.github_url,
    'portfolio_url', c.portfolio_url
  ) into v_result
  from public.community_profiles c
  join public.profiles p on p.id = c.subject_id
  where c.public_id = p_public_id and private.community_subject_consented(c.subject_id);
  return v_result;
end;
$$;
revoke all on function public.get_community_profile(uuid) from public, anon;
grant execute on function public.get_community_profile(uuid) to authenticated;

create or replace function public.set_community_profile_publication(p_published boolean)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_latest record;
  v_purpose_version integer;
  v_event_id uuid;
  v_profile_ready boolean;
  v_has_current_consent boolean;
  v_purpose_approved boolean := false;
  v_pilot_enabled boolean := false;
  v_purpose record;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if p_published is null then raise exception 'invalid community publication choice'; end if;

  -- Lock in one order: F-11, pilot setting, then subject profile. Thus pilot
  -- disable waits for an in-flight publication and cleans it after commit.
  select p.version, p.status, p.legal_basis_status, p.retention_status, p.text_status
  into v_purpose
  from public.privacy_purposes p
  where p.purpose_code = 'F-11'
  order by p.version desc limit 1
  for share;
  v_purpose_version := v_purpose.version;

  select enabled into v_pilot_enabled
  from private.community_pilot_settings
  where singleton
  for share;
  v_pilot_enabled := coalesce(v_pilot_enabled, false);
  v_purpose_approved := v_purpose.status = 'active' and (
    (v_purpose.legal_basis_status = 'approved'
      and v_purpose.retention_status = 'approved'
      and v_purpose.text_status = 'approved')
    or v_pilot_enabled
  );

  -- Serialize both publish and revoke, including concurrent F-11 events.
  select p.role = 'candidate' and length(trim(p.full_name)) > 0
  into v_profile_ready
  from public.profiles p
  where p.id = v_uid
  for update;

  if not p_published then
    delete from public.community_profiles where subject_id = v_uid;
    select e.event_type, e.id into v_latest
    from public.privacy_consent_events e
    where e.subject_id = v_uid and e.purpose_code = 'F-11'
    order by e.created_at desc, e.id desc limit 1;
    if v_latest.event_type = 'accepted' then
      select max(version) into v_purpose_version from public.privacy_purposes where purpose_code = 'F-11';
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
  if not coalesce(v_profile_ready, false) then
    raise exception 'community profile incomplete';
  end if;
  if not v_purpose_approved then
    raise exception 'community approval pending' using errcode = 'PT503';
  end if;

  select e.event_type = 'accepted' and e.purpose_version = v_purpose_version
  into v_has_current_consent
  from public.privacy_consent_events e
  where e.subject_id = v_uid and e.purpose_code = 'F-11'
  order by e.created_at desc, e.id desc
  limit 1;

  -- The explicit opt-in is idempotent. A new acceptance/audit event is created
  -- only when no current-version F-11 consent exists; projection remains atomic.
  if not coalesce(v_has_current_consent, false) then
    perform public.record_privacy_event('F-11', 'accepted', 'preferences');
  end if;
  perform private.refresh_community_profile_projection(v_uid);
  return exists (select 1 from public.community_profiles c where c.subject_id = v_uid);
end;
$$;
revoke all on function public.set_community_profile_publication(boolean) from public, anon;
grant execute on function public.set_community_profile_publication(boolean) to authenticated;

create or replace function public.community_avatar_storage_path(p_public_id uuid, p_viewer_id uuid)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_path text;
begin
  if p_viewer_id is null or not private.community_access_allowed(p_viewer_id) then
    raise exception 'authentication required';
  end if;
  if not private.consume_community_read_budget(p_viewer_id) then
    raise exception 'community rate limit exceeded' using errcode = 'PT429';
  end if;
  if not private.community_purpose_enabled() then return null; end if;

  select p.avatar_path into v_path
  from public.community_profiles c
  join public.profiles p on p.id = c.subject_id
  where c.public_id = p_public_id
    and private.community_subject_consented(c.subject_id)
    and p.avatar_path ~ ('^' || p.id::text || '/[A-Za-z0-9._-]+[.]jpg$')
    and position('..' in p.avatar_path) = 0;
  return v_path;
end;
$$;
revoke all on function public.community_avatar_storage_path(uuid, uuid) from public, anon, authenticated;
grant execute on function public.community_avatar_storage_path(uuid, uuid) to service_role;

comment on function private.community_access_allowed(uuid) is
  'Single server-side visibility gate. Current setting is authenticated only. Public mode requires explicit security review and a separate grants migration.';
comment on function public.community_avatar_storage_path(uuid, uuid) is
  'Service-role-only internal lookup for community-avatar Edge Function. Storage path must never be returned to a browser.';
comment on function public.list_community_profiles(integer, uuid, timestamptz) is
  'Authenticated-only allowlist projection; max 24 rows, opaque UUID cursor, no exact count, shared 60/min per-user read budget.';
