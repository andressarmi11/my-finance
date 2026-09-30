-- Recurrencia personalizada: cada N meses / cada N semanas / meses concretos.
-- Re-ejecutable (como 0005): cada constraint se suelta antes de crearse.
--
-- El CHECK de frequency vino inline en 0001, asi que Postgres lo nombro
-- recurring_rules_frequency_check. Sin RLS nuevo: las columnas cuelgan de la
-- misma fila y las politicas por user_id ya la cubren.

alter table public.recurring_rules add column if not exists interval_every smallint;
alter table public.recurring_rules add column if not exists interval_unit text;
alter table public.recurring_rules add column if not exists months smallint[];

alter table public.recurring_rules drop constraint if exists recurring_rules_frequency_check;
alter table public.recurring_rules add constraint recurring_rules_frequency_check
  check (frequency in ('monthly','weekly','biweekly','yearly','custom'));

alter table public.recurring_rules drop constraint if exists recurring_rules_interval_check;
alter table public.recurring_rules add constraint recurring_rules_interval_check
  check (
    (interval_every is null and interval_unit is null)
    or (
      interval_unit = 'months' and interval_every between 1 and 12
    )
    or (
      interval_unit = 'weeks' and interval_every between 1 and 26
    )
  );

alter table public.recurring_rules drop constraint if exists recurring_rules_months_check;
alter table public.recurring_rules add constraint recurring_rules_months_check
  check (
    months is null
    or (
      cardinality(months) between 1 and 12
      and months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]
    )
  );

-- Un CHECK de fila "custom => exactamente un patron" se descarto a proposito:
-- Postgres evalua los CHECK contra la tupla propuesta del INSERT de un upsert,
-- y un cliente viejo que edita una regla custom no envia las columnas nuevas,
-- asi que fallaria y bloquearia su sync. Se suelta por si una version previa
-- de esta migracion la creo; la validacion de la combinacion vive en la app.
alter table public.recurring_rules drop constraint if exists recurring_rules_custom_pattern_check;
