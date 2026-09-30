-- Bandeja v2 (docs BANDEJA.md). Re-ejecutable.
--
-- 1. transactions.source / source_label: el rastro de lo que llegó solo
--    (SMS del banco, Atajo, dictado) y quién lo mandó ("Bancolombia").
--    null en todo lo que se escribe en la app.
--    La app solo envía estas columnas en los movimientos que las tienen:
--    correr esta migración ANTES de anotar desde la bandeja con la versión
--    nueva, o Postgres rechaza esa fila.
--
-- 2. push_subscriptions.language: en qué idioma escribirle a ese
--    dispositivo la notificación de "llegó un movimiento" ('es' | 'en').
--    La app lo actualiza sola cada vez que se abre.
--
-- 3. inbox: quien abre la app puede devolver una entrada a 'pending'
--    (Deshacer). La política update_own de 0006 ya lo permite; no cambia.

alter table public.transactions add column if not exists source text;
alter table public.transactions add column if not exists source_label text;

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source is null or source in ('sms', 'atajo', 'dictation'));

alter table public.transactions drop constraint if exists transactions_source_label_check;
alter table public.transactions add constraint transactions_source_label_check
  check (source_label is null or length(source_label) <= 60);

alter table public.push_subscriptions add column if not exists language text;

alter table public.push_subscriptions drop constraint if exists push_subscriptions_language_check;
alter table public.push_subscriptions add constraint push_subscriptions_language_check
  check (language is null or language in ('es', 'en'));
