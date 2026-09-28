-- TECH-ADMIN-WRITE-ATOMICITY-01: publicação admin em uma transação.
-- Índice jobs_company_normalized_title_uidx com a mesma expressão do held
-- (company_id, lower(btrim(title))). O arquivo held não é reescrito.
-- RPC create_admin_pending_job: o nome não existia no repositório.
-- País e faixa entram aqui porque a RPC grava essas colunas e a cadeia prod
-- ainda não as tinha. Homolog já as tem; IF NOT EXISTS não reaplica o dado de seed.
-- Não executar supabase db push em Production neste PR.
-- Rollback, só com aprovação do Plan: drop function public.create_admin_pending_job(jsonb);
--   drop index public.jobs_company_normalized_title_uidx;

alter table public.jobs
  add column if not exists country_code text,
  add column if not exists salary_min integer,
  add column if not exists salary_max integer,
  add column if not exists salary_currency text;

update public.jobs
set salary_currency = 'BRL'
where salary_currency is null;

alter table public.jobs
  alter column salary_currency set default 'BRL';

alter table public.jobs
  alter column salary_currency set not null;

alter table public.jobs drop constraint if exists jobs_country_code_iso2;
alter table public.jobs
  add constraint jobs_country_code_iso2
  check (country_code is null or country_code ~ '^[A-Z]{2}$');

alter table public.jobs drop constraint if exists jobs_salary_min_nonneg;
alter table public.jobs
  add constraint jobs_salary_min_nonneg
  check (salary_min is null or salary_min >= 0);

alter table public.jobs drop constraint if exists jobs_salary_max_nonneg;
alter table public.jobs
  add constraint jobs_salary_max_nonneg
  check (salary_max is null or salary_max >= 0);

alter table public.jobs drop constraint if exists jobs_salary_range_order;
alter table public.jobs
  add constraint jobs_salary_range_order
  check (salary_min is null or salary_max is null or salary_min <= salary_max);

comment on column public.jobs.country_code is
  'ISO 3166-1 alpha-2. Sem filtro de país, null aparece. Com filtro, null não corresponde.';
comment on column public.jobs.salary_min is
  'Piso em centavos da moeda. Ambos null = A combinar e não atende faixa ativa.';
comment on column public.jobs.salary_max is
  'Teto em centavos da moeda.';
comment on column public.jobs.salary_currency is
  'ISO 4217 para exibição. Default BRL. O filtro V1 não converte moeda.';

create unique index if not exists jobs_company_normalized_title_uidx
  on public.jobs (company_id, (lower(btrim(title))));

comment on index public.jobs_company_normalized_title_uidx is
  'MVP-010: uma vaga ativa por empresa + título normalizado (trim + lower). Sem tabela de fonte/connector.';

