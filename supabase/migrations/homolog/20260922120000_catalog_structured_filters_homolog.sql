-- V1-CATALOG-FILTERS-01: país e faixa salarial no catálogo.
-- Homologação apenas. Produção: não aplicar (fora de prod.manifest.json).
-- RLS inalterada: leitura pública continua só em status = 'approved'.
-- Novas colunas não são PII.
-- Fora desta entrega: publicação staff (/admin/vagas/nova) e ingestão.
-- O formulário staff grava location em texto e não envia country_code,
-- salary_min nem salary_max. O JSON canônico e process_job_ingestion
-- também materializam a vaga sem código de país nem valores de faixa salarial.
-- salary_currency continua BRL mesmo com piso e teto vazios.
-- Follow-up: decidir como preencher country_code, salary_min e salary_max nos dois fluxos.
-- Os UPDATEs abaixo só amostram o seed fictício; não passam pelos formulários.
-- Sem índice neste arquivo: EXPLAIN do volume de seed está em
-- docs-local/v1-catalog-filters-01-explain.md.

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

-- Amostra do seed fictício. A vaga de Product Designer permanece legada (null).
update public.jobs set
  country_code = 'BR',
  salary_min = 800000,
  salary_max = 1200000,
  salary_currency = 'BRL'
where id = 'b2b2b2b2-0001-4000-8000-000000000001';

update public.jobs set
  country_code = 'BR',
  salary_min = 500000,
  salary_max = 700000,
  salary_currency = 'BRL'
where id = 'b2b2b2b2-0002-4000-8000-000000000002';

update public.jobs set
  country_code = null,
  salary_min = null,
  salary_max = null,
  salary_currency = 'BRL'
where id = 'b2b2b2b2-0003-4000-8000-000000000003';

update public.jobs set
  country_code = 'BR',
  salary_min = 1500000,
  salary_max = 2200000,
  salary_currency = 'BRL'
where id = 'b2b2b2b2-0004-4000-8000-000000000004';
