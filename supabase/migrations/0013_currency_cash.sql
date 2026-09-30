-- Moneda por movimiento y método "Efectivo" (rediseño v4, §9b / §11.1-2).
-- Re-ejecutable, como 0012.
--
-- `amount` NO cambia de significado: sigue siendo el entero en la moneda
-- principal del usuario, ya convertido (round(original_amount * fx_rate)).
-- Así ningún cálculo del dominio se entera de que existen otras monedas.
-- Las tres columnas nuevas solo guardan de dónde salió ese número, para
-- mostrarlo ("US$ 20 USD · tasa 4.000") y poder editarlo.
--
-- Nullable a propósito: un movimiento sin moneda es de la moneda principal,
-- que es lo que ya son todos los que existen. Sin backfill.

alter table public.transactions add column if not exists currency text;
alter table public.transactions add column if not exists original_amount bigint;
alter table public.transactions add column if not exists fx_rate numeric;

alter table public.recurring_rules add column if not exists currency text;
alter table public.recurring_rules add column if not exists original_amount bigint;
alter table public.recurring_rules add column if not exists fx_rate numeric;

-- Las monedas rápidas de la hoja de nuevo movimiento (máximo 3).
alter table public.settings add column if not exists quick_currencies text[];

alter table public.transactions drop constraint if exists transactions_fx_check;
alter table public.transactions add constraint transactions_fx_check
  check (
    (currency is null and original_amount is null and fx_rate is null)
    or (currency ~ '^[A-Z]{3}$' and original_amount >= 0 and fx_rate > 0)
  );

alter table public.recurring_rules drop constraint if exists recurring_rules_fx_check;
alter table public.recurring_rules add constraint recurring_rules_fx_check
  check (
    (currency is null and original_amount is null and fx_rate is null)
    or (currency ~ '^[A-Z]{3}$' and original_amount >= 0 and fx_rate > 0)
  );

alter table public.settings drop constraint if exists settings_quick_currencies_check;
alter table public.settings add constraint settings_quick_currencies_check
  check (quick_currencies is null or cardinality(quick_currencies) <= 3);

-- 'cash' ya venía en el CHECK inline de 0001 (payment_methods_type_check).
-- Se re-afirma por si una base vieja lo tiene distinto: sin esto, sembrar
-- "Efectivo" rompería la sincronización de toda la tabla.
alter table public.payment_methods drop constraint if exists payment_methods_type_check;
alter table public.payment_methods add constraint payment_methods_type_check
  check (type in ('debit','credit','cash','transfer'));
