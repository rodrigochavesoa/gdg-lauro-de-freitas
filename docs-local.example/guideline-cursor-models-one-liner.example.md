# Modelo e Effort no ONE-LINER (modelo genérico)

O contrato versionado está em [`CONTRIBUTING.md`](../CONTRIBUTING.md) § *Handoff ONE-LINER*. Cada squad mantém a tabela detalhada (preços, tarefas, Sprint N) em **`docs-local/guideline-cursor-models-one-liner.md`** (gitignored).

## Por que dois campos?

| Campo | Quem usa | O que significa |
|-------|----------|-----------------|
| **Modelo indicado** | PO/mantenedor no **seletor do Agent** (ex.: Grok 4.6, Grok 4.7, Composer 2.5) | Qual família de modelo o Plan recomenda para a tarefa |
| **Effort** | Mesmo seletor (low / medium / high / xhigh, quando o modelo suporta) | Quanto “pensar” antes de agir — tarefas difíceis → **high**; copy/fix 1 arquivo → **low** |
| **Modelo / ferramenta** | Texto do ONE-LINER (já existente) | *Como* executar: Cursor Agent, shell, Playwriter, humano, subagent, etc. |

O Plan **escreve** modelo + effort; o humano **aplica** no Cursor antes de dar **Sim** ao Executor.

## Política resumida (GDG Jobs — adaptar no `docs-local/`)

| Situação | Modelo indicado | Effort |
|----------|-----------------|--------|
| UI/testes focados, ONE-LINER claro | Grok 4.6 | high |
| SQL / RLS / RPC / ingest / observabilidade transversal | Grok 4.7 | high |
| Polish / copy / 1 arquivo | Grok 4.6 ou Composer 2.5 | low |
| Revisão Plan em PR grande ou segurança | Grok 4.7 | medium |
| Visual QA homolog | Humano + scripts | — |
| Fast | Só com urgência explícita do PO no ONE-LINER | — |

## Exemplo de bloco (copiar no ONE-LINER)

```md
**Função / Agente:** Executor fullstack
**Modelo indicado:** Grok 4.7
**Effort:** high
**Modelo / ferramenta:** Cursor Agent standard; `pnpm test` e `pnpm test:rls` no shell (não no chat)
**História:** …
```

Valores de preço e tabelas por tipo de tarefa: ver doc operacional local (não versionar faturas do squad no Git público).
