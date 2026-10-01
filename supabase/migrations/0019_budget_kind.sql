-- Presupuestos: Tope y Meta (docs PRESUPUESTOS-Y-AHORRO.md, parte A). Re-ejecutable.
--
-- budgets.kind: 'limit' (Tope, lo máximo que quieres gastar) o 'goal'
-- (Meta, lo que quieres llegar a ahorrar). Lo que ya existe queda como
-- 'limit'. Solo cambia cómo se lee el presupuesto; el cálculo es el mismo.
--
-- plan_id / goal_name / goal_amount: los usa "Ayúdame a ahorrar" (parte B)
-- para marcar los presupuestos que creó un plan. null en el resto.
--
-- Mientras esta migración no esté, la app sube los presupuestos sin estas
-- columnas (Tope/Meta se queda en el dispositivo) en vez de fallar.

alter table public.budgets add column if not exists kind text not null default 'limit';
alter table public.budgets add column if not exists plan_id text;
alter table public.budgets add column if not exists goal_name text;
alter table public.budgets add column if not exists goal_amount bigint;

alter table public.budgets drop constraint if exists budgets_kind_check;
alter table public.budgets add constraint budgets_kind_check check (kind in ('limit', 'goal'));

alter table public.budgets drop constraint if exists budgets_goal_name_length;
alter table public.budgets add constraint budgets_goal_name_length check (goal_name is null or char_length(goal_name) <= 80);

-- Las categorías de ahorro (ícono 'savings') nacen como Meta: los
-- presupuestos que ya tenían pasan a Meta una sola vez.
update public.budgets b
   set kind = 'goal'
  from public.categories c
 where c.user_id = b.user_id and c.id = b.category_id and c.icon = 'savings'
   and b.kind = 'limit' and b.plan_id is null;
