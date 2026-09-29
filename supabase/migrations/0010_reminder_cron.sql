-- Schedules send-reminders every 15 minutes.
--
-- supabase/manual/0003_reminder_cron.sql described this but was never
-- applied: pg_cron wasn't even enabled, so no reminder was ever sent.
-- The secret is read from Vault on every run — never written here.
-- Needs, set beforehand:
--   * the function secret CRON_SECRET  (supabase secrets set CRON_SECRET=…)
--   * the same value in Vault as 'cron_secret'  (vault.create_secret)
--   * the function deployed with --no-verify-jwt (it checks the secret itself)

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'send-reminders-every-15-min';
select cron.schedule(
  'send-reminders-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://xuguvoikrxzvklflikdh.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
