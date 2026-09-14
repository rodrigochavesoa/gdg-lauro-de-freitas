-- MVP-022: helpers RLS fora da Data API (schema private, não PostgREST).
-- Semântica idêntica; SECURITY DEFINER + search_path = public.
-- Rollback: ver corpo da PR (recriar public.* e apontar policies/RPCs de volta).

create schema if not exists private;

comment on schema private is
  'MVP-022: helpers de policy fora do schema exposto na Data API. PostgREST homolog: public, graphql_public — não incluir private.';

revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function private.is_curator()
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

create or replace function private.is_moderator()
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

create or replace function private.can_review_curation()
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

revoke all on function private.is_admin() from public;
revoke all on function private.is_curator() from public;
revoke all on function private.is_moderator() from public;
revoke all on function private.can_review_curation() from public;

-- RLS avalia a policy como o invocador: anon/authenticated precisam EXECUTE.
-- service_role faz BYPASSRLS; postgres é owner — sem GRANT extra.
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_curator() to anon, authenticated;
grant execute on function private.is_moderator() to anon, authenticated;
grant execute on function private.can_review_curation() to anon, authenticated;

comment on function private.is_admin() is
  'MVP-022: helper RLS. Não expor via PostgREST; EXECUTE só para avaliação de policy.';
comment on function private.is_curator() is
  'MVP-022: helper RLS. Não expor via PostgREST.';
comment on function private.is_moderator() is
  'MVP-022: helper RLS. Não expor via PostgREST.';
comment on function private.can_review_curation() is
  'MVP-022: helper RLS. Não expor via PostgREST.';

drop policy if exists "Perfil: leitura própria" on public.profiles;
create policy "Perfil: leitura própria"
  on public.profiles for select
  using (id = auth.uid() or private.is_admin());

drop policy if exists "Perfil: atualização própria" on public.profiles;
create policy "Perfil: atualização própria"
  on public.profiles for update
  using (id = auth.uid() or private.is_admin())
  with check (id = auth.uid() or private.is_admin());

drop policy if exists "Empresas: gestão administrativa" on public.companies;
create policy "Empresas: gestão administrativa"
  on public.companies for all
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "Vagas: gestão administrativa" on public.jobs;
create policy "Vagas: gestão administrativa"
  on public.jobs for all
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "Vagas: leitura fila curadoria" on public.jobs;
create policy "Vagas: leitura fila curadoria"
  on public.jobs for select
  using (private.can_review_curation());

drop policy if exists "Candidaturas: leitura própria" on public.applications;
create policy "Candidaturas: leitura própria"
  on public.applications for select
  using (candidate_id = auth.uid() or private.is_admin());

drop policy if exists "Candidaturas: inserção administrativa" on public.applications;
create policy "Candidaturas: inserção administrativa"
  on public.applications for insert
  with check (private.is_admin());

drop policy if exists "Candidaturas: atualização administrativa" on public.applications;
create policy "Candidaturas: atualização administrativa"
  on public.applications for update
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "Candidaturas: exclusão administrativa" on public.applications;
create policy "Candidaturas: exclusão administrativa"
  on public.applications for delete
  using (private.is_admin());

drop policy if exists "apply_request_log: admin" on public.apply_request_log;
create policy "apply_request_log: admin"
  on public.apply_request_log for all
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "Pareceres: leitura interna" on public.job_curation_reviews;
create policy "Pareceres: leitura interna"
  on public.job_curation_reviews for select
  using (private.can_review_curation());

drop policy if exists "Auditoria: leitura administrativa" on public.privacy_audit_events;
create policy "Auditoria: leitura administrativa"
  on public.privacy_audit_events for select
  using (private.is_admin());

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

  if not private.is_admin() then
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

  if not private.is_admin() then
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

revoke all on function public.resubmit_job_for_curation(uuid) from public, anon;
grant execute on function public.resubmit_job_for_curation(uuid) to authenticated;

revoke all on function public.set_job_curation_priority(uuid, public.job_priority, text) from public, anon;
grant execute on function public.set_job_curation_priority(uuid, public.job_priority, text) to authenticated;

drop function if exists public.is_admin();
drop function if exists public.is_curator();
drop function if exists public.is_moderator();
drop function if exists public.can_review_curation();

notify pgrst, 'reload schema';
