-- "Ayúdame a ahorrar" (docs PRESUPUESTOS-Y-AHORRO.md, parte B). Re-ejecutable.
--
-- Un plan de ahorro por fila. El plan va entero en `data` (modo,
-- intensidad, categorías bloqueadas, fechas, recortes y la foto de los
-- presupuestos que había antes, para poder restaurarlos). Los planes
-- eliminados se quedan como fila con deleted_at, así la eliminación viaja
-- entre dispositivos como cualquier cambio (gana el más reciente).
--
-- Los presupuestos que crea el plan van en budgets (columnas de 0019).
-- Mientras esta migración no esté, la app guarda el plan solo en el
-- dispositivo en vez de fallar.

create table if not exists public.savings_plans (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.savings_plans drop constraint if exists savings_plans_data_size;
alter table public.savings_plans add constraint savings_plans_data_size check (pg_column_size(data) <= 200000);

alter table public.savings_plans enable row level security;

drop policy if exists savings_plans_select_own on public.savings_plans;
create policy savings_plans_select_own on public.savings_plans
  for select using ((select auth.uid()) = user_id);

drop policy if exists savings_plans_insert_own on public.savings_plans;
create policy savings_plans_insert_own on public.savings_plans
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists savings_plans_update_own on public.savings_plans;
create policy savings_plans_update_own on public.savings_plans
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists savings_plans_delete_own on public.savings_plans;
create policy savings_plans_delete_own on public.savings_plans
  for delete using ((select auth.uid()) = user_id);
