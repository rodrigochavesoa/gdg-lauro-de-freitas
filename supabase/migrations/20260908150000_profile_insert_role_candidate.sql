-- F-019 (QA-SEC-01d): block privilege escalation on profiles INSERT.
-- Authenticated users may only create their own row with role = candidate.
-- Staff (admin, curator, moderator) is provisioned out-of-band (service role / admin channel).

drop policy if exists "Perfil: criação própria" on public.profiles;

create policy "Perfil: criação própria"
  on public.profiles
  for insert
  with check (
    id = auth.uid()
    and role = 'candidate'::public.user_role
  );
