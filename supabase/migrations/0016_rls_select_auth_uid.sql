-- Auditoría de costos, C2: políticas RLS con (select auth.uid()).
--
-- auth.uid() = user_id se evalúa fila por fila; (select auth.uid()) = user_id
-- se evalúa una vez por consulta (recomendación de Supabase). 0009 ya
-- reescribió así todas las políticas que existían entonces. Esta migración
-- repite el mismo recorrido para cubrir cualquier política creada después
-- o a mano.
--
-- Re-ejecutable: solo toca políticas que usan auth.uid() SIN el select.
-- No cambia quién puede ver qué: la condición es la misma.
--
-- Para comprobar después (debe devolver 0 filas):
--   select tablename, policyname from pg_policies
--   where schemaname = 'public'
--     and (coalesce(qual,'') || coalesce(with_check,'')) like '%auth.uid()%'
--     and (coalesce(qual,'') || coalesce(with_check,'')) not ilike '%select auth.uid()%';

do $$
declare
  p record;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%auth.uid()%'
      and (coalesce(qual, '') || coalesce(with_check, '')) not ilike '%select auth.uid()%'
  loop
    execute format(
      'alter policy %I on public.%I %s %s',
      p.policyname,
      p.tablename,
      case when p.qual is not null
        then format('using (%s)', replace(p.qual, 'auth.uid()', '(select auth.uid())')) else '' end,
      case when p.with_check is not null
        then format('with check (%s)', replace(p.with_check, 'auth.uid()', '(select auth.uid())')) else '' end
    );
  end loop;
end
$$;
