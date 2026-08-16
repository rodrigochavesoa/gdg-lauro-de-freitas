-- GDGJobs Sprint 2: grants para o Data API + seed fictício (sem PII real).
-- Rollback: delete from public.jobs / public.companies where id in (UUIDs abaixo);
-- a migration 202608150001 permanece.

grant select on public.companies to anon, authenticated;
grant select on public.jobs to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.applications to anon, authenticated;

insert into public.companies (id, name, website, description) values
  (
    'a1a1a1a1-0001-4000-8000-000000000001',
    'Nuvem Lauro Demo',
    'https://example.invalid/nuvem-lauro',
    'Empresa fictícia de produto digital usada só no ambiente de teste do GDGJobs.'
  ),
  (
    'a1a1a1a1-0002-4000-8000-000000000002',
    'Baía Code Exemplo',
    'https://example.invalid/baia-code',
    'Empresa fictícia de serviços financeiros para seed de homologação.'
  ),
  (
    'a1a1a1a1-0003-4000-8000-000000000003',
    'Costa Design Demo',
    'https://example.invalid/costa-design',
    'Estúdio fictício de produto e design system — dados de demonstração.'
  ),
  (
    'a1a1a1a1-0004-4000-8000-000000000004',
    'Recife Dados Lab',
    'https://example.invalid/recife-dados',
    'Laboratório fictício de dados. Não representa vaga real.'
  )
on conflict (id) do nothing;

insert into public.jobs (
  id, company_id, title, description, requirements, stack, level, work_model, location, status, approved_at
) values
  (
    'b2b2b2b2-0001-4000-8000-000000000001',
    'a1a1a1a1-0001-4000-8000-000000000001',
    'Pessoa Desenvolvedora Front-end',
    'Buscamos uma pessoa apaixonada por experiências digitais para criar produtos que impactam milhares de usuários. Dados fictícios de teste.',
    '{"mandatory": ["Construir interfaces acessíveis e performáticas", "Colaborar com design e produto", "Participar de decisões técnicas do time"], "desirable": ["Testes de UI"]}',
    array['React', 'TypeScript', 'Next.js']::text[],
    'mid',
    'remote',
    'Brasil',
    'approved',
    now() - interval '2 days'
  ),
  (
    'b2b2b2b2-0002-4000-8000-000000000002',
    'a1a1a1a1-0002-4000-8000-000000000002',
    'Desenvolvedor(a) Back-end Node.js',
    'Venha construir APIs em um cenário fictício de homologação do GDGJobs.',
    '{"mandatory": ["Desenvolver APIs REST", "Escrever testes automatizados", "Evoluir serviços distribuídos"], "desirable": ["AWS"]}',
    array['Node.js', 'PostgreSQL', 'AWS']::text[],
    'junior',
    'hybrid',
    'São Paulo, SP',
    'approved',
    now() - interval '3 days'
  ),
  (
    'b2b2b2b2-0003-4000-8000-000000000003',
    'a1a1a1a1-0003-4000-8000-000000000003',
    'Product Designer',
    'Transforme jornadas complexas em produtos simples — vaga fictícia de teste.',
    '{"mandatory": ["Conduzir discovery", "Criar protótipos de alta fidelidade", "Evoluir o design system"], "desirable": ["Pesquisa com usuários"]}',
    array['Figma', 'UX Research', 'Design System']::text[],
    'mid',
    'remote',
    'Remoto',
    'approved',
    now() - interval '5 days'
  ),
  (
    'b2b2b2b2-0004-4000-8000-000000000004',
    'a1a1a1a1-0004-4000-8000-000000000004',
    'Pessoa Engenheira de Dados',
    'Ajude a transformar dados fictícios em decisões de produto no ambiente de teste.',
    '{"mandatory": ["Criar pipelines de dados", "Garantir qualidade e governança", "Apoiar decisões de produto"], "desirable": ["Databricks"]}',
    array['Python', 'SQL', 'Databricks']::text[],
    'senior',
    'hybrid',
    'Osasco, SP',
    'approved',
    now() - interval '7 days'
  ),
  (
    'b2b2b2b2-0005-4000-8000-000000000005',
    'a1a1a1a1-0001-4000-8000-000000000001',
    'Pessoa Estagiária (PENDENTE — não publicar)',
    'Esta vaga deve permanecer invisível para visitantes anônimos. Seed de teste de RLS.',
    '{"mandatory": ["Apoiar o time em tarefas de teste"], "desirable": []}',
    array['HTML']::text[],
    'intern',
    'onsite',
    'Lauro de Freitas, BA',
    'pending',
    null
  )
on conflict (id) do nothing;
