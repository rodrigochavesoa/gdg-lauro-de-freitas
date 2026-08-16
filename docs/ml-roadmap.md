# IA e matching — GDGJobs

## V1 — enriquecimento

Ao cadastrar uma vaga, um administrador chama `enrich-job`. A função pede ao Gemini uma descrição profissional e requisitos estruturados, valida o JSON retornado e persiste o resultado. O texto original não é apagado: ele continua sendo a fonte editorial.

## V2 — matching determinístico e semântico

O mesmo fluxo gera um embedding de 768 dimensões para cada vaga. Para um candidato, `match-jobs` cria um embedding do perfil ou da busca e chama a RPC `match_jobs`.

`match_score = 70% similaridade de cosseno + 30% cobertura de stack`

Nível de experiência e modelo de trabalho são filtros explícitos, não inferências do modelo. Isso torna o resultado explicável e reduz recomendações incompatíveis.

## V3 — recomendação colaborativa

Somente iniciar após volume suficiente de eventos consentidos: visualização, salvamento, candidatura e retorno da empresa. O modelo deve complementar — nunca substituir — os filtros explícitos e precisa de avaliação offline, explicabilidade e possibilidade de desativação pelo candidato.

## Operação segura

- `GEMINI_API_KEY` fica somente nos secrets das Edge Functions.
- Sempre usar o mesmo modelo e dimensionalidade para embeddings comparados.
- Regerar embeddings após mudanças materiais na vaga ou no modelo.
- Não enviar dados sensíveis de candidatos ao Gemini sem base legal e consentimento apropriado.
