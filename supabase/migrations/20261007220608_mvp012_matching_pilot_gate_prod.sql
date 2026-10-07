-- MVP-012 — explicitly authorized, time-bounded Production pilot for F-06.
-- Formal legal review statuses stay pending_dpo. A fresh individual acceptance
-- of F-06 v2 is required, and the pilot expires automatically.

create table if not exists private.matching_pilot_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  expires_at timestamptz,
  decision_reference text not null default 'not-authorized',
  updated_at timestamptz not null default now()
);

alter table private.matching_pilot_settings enable row level security;
revoke all on table private.matching_pilot_settings from public, anon, authenticated, service_role;

create table if not exists private.matching_pilot_audit (
  id bigint generated always as identity primary key,
  enabled boolean not null,
  expires_at timestamptz,
  decision_reference text not null,
  changed_by text not null default session_user,
  changed_at timestamptz not null default clock_timestamp()
);

alter table private.matching_pilot_audit enable row level security;
revoke all on table private.matching_pilot_audit from public, anon, authenticated, service_role;

create or replace function private.audit_matching_pilot_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if tg_op = 'INSERT' then
    insert into private.matching_pilot_audit (enabled, expires_at, decision_reference)
    values (new.enabled, new.expires_at, new.decision_reference);
  elsif new.enabled is distinct from old.enabled
    or new.expires_at is distinct from old.expires_at
    or new.decision_reference is distinct from old.decision_reference then
    insert into private.matching_pilot_audit (enabled, expires_at, decision_reference)
    values (new.enabled, new.expires_at, new.decision_reference);
  end if;
  return new;
end;
$$;
revoke all on function private.audit_matching_pilot_change() from public, anon, authenticated, service_role;

drop trigger if exists audit_matching_pilot_change on private.matching_pilot_settings;
create trigger audit_matching_pilot_change
  after insert or update on private.matching_pilot_settings
  for each row execute function private.audit_matching_pilot_change();

create or replace function private.matching_pilot_enabled()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce((
    select s.enabled and s.expires_at > statement_timestamp()
    from private.matching_pilot_settings s
    where s.singleton
  ), false);
$$;
revoke all on function private.matching_pilot_enabled() from public, anon, authenticated, service_role;

create or replace function public.privacy_purpose_is_authorized(p_purpose_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
  with purpose as (
    select p.*
    from public.privacy_purposes p
    where p.purpose_code = upper(trim(p_purpose_code))
      and p.status = 'active'
    order by p.version desc
    limit 1
  ), latest_event as (
    select e.event_type, e.purpose_version
    from public.privacy_consent_events e
    where e.subject_id = auth.uid()
      and e.purpose_code = upper(trim(p_purpose_code))
    order by e.created_at desc, e.id desc
    limit 1
  )
  select coalesce((
    select case
      when p.classification = 'necessary_notice' then true
      else p.status = 'active'
        and exists (
          select 1 from latest_event e
          where e.event_type = 'accepted'
            and e.purpose_version = p.version
        )
        and (
          (p.legal_basis_status = 'approved'
            and p.retention_status = 'approved'
            and p.text_status = 'approved')
          or (p.purpose_code = 'F-06' and private.matching_pilot_enabled())
        )
    end
    from purpose p
  ), false);
$$;

revoke all on function public.privacy_purpose_is_authorized(text) from public, anon, service_role;
grant execute on function public.privacy_purpose_is_authorized(text) to authenticated;

create or replace function public.get_matching_pilot_status()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select jsonb_build_object(
    'enabled', coalesce(s.enabled and s.expires_at > statement_timestamp(), false),
    'expires_at', case when s.enabled and s.expires_at > statement_timestamp() then s.expires_at else null end
  )
  from (select true) seed
  left join private.matching_pilot_settings s on s.singleton;
$$;
revoke all on function public.get_matching_pilot_status() from public, anon, service_role;
grant execute on function public.get_matching_pilot_status() to authenticated;

-- PO authorization is limited to this Production pilot; never convert it into
-- legal/DPO approval. The UTC expiry matches 2026-11-06 14:09 Bahia time.
insert into private.matching_pilot_settings (singleton, enabled, expires_at, decision_reference, updated_at)
values (true, true, '2026-11-06 17:09:02+00'::timestamptz, 'PO-authorized-production-pilot-2026-10-07', clock_timestamp())
on conflict (singleton) do update set
  enabled = excluded.enabled,
  expires_at = excluded.expires_at,
  decision_reference = excluded.decision_reference,
  updated_at = excluded.updated_at;

-- Versioning requires renewed opt-in; keep the formal governance fields pending.
update public.privacy_purposes
set status = 'inactive'
where purpose_code = 'F-06'
  and status = 'active'
  and version < 2;

insert into public.privacy_purposes (
  purpose_code, version, title, specific_description, classification, status,
  legal_basis_status, retention_status, text_status, revocation_effect
) values (
  'F-06', 2,
  'Receber recomendações com base no perfil',
  'Usar as tecnologias (skills) e o nível informados no seu perfil e a modalidade de trabalho para ordenar vagas aprovadas com critérios determinísticos. A localização em texto livre não compõe a pontuação; os filtros de localidade escolhidos no catálogo continuam valendo. O cálculo ocorre no seu navegador; pontuações e ordenação personalizada não são salvas. A escolha é opcional e pode ser revogada.',
  'optional_consent', 'active', 'pending_dpo', 'pending_dpo', 'pending_dpo',
  'Desligar remove recomendações personalizadas futuras; catálogo, busca, filtros e candidatura continuam disponíveis.'
)
on conflict (purpose_code, version) do update set
  title = excluded.title,
  specific_description = excluded.specific_description,
  classification = excluded.classification,
  status = excluded.status,
  legal_basis_status = excluded.legal_basis_status,
  retention_status = excluded.retention_status,
  text_status = excluded.text_status,
  revocation_effect = excluded.revocation_effect;

comment on table private.matching_pilot_settings is
  'PO-authorized MVP-012 Production pilot; isolated per Supabase project, audited, expires automatically, and never changes formal F-06 review statuses.';
comment on table private.matching_pilot_audit is
  'Append-only record of changes to the isolated MVP-012 Production pilot setting.';
comment on function public.privacy_purpose_is_authorized(text) is
  'Authorizes a current user acceptance only when formal purpose metadata is approved, or for F-06 while the bounded Production pilot is enabled.';

notify pgrst, 'reload schema';
