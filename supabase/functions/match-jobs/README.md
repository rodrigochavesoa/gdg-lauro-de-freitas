# match-jobs

Fora do ar até o gate de privacidade **MVP-005**.

O handler responde `403` e não lê `headline`, `bio`, `skills` ou `preferences`, nem chama o provedor de embeddings. Não publicar esta função em homologação nem em produção antes desse gate. A SPA não chamar a rota não substitui este controle.
