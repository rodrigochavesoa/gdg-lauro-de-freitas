-- MVP-013 Fase A: contrato de origem e fingerprint (`job_ingestions`).
-- Homologação: aplicar nesta história.
-- Produção: não aplicar (Camada B / PO). Fora de prod.manifest.json.
-- Não altera estados de curadoria MVP-010 nem coloca pipeline de ingestão em `jobs`.
-- Rollback:
--   drop trigger if exists job_ingestions_before_write_normalize on public.job_ingestions;
--   drop function if exists private.job_ingestions_normalize_row();
--   drop function if exists private.normalize_job_ingestion_locator(text);
--   drop table if exists public.job_ingestions;

create or replace function private.normalize_job_ingestion_locator(p_locator text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(
    lower(btrim(regexp_replace(coalesce(p_locator, ''), '[[:space:]]+', ' ', 'g'))),
    ''
  );
$$;

revoke all on function private.normalize_job_ingestion_locator(text) from public;
grant execute on function private.normalize_job_ingestion_locator(text) to anon, authenticated;
revoke execute on function private.normalize_job_ingestion_locator(text) from service_role;

comment on function private.normalize_job_ingestion_locator(text) is
  'MVP-013: trim + colapsa whitespace + lower. Espelha normalizeSlugLocator no cliente. Não expor via PostgREST.';

create table public.job_ingestions (
  id uuid primary key default extensions.gen_random_uuid(),
  source_kind text not null
    check (source_kind in ('manual_fixture', 'staff_replay')),
  normalized_locator text not null
    check (char_length(normalized_locator) between 1 and 2048)
    check (normalized_locator = lower(btrim(normalized_locator))),
  payload_hash text not null
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz,
  job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint job_ingestions_source_fingerprint_key
    unique (source_kind, normalized_locator, payload_hash)
);

create index job_ingestions_job_id_idx
  on public.job_ingestions (job_id);

comment on table public.job_ingestions is
  'MVP-013: origem idempotente da vaga. Dedup independente de jobs (company_id + título). Histórico não é apagado por expiração.';
comment on column public.job_ingestions.source_kind is
  'Origem da entrada nesta sprint: manual_fixture | staff_replay. Sem conector externo.';
comment on column public.job_ingestions.normalized_locator is
  'Localizador já normalizado (trim, whitespace colapsado, lower). Regras por source_kind em src/features/ingest/.';
comment on column public.job_ingestions.payload_hash is
  'SHA-256 hex (64) do payload canônico. Mesmo fingerprint → mesma linha; conteúdo novo → nova linha.';
comment on column public.job_ingestions.expires_at is
  'Validade do ciclo de ingestão. Nulo = sem expiração. Expirado permanece no histórico; catálogo público continua jobs.status = approved.';
comment on column public.job_ingestions.job_id is
  'FK opcional para a vaga materializada. Não implica publicação. ON DELETE SET NULL preserva a ingestão.';

create or replace function private.job_ingestions_normalize_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.source_kind := lower(btrim(new.source_kind));
  new.normalized_locator := private.normalize_job_ingestion_locator(new.normalized_locator);
  new.payload_hash := lower(btrim(new.payload_hash));
  if new.normalized_locator is null then
    raise exception 'normalized_locator vazio após normalização'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.job_ingestions_normalize_row() from public;
revoke all on function private.job_ingestions_normalize_row() from anon, authenticated, service_role;

comment on function private.job_ingestions_normalize_row() is
  'MVP-013: normaliza fingerprint antes do INSERT. Trigger interno; sem GRANT Data API.';

drop trigger if exists job_ingestions_before_write_normalize on public.job_ingestions;
create trigger job_ingestions_before_write_normalize
  before insert on public.job_ingestions
  for each row
  execute function private.job_ingestions_normalize_row();

alter table public.job_ingestions enable row level security;

revoke all on table public.job_ingestions from public, anon, authenticated;
grant select, insert on table public.job_ingestions to authenticated;

create policy "Ingestões: leitura staff"
  on public.job_ingestions for select
  to authenticated
  using (private.can_review_curation_aal2());

create policy "Ingestões: inserção administrativa"
  on public.job_ingestions for insert
  to authenticated
  with check (private.is_admin_aal2());
