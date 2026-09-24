-- MVP-013 Fase B: processar ingestão manual/fixture com tentativas auditáveis.
-- Homologação: aplicar nesta história.
-- Produção: não aplicar (Camada B / PO). Fora de prod.manifest.json.
-- Não publica vaga; materializa só pending. Sem conector externo.
-- Rollback:
--   drop function if exists public.process_job_ingestion(text, text, jsonb, timestamptz);
--   drop function if exists private.redact_ingestion_failure(text, text);
--   drop function if exists private.job_has_expired_ingestion(uuid);
--   drop table if exists public.job_ingestion_attempts;
--   alter table public.job_ingestions drop column if exists canonical_payload;
--   restaurar policy "Vagas: leitura pública approved" para `status = 'approved'`;
--   restaurar public.register_job_ingestion da Fase A (sem canonical_payload).

alter table public.job_ingestions
  add column if not exists canonical_payload jsonb;

comment on column public.job_ingestions.canonical_payload is
  'Payload canônico persistido para reprocessamento. Contrato recusa PII/segredo. Nulo só em linhas da Fase A ainda não processadas.';

create table if not exists public.job_ingestion_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  ingestion_id uuid not null references public.job_ingestions(id) on delete cascade,
  outcome text not null
    check (outcome in ('materialized', 'idempotent', 'failed', 'expired', 'duplicate_010')),
  failure_code text,
  failure_detail text,
  job_id uuid references public.jobs(id) on delete set null,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists job_ingestion_attempts_ingestion_created_idx
  on public.job_ingestion_attempts (ingestion_id, created_at desc);

comment on table public.job_ingestion_attempts is
  'MVP-013 Fase B: histórico append-only de processamento. Falhas redigidas; expiração e retry permanecem auditáveis.';
comment on column public.job_ingestion_attempts.failure_detail is
  'Mensagem staff sem PII. Códigos estáveis em failure_code.';

alter table public.job_ingestion_attempts enable row level security;

revoke all on table public.job_ingestion_attempts from public, anon, authenticated;
grant select on table public.job_ingestion_attempts to authenticated;

create policy "Tentativas de ingestão: leitura staff"
  on public.job_ingestion_attempts for select
  to authenticated
  using (private.can_review_curation_aal2());

create or replace function private.job_has_expired_ingestion(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_ingestions i
    where i.job_id = p_job_id
      and i.expires_at is not null
      and i.expires_at <= now()
  );
$$;

revoke all on function private.job_has_expired_ingestion(uuid) from public;
revoke all on function private.job_has_expired_ingestion(uuid) from service_role;
grant execute on function private.job_has_expired_ingestion(uuid) to anon, authenticated;

comment on function private.job_has_expired_ingestion(uuid) is
  'MVP-013: true se alguma ingestão ligada à vaga já expirou. Catálogo público exclui esses jobs.';

drop policy if exists "Vagas: leitura pública approved" on public.jobs;
create policy "Vagas: leitura pública approved"
  on public.jobs
  for select
  using (
    status = 'approved'
    and not private.job_has_expired_ingestion(id)
  );

