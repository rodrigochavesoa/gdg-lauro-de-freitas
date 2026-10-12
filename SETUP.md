# Setup local — GDGJobs

Este guia cobre a execução local para desenvolvimento.

## Requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | 22 |
| pnpm | 10.30.1 |

## Instalar e iniciar

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

Preencha a configuração local com um projeto de desenvolvimento controlado. Não use credenciais ou dados de produção. Mantenha valores secretos fora do Git e do código enviado ao navegador.

O frontend precisa de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, disponíveis no `.env.example`. Use somente uma chave pública apropriada para o navegador; chaves secretas não devem receber o prefixo `VITE_`.

```powershell
pnpm dev
```

O Vite inicia a aplicação em `http://127.0.0.1:5173`.

## Verificações locais

```powershell
pnpm lint
pnpm test
pnpm build
```

## Ajuda

Consulte [`CONTRIBUTING.md`](CONTRIBUTING.md) para o fluxo de contribuição. Dúvidas sobre acesso a serviços externos devem ser tratadas com o mantenedor por um canal autorizado.
