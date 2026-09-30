-- Recordatorios v2 (rediseño v4, §9f / §11.3). Re-ejecutable, como 0012-0014.
--
-- 1. settings.reminder: el aviso general.
--      null -> se deriva de reminder_default_days_before (N días antes a las
--              9:00), que es lo que ya tiene todo el mundo. Sin backfill.
--      { mode, days, time, sameDay: { kind, value } } -> el aviso elegido.
--    Misma forma que transactions.reminder (0014). El cliente valida el
--    contenido; el servidor solo exige que sea null o un objeto.
--    La app SIEMPRE envía esta columna: aplicar esta migración ANTES de
--    desplegar la versión que la usa, o Postgres rechaza la fila de ajustes.
--
-- 2. El cron de send-reminders pasa de cada 15 a cada 10 minutos, para que
--    "30 minutos antes" llegue a tiempo (±10 min). Se reprograma copiando el
--    comando del job que ya existe (URL y cabecera con el secreto de Vault):
--    así esta migración no lleva ni la URL del proyecto ni ningún secreto.
--    Si el job no existe (proyecto sin notificaciones), no hace nada: se crea
--    con supabase/manual/0003_reminder_cron.sql.

alter table public.settings add column if not exists reminder jsonb;

alter table public.settings drop constraint if exists settings_reminder_check;
alter table public.settings add constraint settings_reminder_check
  check (reminder is null or jsonb_typeof(reminder) = 'object');

-- La Edge Function busca por (status, remind_at) en una ventana acotada;
-- reminders_pending_idx (0001) ya es parcial sobre status = 'scheduled' y
-- ordena por remind_at, así que no hace falta otro índice.

do $$
declare
  old_command text;
begin
  -- Sin pg_cron (p. ej. una base local) no hay job que reprogramar.
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  -- El job nuevo si ya existe (re-ejecución), si no el de 0010/0003.
  execute $q$
    select command from cron.job
    where jobname in ('send-reminders-every-10-min', 'send-reminders-every-15-min')
    order by (jobname = 'send-reminders-every-10-min') desc
    limit 1
  $q$ into old_command;

  if old_command is null then
    return;
  end if;

  -- Con el mismo nombre, cron.schedule actualiza el job en lugar de duplicarlo.
  perform cron.schedule('send-reminders-every-10-min', '*/10 * * * *', old_command);
  perform cron.unschedule(jobid) from cron.job where jobname = 'send-reminders-every-15-min';
end
$$;