create or replace function public.create_admin_pending_job(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_text text;
  v_company_id uuid;
  v_new_name text;
  v_title text;
  v_description text;
  v_level text;
  v_work_model text;
  v_location text;
  v_country text;
  v_salary_min integer;
  v_salary_max integer;
  v_stack text[] := '{}';
  v_lock_key text;
  v_job public.jobs%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if not private.is_admin() then
    raise exception 'admin required';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Título é obrigatório.';
  end if;

  v_title := btrim(coalesce(p_payload->>'title', ''));
  v_description := btrim(coalesce(p_payload->>'description', ''));
  v_level := btrim(coalesce(p_payload->>'level', ''));
  v_work_model := btrim(coalesce(p_payload->>'work_model', ''));
  v_location := nullif(btrim(coalesce(p_payload->>'location', '')), '');
  v_country := nullif(upper(btrim(coalesce(p_payload->>'country_code', ''))), '');
  v_new_name := btrim(coalesce(p_payload->>'new_company_name', ''));
  v_company_text := nullif(btrim(coalesce(p_payload->>'company_id', '')), '');

  if v_title = '' then
    raise exception 'Título é obrigatório.';
  end if;
  if v_description = '' then
    raise exception 'Descrição é obrigatória.';
  end if;
  if v_level not in ('intern', 'junior', 'mid', 'senior') then
    raise exception 'Nível é obrigatório.';
  end if;
  if v_work_model not in ('remote', 'hybrid', 'onsite') then
    raise exception 'Modelo de trabalho é obrigatório.';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'País deve ser um código ISO de duas letras.';
  end if;

  if p_payload->>'salary_min' is not null and btrim(p_payload->>'salary_min') <> '' then
    if btrim(p_payload->>'salary_min') !~ '^[0-9]+$' then
      raise exception 'Informe o salário mínimo em centavos inteiros.';
    end if;
    v_salary_min := btrim(p_payload->>'salary_min')::integer;
  end if;
  if p_payload->>'salary_max' is not null and btrim(p_payload->>'salary_max') <> '' then
    if btrim(p_payload->>'salary_max') !~ '^[0-9]+$' then
      raise exception 'Informe o salário máximo em centavos inteiros.';
    end if;
    v_salary_max := btrim(p_payload->>'salary_max')::integer;
  end if;
  if v_salary_min is not null and v_salary_max is not null and v_salary_min > v_salary_max then
    raise exception 'A faixa mínima não pode ser maior que a máxima.';
  end if;

  if jsonb_typeof(p_payload->'stack') = 'array' then
    select coalesce(array_agg(btrim(item)), '{}')
    into v_stack
    from jsonb_array_elements_text(p_payload->'stack') as item
    where btrim(item) <> '';
    v_stack := coalesce(v_stack, '{}');
  end if;

  if v_company_text is null and v_new_name = '' then
    raise exception 'Selecione uma empresa ou informe o nome de uma empresa fictícia.';
  end if;

  if v_company_text is not null
     and v_company_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Empresa não encontrada.';
  end if;

  v_lock_key := coalesce(v_company_text, 'name:' || lower(v_new_name));
  perform pg_advisory_xact_lock(hashtext('create_admin_pending_job'), hashtext(v_lock_key));

  if v_company_text is not null then
    v_company_id := v_company_text::uuid;
    if not exists (select 1 from public.companies where id = v_company_id) then
      raise exception 'Empresa não encontrada.';
    end if;
  else
    select id
    into v_company_id
    from public.companies
    where lower(btrim(name)) = lower(v_new_name)
    order by created_at asc, id asc
    limit 1;

    if not found then
      insert into public.companies (name, description, website)
      values (v_new_name, 'Empresa fictícia de homologação.', 'https://example.invalid')
      returning id into v_company_id;
    end if;
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
      v_company_id,
      v_title,
      v_description,
      v_stack,
      v_level,
      v_work_model,
      v_location,
      v_country,
      v_salary_min,
      v_salary_max,
      '{"mandatory": [], "desirable": []}'::jsonb,
      'pending'
    )
    returning * into v_job;
  exception
    when unique_violation then
      if sqlerrm ~* 'jobs_company_normalized_title' then
        raise exception 'Já existe vaga com este título para esta empresa.'
          using errcode = '23505';
      end if;
      raise;
  end;

  return jsonb_build_object(
    'id', v_job.id,
    'title', v_job.title,
    'status', v_job.status
  );
end;
$$;

revoke all on function public.create_admin_pending_job(jsonb) from public, anon;
grant execute on function public.create_admin_pending_job(jsonb) to authenticated;

comment on function public.create_admin_pending_job(jsonb) is
  'TECH-ADMIN-WRITE-ATOMICITY-01: admin cria empresa (se o nome ainda não existe) e vaga pending na mesma transação. Duplicata de lower(btrim(title)) por company_id devolve a mensagem estável e desfaz a empresa criada nessa transação. Sem chave de idempotência.';

notify pgrst, 'reload schema';
