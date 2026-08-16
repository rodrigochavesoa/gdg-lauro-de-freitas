-- S4-01 (parte 1): novos valores de enum — transação separada para uso imediato na 0005.
alter type public.user_role add value if not exists 'curator';
alter type public.user_role add value if not exists 'moderator';
alter type public.job_status add value if not exists 'rejected';
