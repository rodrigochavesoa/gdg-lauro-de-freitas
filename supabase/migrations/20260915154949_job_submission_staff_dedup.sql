-- MVP-010: submissão staff — insert só pending; duplicidade company_id + título normalizado.
-- Homologação: aplicada nesta história. Produção: não aplicar (Camada B / PO).
-- Rollback: drop index jobs_company_normalized_title_uidx;
--   restaurar policy "Vagas: gestão administrativa" FOR ALL (MVP-022);
--   reverter jobs_set_submitted_by ao corpo só com submitted_by.

create unique index if not exists jobs_company_normalized_title_uidx
  on public.jobs (company_id, (lower(btrim(title))));

comment on index public.jobs_company_normalized_title_uidx is
  'MVP-010: uma vaga ativa por empresa + título normalizado (trim + lower). Sem tabela de fonte/connector.';

-- Cliente autenticado não grava approved/rejected/archived no INSERT (D-05).
-- Seed/migração sem JWT (auth.uid() nulo) continua podendo inserir approved.
create or replace function public.jobs_set_submitted_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.submitted_by := auth.uid();
    new.status := 'pending';
  end if;
  return new;
end;
$$;

drop policy if exists "Vagas: gestão administrativa" on public.jobs;

create policy "Vagas: inserção administrativa pending"
  on public.jobs for insert
  with check (private.is_admin() and status = 'pending');

create policy "Vagas: atualização administrativa pending"
  on public.jobs for update
  using (private.is_admin() and status = 'pending')
  with check (private.is_admin() and status = 'pending');

create policy "Vagas: exclusão administrativa"
  on public.jobs for delete
  using (private.is_admin());
