-- Auditoría de costos, C3: la tasa del día, compartida. Re-ejecutable.
--
-- 1. public.fx_rates: una fila por base (hoy solo 'USD') con la tabla del
--    día, "1 USD = x moneda". La escribe la Edge Function fx-rates con la
--    service role; cualquiera la puede leer (son tasas públicas de mercado,
--    sin datos de nadie), también la app sin sesión.
-- 2. Un job de pg_cron que llama a fx-rates una vez al día. Se arma copiando
--    el comando del job de send-reminders (URL del proyecto y cabecera con el
--    secreto de Vault), así esta migración no lleva ni la URL ni el secreto.
--    Si ese job no existe, no se programa nada: la app sigue pidiendo la tasa
--    directo a la API, como antes.
--
-- Orden: desplegar primero la función (supabase functions deploy fx-rates
-- --no-verify-jwt) y después correr esta migración.

create table if not exists public.fx_rates (
  base text primary key check (base ~ '^[A-Z]{3}$'),
  fetched_on date not null,
  rates jsonb not null check (jsonb_typeof(rates) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.fx_rates enable row level security;

-- Solo lectura para clientes. Sin políticas de escritura: únicamente la
-- service role (que se salta RLS) puede escribir.
drop policy if exists fx_rates_read on public.fx_rates;
create policy fx_rates_read on public.fx_rates for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.fx_rates from anon, authenticated;
grant select on public.fx_rates to anon, authenticated;

do $$
declare
  reminders_command text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  execute $q$
    select command from cron.job
    where jobname in ('send-reminders-every-10-min', 'send-reminders-every-15-min')
    order by (jobname = 'send-reminders-every-10-min') desc
    limit 1
  $q$ into reminders_command;

  if reminders_command is null or position('/functions/v1/send-reminders' in reminders_command) = 0 then
    raise notice 'fx_rates: no hay job de send-reminders que copiar; el cron de fx-rates no se programó';
    return;
  end if;

  -- 00:17 UTC: la API publica la tabla nueva poco después de medianoche UTC.
  -- Con el mismo nombre, cron.schedule actualiza el job en lugar de duplicarlo.
  perform cron.schedule(
    'fx-rates-daily',
    '17 0 * * *',
    replace(reminders_command, '/functions/v1/send-reminders', '/functions/v1/fx-rates')
  );
end
$$;
