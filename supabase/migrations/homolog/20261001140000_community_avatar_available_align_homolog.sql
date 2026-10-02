-- UX-COMMUNITY-PROFILES-01 — homolog-only: alinha avatar_available com community_avatar_storage_path.
-- Homologação: aplicar após held/20261001120000_ux_community_profiles_01.sql.
-- Produção: não aplicar.

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

drop trigger if exists sync_community_profile_after_profile_update on public.profiles;
create trigger sync_community_profile_after_profile_update
  after update of full_name, headline, bio, skills, preferences, role, avatar_path on public.profiles
  for each row execute function private.sync_community_profile_after_update();