create or replace function private.redact_ingestion_failure(p_sqlstate text, p_message text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_msg text := coalesce(p_message, '');
begin
  if v_msg ~* 'payload de ingestão' then
    return left(v_msg, 240);
  end if;
  if v_msg ~* 'source_kind não suportado' then
    return 'source_kind não suportado nesta camada';
  end if;
  if v_msg ~* 'normalized_locator' then
    return 'localizador inválido após normalização';
  end if;
  if coalesce(p_sqlstate, '') = '23505' and v_msg ~* 'jobs_company_normalized_title' then
    return 'duplicata da camada 010 (empresa + título)';
  end if;
  return 'falha operacional redigida';
end;
$$;

revoke all on function private.redact_ingestion_failure(text, text) from public;
revoke all on function private.redact_ingestion_failure(text, text) from anon, authenticated, service_role;

create or replace function public.register_job_ingestion(
  p_source_kind text,
  p_locator text,
  p_payload jsonb,
  p_expires_at timestamptz default null,
  p_job_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_kind text;
  v_locator text;
  v_hash text;
  v_canonical jsonb;
  v_row public.job_ingestions;
  v_created boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not private.is_admin_aal2() then
    raise exception 'aal2 required' using errcode = '42501';
  end if;

  v_kind := lower(btrim(coalesce(p_source_kind, '')));
  if v_kind not in ('manual_fixture', 'staff_replay') then
    raise exception 'source_kind não suportado nesta camada: %', coalesce(nullif(v_kind, ''), '(vazio)');
  end if;

  v_locator := private.normalize_job_ingestion_locator(p_locator);
  if v_locator is null then
    raise exception 'normalized_locator vazio após normalização' using errcode = '23514';
  end if;
  if char_length(v_locator) > 2048 then
    raise exception 'normalized_locator excede 2048 caracteres';
  end if;

  v_canonical := private.canonicalize_job_ingestion_payload(p_payload)::jsonb;
  v_hash := private.hash_job_ingestion_payload(p_payload);

  insert into public.job_ingestions (
    source_kind,
    normalized_locator,
    payload_hash,
    expires_at,
    job_id,
    canonical_payload
  ) values (
    v_kind,
    v_locator,
    v_hash,
    p_expires_at,
    p_job_id,
    v_canonical
  )
  on conflict on constraint job_ingestions_source_fingerprint_key
  do nothing
  returning * into v_row;

  if found then
    v_created := true;
  else
    select *
    into strict v_row
    from public.job_ingestions
    where source_kind = v_kind
      and normalized_locator = v_locator
      and payload_hash = v_hash;
    if v_row.canonical_payload is null then
      update public.job_ingestions
      set canonical_payload = v_canonical
      where id = v_row.id
        and canonical_payload is null
      returning * into v_row;
    end if;
  end if;

  return to_jsonb(v_row) || jsonb_build_object('idempotent', not v_created);
end;
$$;

revoke all on function public.register_job_ingestion(text, text, jsonb, timestamptz, uuid) from public;
revoke all on function public.register_job_ingestion(text, text, jsonb, timestamptz, uuid) from anon, service_role;
grant execute on function public.register_job_ingestion(text, text, jsonb, timestamptz, uuid) to authenticated;

create or replace function public.process_job_ingestion(
  p_source_kind text,
  p_locator text,
  p_payload jsonb,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_registered jsonb;
  v_ingestion public.job_ingestions;
  v_attempt public.job_ingestion_attempts;
  v_job public.jobs;
  v_company public.companies;
  v_company_name text;
  v_title text;
  v_description text;
  v_level text;
  v_work_model text;
  v_location text;
  v_stack text[] := '{}';
  v_outcome text;
  v_failure_code text;
  v_failure_detail text;
  v_canonical jsonb;
begin
  v_job := null::public.jobs;
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not private.is_admin_aal2() then
    raise exception 'aal2 required' using errcode = '42501';
  end if;

  v_registered := public.register_job_ingestion(
    p_source_kind,
    p_locator,
    p_payload,
    p_expires_at,
    null
  );

  select *
  into strict v_ingestion
  from public.job_ingestions
  where id = (v_registered ->> 'id')::uuid;

  v_canonical := coalesce(v_ingestion.canonical_payload, private.canonicalize_job_ingestion_payload(p_payload)::jsonb);

  if v_ingestion.expires_at is not null and v_ingestion.expires_at <= now() then
    insert into public.job_ingestion_attempts (
      ingestion_id, outcome, failure_code, failure_detail, job_id, actor_id
    ) values (
      v_ingestion.id,
      'expired',
      'expired',
      'ciclo de ingestão expirado; histórico preservado',
      v_ingestion.job_id,
      auth.uid()
    )
    returning * into v_attempt;

    return jsonb_build_object(
      'ingestion', to_jsonb(v_ingestion),
      'attempt', to_jsonb(v_attempt),
      'job', null,
      'idempotent', true,
      'outcome', 'expired',
      'failure_code', 'expired',
      'failure_detail', v_attempt.failure_detail
    );
  end if;

  if v_ingestion.job_id is not null then
    select * into v_job from public.jobs where id = v_ingestion.job_id;
    insert into public.job_ingestion_attempts (
      ingestion_id, outcome, failure_code, failure_detail, job_id, actor_id
    ) values (
      v_ingestion.id, 'idempotent', null, null, v_ingestion.job_id, auth.uid()
    )
    returning * into v_attempt;

    return jsonb_build_object(
      'ingestion', to_jsonb(v_ingestion),
      'attempt', to_jsonb(v_attempt),
      'job', case when v_job.id is null then null else jsonb_build_object(
        'id', v_job.id, 'title', v_job.title, 'status', v_job.status
      ) end,
      'idempotent', true,
      'outcome', 'idempotent',
      'failure_code', null,
      'failure_detail', null
    );
  end if;

  v_company_name := v_canonical ->> 'company_name';
  v_title := v_canonical ->> 'title';
  v_description := v_canonical ->> 'description';
  v_level := v_canonical ->> 'level';
  v_work_model := v_canonical ->> 'work_model';
  v_location := nullif(v_canonical ->> 'location', '');

  if v_canonical ? 'stack' and jsonb_typeof(v_canonical -> 'stack') = 'array' then
    select coalesce(array_agg(item order by item), '{}'::text[])
    into v_stack
    from jsonb_array_elements_text(v_canonical -> 'stack') as item;
  end if;

  if v_description is null or v_level is null or v_work_model is null then
    v_outcome := 'failed';
    v_failure_code := 'payload_invalid';
    v_failure_detail := 'payload de ingestão exige description, level e work_model para materializar';
  elsif v_level not in ('intern', 'junior', 'mid', 'senior', 'lead')
     or v_work_model not in ('remote', 'hybrid', 'onsite') then
    v_outcome := 'failed';
    v_failure_code := 'payload_invalid';
    v_failure_detail := 'payload de ingestão tem level ou work_model inválido';
  else
    begin
      select *
      into v_company
      from public.companies
      where lower(btrim(name)) = lower(btrim(v_company_name))
      order by created_at asc
      limit 1;

      if not found then
        insert into public.companies (name, description, website)
        values (
          v_company_name,
          'Empresa fictícia de homologação.',
          'https://example.invalid'
        )
        returning * into v_company;
      end if;

      begin
        insert into public.jobs (
          company_id,
          title,
          description,
          stack,
          level,
          work_model,
          location,
          requirements,
          status
        ) values (
          v_company.id,
          v_title,
          v_description,
          coalesce(v_stack, '{}'),
          v_level,
          v_work_model,
          v_location,
          '{"mandatory": [], "desirable": []}'::jsonb,
          'pending'
        )
        returning * into v_job;
        v_outcome := 'materialized';
      exception
        when unique_violation then
          if sqlerrm ~* 'jobs_company_normalized_title' then
            select *
            into v_job
            from public.jobs
            where company_id = v_company.id
              and lower(btrim(title)) = lower(btrim(v_title))
            limit 1;
            v_outcome := 'duplicate_010';
            v_failure_code := 'duplicate_010';
            v_failure_detail := 'duplicata da camada 010 (empresa + título); vaga existente reaproveitada';
          else
            raise;
          end if;
      end;

      if v_job.id is not null then
        update public.job_ingestions
        set job_id = v_job.id
        where id = v_ingestion.id
        returning * into v_ingestion;
      end if;
    exception
      when others then
        v_outcome := 'failed';
        v_failure_code := 'materialize_failed';
        v_failure_detail := private.redact_ingestion_failure(sqlstate, sqlerrm);
        v_job := null::public.jobs;
    end;
  end if;

  insert into public.job_ingestion_attempts (
    ingestion_id, outcome, failure_code, failure_detail, job_id, actor_id
  ) values (
    v_ingestion.id,
    v_outcome,
    v_failure_code,
    v_failure_detail,
    v_job.id,
    auth.uid()
  )
  returning * into v_attempt;

  return jsonb_build_object(
    'ingestion', to_jsonb(v_ingestion),
    'attempt', to_jsonb(v_attempt),
    'job', case when v_job.id is null then null else jsonb_build_object(
      'id', v_job.id, 'title', v_job.title, 'status', v_job.status
    ) end,
    'idempotent', v_outcome in ('idempotent', 'duplicate_010'),
    'outcome', v_outcome,
    'failure_code', v_failure_code,
    'failure_detail', v_failure_detail
  );
end;
$$;

revoke all on function public.process_job_ingestion(text, text, jsonb, timestamptz) from public;
revoke all on function public.process_job_ingestion(text, text, jsonb, timestamptz) from anon, service_role;
grant execute on function public.process_job_ingestion(text, text, jsonb, timestamptz) to authenticated;

comment on function public.process_job_ingestion(text, text, jsonb, timestamptz) is
  'MVP-013 Fase B: registra origem, materializa vaga pending e grava tentativa. Admin AAL2. Nunca escolhe approved.';
