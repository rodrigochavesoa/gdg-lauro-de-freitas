-- S4-01 (parte 2): curadoria V1 — schema, RPC transacional, RLS e histórico append-only.
-- Depende de 202608160004_curation_enums.sql
-- Contrato: docs/decisions-curation-v1.md
-- Rollback documentado: docs/s4-curation-flow.md

create type public.curation_decision as enum ('approve', 'reject');
create type public.job_priority as enum ('normal', 'urgent');

alter table public.jobs
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists curation_round integer not null default 1 check (curation_round >= 1),
  add column if not exists priority public.job_priority not null default 'normal',
  add column if not exists priority_reason text,
  add column if not exists rejected_at timestamptz;

alter table public.jobs
  add constraint jobs_priority_reason_chk check (
    priority = 'normal'
    or (priority_reason is not null and length(trim(priority_reason)) > 0)
  );

comment on column public.jobs.submitted_by is
  'Autor confiável da submissão. NULL apenas em seed/legado; novas vagas recebem auth.uid() via trigger.';
comment on column public.jobs.curation_round is
  'Rodada corrente de curadoria; incrementada no reenvio após rejected.';
comment on column public.jobs.priority_reason is
  'Motivo interno obrigatório quando priority = urgent; definido só via RPC por admin.';

create table public.job_curation_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  curation_round integer not null check (curation_round >= 1),
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision public.curation_decision not null,
  rubric_code text not null check (length(trim(rubric_code)) > 0),
  internal_comment text,
  created_at timestamptz not null default now(),
  unique (job_id, curation_round, reviewer_id)
);

create index job_curation_reviews_job_round_idx
  on public.job_curation_reviews (job_id, curation_round);

create index jobs_curation_queue_idx
  on public.jobs (priority desc, created_at desc)
  where status = 'pending';

-- Empate 1×1 na rodada corrente; vaga permanece pending.
create or replace view public.jobs_needing_moderation
with (security_invoker = true) as
select j.*
from public.jobs j
where j.status = 'pending'
  and (
    select count(*) filter (where r.decision = 'approve')
    from public.job_curation_reviews r
    where r.job_id = j.id
      and r.curation_round = j.curation_round
  ) = 1
  and (
    select count(*) filter (where r.decision = 'reject')
    from public.job_curation_reviews r
    where r.job_id = j.id
      and r.curation_round = j.curation_round
  ) = 1;

comment on view public.jobs_needing_moderation is
  'needs_moderation derivado: pending com 1 approve + 1 reject na rodada corrente.';

-- Autoria confiável: ignora valor enviado pelo cliente.
create or replace function public.jobs_set_submitted_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.submitted_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_before_insert_submitted_by on public.jobs;
create trigger jobs_before_insert_submitted_by
  before insert on public.jobs
  for each row
  execute function public.jobs_set_submitted_by();

create or replace function public.is_curator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'curator'
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

create or replace function public.can_review_curation()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('curator', 'moderator', 'admin')
  );
$$;

