-- UX-COMMUNITY-PROFILES-01 — homolog: extensões de avatar alinhadas ao bucket (jpg/jpeg/png/webp).
-- Homologação: aplicar após 20261001140000_community_avatar_available_align_homolog.sql.
-- Produção: não aplicar.

create or replace function private.community_profile_avatar_available(p_avatar_path text, p_subject_id uuid)
returns boolean
language sql
immutable
as $$
  select p_avatar_path is not null
    and p_avatar_path ~ ('^' || p_subject_id::text || '/[A-Za-z0-9._-]+[.](?:jpg|jpeg|png|webp)$')
    and position('..' in p_avatar_path) = 0;
$$;

revoke all on function private.community_profile_avatar_available(text, uuid) from public, anon, authenticated, service_role;

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
    and p.avatar_path ~ ('^' || p.id::text || '/[A-Za-z0-9._-]+[.](?:jpg|jpeg|png|webp)$')
    and position('..' in p.avatar_path) = 0;
  return v_path;
end;
$$;
