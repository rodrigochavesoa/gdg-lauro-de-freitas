# Validar eventos operacionais (`ops.*`) — modelo genérico

Instrumentação mínima de fluxos P0: eventos no **Console do navegador** (`console.info`). **Não** há dashboard nem coleta centralizada neste recorte.

Contrato de campos e `error_class`: ver implementação em `src/lib/ops-observability.js` e testes em `src/lib/ops-observability.test.js`. Squad mantém matriz detalhada e aceite de sprint em `docs-local/` (gitignored).

---

## 1. Localmente

Opcional no `.env.local` (ver comentários em [`.env.example`](../.env.example)):

```env
VITE_OPS_ENVIRONMENT=homolog
```

Inicie o app e abra o DevTools:

```text
http://127.0.0.1:5173
```

No **Console**, filtre por:

```text
ops.
```

Exemplo de objeto emitido:

```js
{
  event_name: "ops.search",
  environment: "homolog",
  release_sha: null,
  route: "/vagas",
  action: "catalog_search",
  outcome: "success",
  error_class: "none",
  correlation_id: "a91f03b7c22d",
  occurred_at: "2026-09-21T..."
}
```

---

## 2. Fluxos para validar

| Fluxo | Como exercitar | `event_name` esperado |
|-------|----------------|------------------------|
| Login Google | `/login` → iniciar OAuth | `ops.login` |
| Login staff | `/admin` → e-mail/senha (+ MFA se habilitado) | `ops.login` |
| Busca | `/vagas` ou alterar filtros (chamada de rede) | `ops.search` |
| Candidatura | Aplicar ou retirar candidatura (candidato) | `ops.application` |
| Ingestão | Staff AAL2 → `/admin/ingestao` → processar fixture | `ops.ingestion` |
| Curadoria | Staff AAL2 → aprovar, rejeitar, reenviar ou priorizar | `ops.rpc` |

Falhas controladas (opcional): perfil incompleto, candidatura duplicada, fixture expirada, prioridade inválida, env não configurado.

---

## 3. Como interpretar

| `outcome` | Significado |
|-----------|-------------|
| `success` | Operação concluída |
| `blocked` | Regra de negócio, papel, AAL2 ou estado impediu |
| `failure` | Erro técnico ou rejeição inesperada |
| `rate_limited` | Limite de requisições (ex.: candidatura) |

`error_class` resume a causa **sem** dados do titular.

**Cache de busca:** `ops.search` só aparece quando há **nova** chamada de rede; resultado só de cache → nenhum evento novo.

---

## 4. Preview (PR / Vercel)

1. Abrir o **link Preview** da branch (comentário Vercel na PR — não usar Production).
2. Autenticar (incl. proteção Vercel, se houver).
3. DevTools → Console → filtro `ops.`
4. Repetir os fluxos da tabela acima.
5. Confirmar `environment: "preview"` e `release_sha` com **7** caracteres hex (quando o build injeta SHA).

O Preview deve usar `VERCEL_ENV=preview`. O build falha se `VITE_VERCEL_ENV` conflitar com `VERCEL_ENV` (ver `vite.config.js`).

Checklist rápido (~5 min) para colar em task de aceite: copiar de `docs-local/mvp-014-preview-qa-checklist.md` § *ClickUp* (mantenedor).

---

## 5. Production

Com `VITE_VERCEL_ENV=production`, **nenhum** `console.info` de `ops.*` deve ocorrer. Não é necessário smoke manual em Production; comportamento coberto por testes e gate de build.

---

## 6. Testes automatizados

`pnpm test` (incl. `ops-observability.test.js`, smoke em `App.smoke.test.jsx`) cobre:

- schema fixo dos campos;
- ausência de e-mail, senha, CV, query, payload e token;
- classificação de falhas;
- bloqueio de emissão em Production;
- ausência de emissão automática no Vitest (exceto harness com `VITE_OPS_EMIT`).

**Resumo:** validação humana = **Console + Preview/local**; qualidade do contrato = **testes**. Monitoramento centralizado (dashboard, alertas) está fora deste recorte.
