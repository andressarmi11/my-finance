-- Eliminar la cuenta desde la app (Ajustes → Perfil → Eliminar cuenta).
-- Re-ejecutable.
--
-- Apple (App Review 5.1.1(v)) y Google Play exigen que una app que deja
-- crear cuenta también deje borrarla desde la propia app. La app llama a
-- esta función por RPC después de volver a pedir la contraseña.
--
-- Borra la fila de auth.users del que llama, y nada más: todas las tablas
-- con datos del usuario (settings, transactions, inbox, ingest_tokens,
-- push_subscriptions, savings_plans…) cuelgan de auth.users con
-- `on delete cascade`, así que se van con ella. fx_rates no es de nadie.
--
-- security definer porque `authenticated` no puede tocar el esquema auth.
-- auth.uid() sale del JWT de la petición: nadie puede borrar otra cuenta.

create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- security definer lives in public, which PostgREST exposes as RPC: only a
-- signed-in user may call it, and only on themselves (auth.uid() above).
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
