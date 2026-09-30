-- Aviso por movimiento y hora del movimiento (rediseño v4, §9f "Recordatorios
-- v2" / §11.3). Re-ejecutable.
--
-- reminder:
--   null        -> usa el aviso general de Ajustes
--   '"none"'    -> sin aviso para este movimiento
--   { mode, days, time, sameDay: { kind, value } } -> su propio aviso
-- Se guarda como jsonb porque es la misma forma que el aviso general y el
-- cliente la valida; el servidor solo exige que sea "none" o un objeto.
--
-- time: 'HH:MM' opcional. Sin hora, el aviso cuenta desde las 9:00.

alter table public.transactions add column if not exists reminder jsonb;
alter table public.transactions add column if not exists time text;

alter table public.transactions drop constraint if exists transactions_reminder_check;
alter table public.transactions add constraint transactions_reminder_check
  check (reminder is null or reminder = '"none"'::jsonb or jsonb_typeof(reminder) = 'object');

alter table public.transactions drop constraint if exists transactions_time_check;
alter table public.transactions add constraint transactions_time_check
  check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
