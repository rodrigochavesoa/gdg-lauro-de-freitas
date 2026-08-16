-- GDGJobs: dados, segurança e busca semântica.
-- O modelo gemini-embedding-001 será usado em 768 dimensões.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create type public.job_status as enum ('pending', 'approved', 'archived');
create type public.application_status as enum ('submitted', 'reviewing', 'accepted', 'rejected', 'withdrawn');
create type public.user_role as enum ('candidate', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  avatar_path text,
  headline text,
  bio text,
  skills text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,
  role public.user_role not null default 'candidate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  website text,
  description text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  description text not null check (length(trim(description)) > 0),
  enriched_description text,
  requirements jsonb not null default '{"mandatory": [], "desirable": []}'::jsonb,
  stack text[] not null default '{}',
  level text not null check (level in ('intern', 'junior', 'mid', 'senior', 'lead')),
  work_model text not null check (work_model in ('remote', 'hybrid', 'onsite')),
  location text,
  status public.job_status not null default 'pending',
  embedding extensions.vector(768),
  embedding_model text,
  embedding_updated_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

-- O HNSW mantém boa latência e precisão em busca por cosseno.
create index jobs_embedding_hnsw_idx on public.jobs
  using hnsw (embedding extensions.vector_cosine_ops)
  where status = 'approved' and embedding is not null;
create index jobs_status_created_at_idx on public.jobs (status, created_at desc);
create index jobs_stack_gin_idx on public.jobs using gin (stack);
create index applications_candidate_id_idx on public.applications(candidate_id);

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Perfil e candidaturas são privados; vagas aprovadas e suas empresas são públicas.
create policy "Perfil: leitura própria" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "Perfil: atualização própria" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "Perfil: criação própria" on public.profiles for insert with check (id = auth.uid());

-- Um candidato nunca pode elevar seu próprio papel para admin.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_path, headline, bio, skills, preferences, updated_at) on public.profiles to authenticated;

create policy "Empresas: leitura pública" on public.companies for select using (true);
create policy "Empresas: gestão administrativa" on public.companies for all using (public.is_admin()) with check (public.is_admin());

create policy "Vagas aprovadas: leitura pública" on public.jobs for select using (status = 'approved' or public.is_admin());
create policy "Vagas: gestão administrativa" on public.jobs for all using (public.is_admin()) with check (public.is_admin());

create policy "Candidaturas: leitura própria" on public.applications for select using (candidate_id = auth.uid() or public.is_admin());
create policy "Candidaturas: criação própria" on public.applications for insert with check (
  candidate_id = auth.uid() and exists (select 1 from public.jobs where id = job_id and status = 'approved')
);
create policy "Candidaturas: atualização própria" on public.applications for update using (candidate_id = auth.uid() or public.is_admin()) with check (candidate_id = auth.uid() or public.is_admin());

-- V2: combina similaridade semântica (70%) e compatibilidade explícita de stack (30%).
create or replace function public.match_jobs(
  query_embedding extensions.vector(768),
  requested_stack text[] default '{}',
  requested_levels text[] default '{}',
  requested_work_model text default null,
  match_limit integer default 20
)
returns table (
  job_id uuid,
  semantic_score double precision,
  explicit_score double precision,
  match_score double precision
)
language sql stable
set search_path = public, extensions
as $$
  with candidates as (
    select j.id,
      1 - (j.embedding <=> query_embedding) as semantic_score,
      case
        when cardinality(requested_stack) = 0 then 1.0
        else cardinality(array(select unnest(j.stack) intersect select unnest(requested_stack)))::double precision
          / cardinality(requested_stack)
      end as stack_score
    from public.jobs j
    where j.status = 'approved'
      and j.embedding is not null
      and (cardinality(requested_levels) = 0 or j.level = any(requested_levels))
      and (requested_work_model is null or j.work_model = requested_work_model)
  )
  select id, semantic_score, stack_score, (semantic_score * 0.70) + (stack_score * 0.30)
  from candidates
  order by (semantic_score * 0.70) + (stack_score * 0.30) desc
  limit least(greatest(match_limit, 1), 50);
$$;

grant execute on function public.match_jobs(extensions.vector(768), text[], text[], text, integer) to anon, authenticated;

-- Realtime só para mudanças de status, sem publicar dados de perfis ou candidaturas.
alter publication supabase_realtime add table public.jobs;

comment on column public.jobs.embedding is 'Embedding Gemini da descrição enriquecida; não misturar modelos na mesma coluna.';
comment on function public.match_jobs is 'V2: score ponderado de semântica e filtros explícitos.';
