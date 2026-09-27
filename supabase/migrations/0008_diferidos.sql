-- Compras diferidas a N cuotas.
--
-- Las N cuotas son N filas de `transactions` que comparten
-- installment_group_id. No hay tabla de "plan": un diferido es finito y se
-- conoce entero el dia de la compra, asi que no hay nada que expandir
-- despues ni estado que mantener aparte (a diferencia de recurring_rules).
--
-- Todo nullable: los movimientos que no son diferidos no tienen nada de
-- esto, y las filas que ya existen no necesitan backfill.
alter table public.transactions
  add column if not exists installment_group_id text,
  -- Cual de las N es, 1..N.
  add column if not exists installment_number integer,
  add column if not exists installment_count integer,
  -- Cuando se hizo la COMPRA. Distinta de `date` a partir de la cuota 2:
  -- el cupo se bloquea el dia de la compra, no el de cada cuota.
  add column if not exists purchase_date date;

-- Traer las cuotas de un diferido es la consulta que hace el borrado en
-- grupo, y la lista al armar el rotulo "cuota 3 de 12".
create index if not exists transactions_installment_group_idx
  on public.transactions(user_id, installment_group_id)
  where installment_group_id is not null;
