-- Programa la llamada a la Edge Function `send-reminders` cada 10 minutos
-- (recordatorios v2: "30 minutos antes" necesita un cron más fino que 15 min;
-- ver supabase/migrations/0015_reminder_v2.sql). Re-ejecutable.
--
-- IMPORTANTE - pasos manuales antes de aplicar esto (ver docs/NOTIFICATIONS.md):
--   1. Desplegar la funcion: supabase functions deploy send-reminders
--   2. Guardar la URL del proyecto y el mismo valor de CRON_SECRET que
--      configuraste como secret de la funcion (supabase secrets set
--      CRON_SECRET=...) en Vault, NUNCA en texto plano en una migracion.
--   3. Reemplazar los placeholders de abajo antes de aplicar.
--
-- pg_cron y pg_net vienen habilitados por defecto en todos los proyectos
-- Supabase (free, pro y team) — no hay que activarlos a mano.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- El nombre viejo (cada 15 min) se retira para no tener dos jobs.
select cron.unschedule(jobid) from cron.job where jobname = 'send-reminders-every-15-min';

-- Con el mismo nombre, cron.schedule actualiza el job en lugar de duplicarlo.
select cron.schedule(
  'send-reminders-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://TU-PROYECTO.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- El secret sale de Vault (guárdalo antes con vault.create_secret), nunca
      -- en texto plano: quedaría legible en cron.job.
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Para desactivarlo despues: select cron.unschedule('send-reminders-every-10-min');
