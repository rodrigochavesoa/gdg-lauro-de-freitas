## Contexto
<!-- História ou item do backlog (ex.: UX-EVENTOS-SCROLL-01). -->

ClickUp: CU-xxxxx
<!-- ID da task (integração GitHub). Setup: docs-local.example/clickup/setup.md -->

## Alterações
-

## Como validar
1.
2. Se o PR altera frontend, `vercel.json` ou deploy: abrir o **Preview Vercel** (link do bot no PR) e testar rotas SPA — `/`, `/vagas`, `/login` — no browser ou celular **antes** do squash merge.

## Segurança e dados
- [ ] Não introduz segredo no repositório
- [ ] RLS/policies revisadas, quando aplicável
- [ ] Entrada validada no servidor, quando aplicável

## Evidências
- [ ] Testes automatizados (`pnpm lint`, `pnpm test`, `pnpm run build` no `pwsh`)
- [ ] Captura de tela ou vídeo, se houver mudança de UI
- [ ] Migration e rollback, quando aplicável
- [ ] Se UI: seguir tokens e componentes em `src/styles.css` (não inventar paleta paralela)
- [ ] Se layout / juntas de seção: reutilizar as ondas canônicas; DS completo só em `docs-local/` (mantenedor)

## Checklist
- [ ] Branch a partir de `main` — **sem push direto em `main`**
- [ ] Commits seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0-beta.4/)
- [ ] Preview Vercel validado (`/`, `/vagas`, `/login`) **antes** do merge, quando o diff tocar frontend, `vercel.json` ou deploy
- [ ] Critérios de aceitação atendidos
- [ ] Documentação pública atualizada (`README.md`, `SETUP.md`, `CONTRIBUTING.md`) quando o clone precisar
- [ ] Task ClickUp atualizada (In review → Done após merge), se aplicável
- [ ] Sem mudanças fora do escopo