-- RPC: único caminho para registrar parecer e aplicar quórum.
create or replace function public.submit_curation_review(
  p_job_id uuid,
  p_decision public.curation_decision,
  p_rubric_code text,
  p_internal_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_round integer;
  v_approve_count integer;
  v_reject_count integer;
  v_total_count integer;
  v_is_tie boolean;
  v_role public.user_role;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if length(trim(coalesce(p_rubric_code, ''))) = 0 then
    raise exception 'rubric_code is required';
  end if;

  select * into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'job not found';
  end if;

  if v_job.status <> 'pending' then
    raise exception 'job is not open for curation';
  end if;

  v_round := v_job.curation_round;

  if v_job.submitted_by is not null and v_uid = v_job.submitted_by then
    raise exception 'cannot review own submission';
  end if;

  if exists (
    select 1
    from public.job_curation_reviews
    where job_id = p_job_id
      and curation_round = v_round
      and reviewer_id = v_uid
  ) then
    raise exception 'already reviewed in this round';
  end if;

  select role into v_role
  from public.profiles
  where id = v_uid;

  if v_role is null then
    raise exception 'profile not found';
  end if;

  select
    count(*) filter (where decision = 'approve'),
    count(*) filter (where decision = 'reject'),
    count(*)
  into v_approve_count, v_reject_count, v_total_count
  from public.job_curation_reviews
  where job_id = p_job_id
    and curation_round = v_round;

  v_is_tie := v_approve_count = 1 and v_reject_count = 1;

  if v_is_tie then
    if v_role not in ('moderator', 'admin') then
      raise exception 'moderation required';
    end if;
  elsif v_total_count >= 2 then
    raise exception 'round already decided';
  elsif v_role not in ('curator', 'moderator', 'admin') then
    raise exception 'not authorized to review';
  end if;

  insert into public.job_curation_reviews (
    job_id,
    curation_round,
    reviewer_id,
    decision,
    rubric_code,
    internal_comment
  ) values (
    p_job_id,
    v_round,
    v_uid,
    p_decision,
    trim(p_rubric_code),
    nullif(trim(coalesce(p_internal_comment, '')), '')
  );

  select
    count(*) filter (where decision = 'approve'),
    count(*) filter (where decision = 'reject')
  into v_approve_count, v_reject_count
  from public.job_curation_reviews
  where job_id = p_job_id
    and curation_round = v_round;

  if v_is_tie then
    if p_decision = 'approve' then
      update public.jobs
      set status = 'approved',
          approved_at = now(),
          rejected_at = null,
          updated_at = now()
      where id = p_job_id;
    else
      update public.jobs
      set status = 'rejected',
          rejected_at = now(),
          approved_at = null,
          updated_at = now()
      where id = p_job_id;
    end if;
  elsif v_approve_count >= 2 then
    update public.jobs
    set status = 'approved',
        approved_at = now(),
        rejected_at = null,
        updated_at = now()
    where id = p_job_id;
  elsif v_reject_count >= 2 then
    update public.jobs
    set status = 'rejected',
        rejected_at = now(),
        approved_at = null,
        updated_at = now()
    where id = p_job_id;
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'status', (select status from public.jobs where id = p_job_id),
    'curation_round', v_round,
    'needs_moderation', exists (
      select 1 from public.jobs_needing_moderation nm where nm.id = p_job_id
    )
  );
end;
$$;

create or replace function public.resubmit_job_for_curation(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not public.is_admin() then
    raise exception 'admin required';
  end if;

  select * into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'job not found';
  end if;

  if v_job.status <> 'rejected' then
    raise exception 'job is not rejected';
  end if;

  update public.jobs
  set status = 'pending',
      curation_round = curation_round + 1,
      rejected_at = null,
      approved_at = null,
      updated_at = now()
  where id = p_job_id;

  return jsonb_build_object(
    'job_id', p_job_id,
    'status', 'pending',
    'curation_round', v_job.curation_round + 1
  );
end;
$$;

create or replace function public.set_job_curation_priority(
  p_job_id uuid,
  p_priority public.job_priority,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not public.is_admin() then
    raise exception 'admin required';
  end if;

  if p_priority = 'urgent' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'priority reason required for urgent';
  end if;

  update public.jobs
  set priority = p_priority,
      priority_reason = case
        when p_priority = 'urgent' then trim(p_reason)
        else null
      end,
      updated_at = now()
  where id = p_job_id;

  if not found then
    raise exception 'job not found';
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'priority', p_priority
  );
end;
$$;

grant execute on function public.submit_curation_review(uuid, public.curation_decision, text, text) to authenticated;
grant execute on function public.resubmit_job_for_curation(uuid) to authenticated;
grant execute on function public.set_job_curation_priority(uuid, public.job_priority, text) to authenticated;

-- Browser não altera status, rodada, prioridade nem autoria; decisão só via RPC.
revoke update on public.jobs from authenticated;
grant update (
  company_id,
  title,
  description,
  enriched_description,
  requirements,
  stack,
  level,
  work_model,
  location,
  embedding,
  embedding_model,
  embedding_updated_at,
  updated_at
) on public.jobs to authenticated;

revoke all on public.job_curation_reviews from anon, authenticated;
grant select on public.job_curation_reviews to authenticated;

alter table public.job_curation_reviews enable row level security;

create policy "Pareceres: leitura interna"
  on public.job_curation_reviews
  for select
  using (public.can_review_curation());

-- Curadores leem fila pending; visitante/candidato só approved.
drop policy if exists "Vagas aprovadas: leitura pública" on public.jobs;
create policy "Vagas: leitura pública approved"
  on public.jobs
  for select
  using (status = 'approved');

create policy "Vagas: leitura fila curadoria"
  on public.jobs
  for select
  using (public.can_review_curation());

grant select on public.jobs_needing_moderation to authenticated;
