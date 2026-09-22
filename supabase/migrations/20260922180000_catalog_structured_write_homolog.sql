-- V1-CATALOG-STRUCTURED-WRITE-01: país e faixa na materialização da ingestão.
-- Homologação: aplicar nesta história.
-- Produção: não aplicar. Fora de prod.manifest.json.
-- Não infere country_code a partir de location. Faixa vazia deixa salary_currency no default BRL.
-- Chaves canônicas novas, após work_model: country_code, salary_min, salary_max.
-- Ausentes no payload continuam omitidas (fingerprint antigo estável).
-- Rollback: reaplicar o corpo de
--   20260920020100_job_ingestions_register_rpc_homolog.sql (canonicalize)
--   20260920040000_job_ingestions_process_homolog.sql (process_job_ingestion)

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
    'work_model',
    'country_code',
    'salary_min',
    'salary_max'
  ];
  v_key text;
  v_parts text[] := '{}';
  v_text text;
  v_stack_items text[];
  v_value_json text;
  v_hit text;
  v_has_title boolean := false;
  v_has_company boolean := false;
  v_salary_min integer;
  v_salary_max integer;
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

    if v_key = 'country_code' then
      v_text := upper(btrim(regexp_replace(p_payload ->> v_key, '[[:space:]]+', ' ', 'g')));
      if v_text = '' then
        continue;
      end if;
      if v_text !~ '^[A-Z]{2}$' then
        raise exception 'payload de ingestão tem country_code inválido';
      end if;
      v_value_json := to_json(v_text)::text;
    elsif v_key in ('salary_min', 'salary_max') then
      if jsonb_typeof(p_payload -> v_key) = 'number' then
        v_text := (p_payload -> v_key)::text;
      elsif jsonb_typeof(p_payload -> v_key) = 'string' then
        v_text := btrim(p_payload ->> v_key);
      else
        raise exception 'payload de ingestão tem % inválido', v_key;
      end if;
      if v_text = '' then
        continue;
      end if;
      if v_text !~ '^[0-9]+$' or v_text::numeric > 2147483647 then
        raise exception 'payload de ingestão tem % inválido', v_key;
      end if;
      v_value_json := (v_text::bigint)::text;
      if v_key = 'salary_min' then
        v_salary_min := v_value_json::integer;
      else
        v_salary_max := v_value_json::integer;
      end if;
    elsif v_key = 'stack' then
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

  if v_salary_min is not null and v_salary_max is not null and v_salary_min > v_salary_max then
    raise exception 'payload de ingestão tem faixa salarial inválida';
  end if;

  if not v_has_title or not v_has_company then
    raise exception 'payload de ingestão exige title e company_name';
  end if;

  return '{' || array_to_string(v_parts, ',') || '}';
end;
$$;

revoke all on function private.canonicalize_job_ingestion_payload(jsonb) from public;
revoke all on function private.canonicalize_job_ingestion_payload(jsonb) from anon, authenticated, service_role;

comment on function private.canonicalize_job_ingestion_payload(jsonb) is
  'MVP-013 + WRITE-01: JSON canônico alinhado a canonicalizeIngestionPayload, com country_code e faixa em centavos. Sem GRANT Data API.';

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
  v_country_code text;
  v_salary_min integer;
  v_salary_max integer;
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
  v_country_code := nullif(upper(btrim(v_canonical ->> 'country_code')), '');
  if v_canonical ? 'salary_min' and jsonb_typeof(v_canonical -> 'salary_min') = 'number' then
    v_salary_min := (v_canonical ->> 'salary_min')::integer;
  end if;
  if v_canonical ? 'salary_max' and jsonb_typeof(v_canonical -> 'salary_max') = 'number' then
    v_salary_max := (v_canonical ->> 'salary_max')::integer;
  end if;

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
  elsif v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    v_outcome := 'failed';
    v_failure_code := 'payload_invalid';
    v_failure_detail := 'payload de ingestão tem country_code inválido';
  elsif (v_salary_min is not null and v_salary_min < 0)
     or (v_salary_max is not null and v_salary_max < 0)
     or (v_salary_min is not null and v_salary_max is not null and v_salary_min > v_salary_max) then
    v_outcome := 'failed';
    v_failure_code := 'payload_invalid';
    v_failure_detail := 'payload de ingestão tem faixa salarial inválida';
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
          country_code,
          salary_min,
          salary_max,
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
          v_country_code,
          v_salary_min,
          v_salary_max,
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
  'MVP-013 Fase B + WRITE-01: materializa vaga pending com country_code e faixa em centavos. Admin AAL2. Nunca escolhe approved. Não preenche vaga reaproveitada por duplicata 010.';
