-- MVP-013 Fase A: hash confiável + INSERT só via RPC.
-- Homologação: aplicar nesta história.
-- Produção: não aplicar (Camada B / PO). Fora de prod.manifest.json.
-- O cliente não escolhe payload_hash; private.hash_job_ingestion_payload recalcula o digest.
-- Rollback:
--   drop function if exists public.register_job_ingestion(text, text, jsonb, timestamptz, uuid);
--   drop function if exists private.hash_job_ingestion_payload(jsonb);
--   drop function if exists private.canonicalize_job_ingestion_payload(jsonb);
--   grant insert on table public.job_ingestions to authenticated;

create or replace function private.canonicalize_job_ingestion_payload(p_payload jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_forbidden text[] := array[
    'access_token',
    'authorization',
    'bio',
    'curriculum',
    'cv',
    'cv_url',
    'email',
    'full_name',
    'password',
    'prompt',
    'resume',
    'secret',
    'token'
  ];
  v_keys text[] := array[
    'company_name',
    'description',
    'level',
    'location',
    'stack',
    'title',
    'work_model'
  ];
  v_key text;
  v_parts text[] := '{}';
  v_text text;
  v_stack_items text[];
  v_value_json text;
  v_hit text;
  v_has_title boolean := false;
  v_has_company boolean := false;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload de ingestão inválido';
  end if;

  select string_agg(k, ', ' order by k)
  into v_hit
  from jsonb_object_keys(p_payload) as k
  where k = any (v_forbidden);

  if v_hit is not null then
    raise exception 'payload de ingestão contém campos proibidos: %', v_hit;
  end if;

  foreach v_key in array v_keys
  loop
    if not (p_payload ? v_key) then
      continue;
    end if;
    if p_payload -> v_key is null or jsonb_typeof(p_payload -> v_key) = 'null' then
      continue;
    end if;

    if v_key = 'stack' then
      if jsonb_typeof(p_payload -> 'stack') <> 'array' then
        continue;
      end if;
      select coalesce(array_agg(item order by item collate "C"), '{}'::text[])
      into v_stack_items
      from (
        select btrim(elem) as item
        from jsonb_array_elements_text(p_payload -> 'stack') as elem
        where length(btrim(elem)) > 0
      ) s;
      if coalesce(array_length(v_stack_items, 1), 0) = 0 then
        continue;
      end if;
      v_value_json := '[' || array_to_string(
        array(select to_json(item)::text from unnest(v_stack_items) as item),
        ','
      ) || ']';
    elsif jsonb_typeof(p_payload -> v_key) = 'string' then
      v_text := btrim(regexp_replace(p_payload ->> v_key, '[[:space:]]+', ' ', 'g'));
      if v_text = '' then
        continue;
      end if;
      v_value_json := to_json(v_text)::text;
    elsif jsonb_typeof(p_payload -> v_key) in ('number', 'boolean') then
      v_value_json := (p_payload -> v_key)::text;
    else
      continue;
    end if;

    if v_key = 'title' then
      v_has_title := true;
    elsif v_key = 'company_name' then
      v_has_company := true;
    end if;
    v_parts := v_parts || (to_json(v_key)::text || ':' || v_value_json);
  end loop;

  if not v_has_title or not v_has_company then
    raise exception 'payload de ingestão exige title e company_name';
  end if;

  return '{' || array_to_string(v_parts, ',') || '}';
end;
$$;

revoke all on function private.canonicalize_job_ingestion_payload(jsonb) from public;
revoke all on function private.canonicalize_job_ingestion_payload(jsonb) from anon, authenticated, service_role;

comment on function private.canonicalize_job_ingestion_payload(jsonb) is
  'MVP-013: JSON canônico compacto alinhado a canonicalizeIngestionPayload. Sem GRANT Data API.';

create or replace function private.hash_job_ingestion_payload(p_payload jsonb)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      convert_to(private.canonicalize_job_ingestion_payload(p_payload), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.hash_job_ingestion_payload(jsonb) from public;
revoke all on function private.hash_job_ingestion_payload(jsonb) from anon, authenticated, service_role;

comment on function private.hash_job_ingestion_payload(jsonb) is
  'MVP-013: SHA-256 hex do payload canônico. Camada confiável; o cliente não escolhe o digest.';

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

  v_hash := private.hash_job_ingestion_payload(p_payload);

  insert into public.job_ingestions (
    source_kind,
    normalized_locator,
    payload_hash,
    expires_at,
    job_id
  ) values (
    v_kind,
    v_locator,
    v_hash,
    p_expires_at,
    p_job_id
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
  end if;

  return to_jsonb(v_row) || jsonb_build_object('idempotent', not v_created);
end;
$$;

revoke all on function public.register_job_ingestion(text, text, jsonb, timestamptz, uuid) from public;
revoke all on function public.register_job_ingestion(text, text, jsonb, timestamptz, uuid) from anon, service_role;
grant execute on function public.register_job_ingestion(text, text, jsonb, timestamptz, uuid) to authenticated;

comment on function public.register_job_ingestion(text, text, jsonb, timestamptz, uuid) is
  'MVP-013: registra origem idempotente. Recalcula payload_hash no banco. Admin AAL2. Sem conector externo.';

comment on column public.job_ingestions.payload_hash is
  'SHA-256 hex (64) do payload canônico, calculado em private.hash_job_ingestion_payload. O cliente não escolhe o digest.';

revoke insert on table public.job_ingestions from authenticated, anon, public;
grant select on table public.job_ingestions to authenticated;
