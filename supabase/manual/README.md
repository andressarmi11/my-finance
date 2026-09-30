# SQL that is NOT applied automatically

What's in here has placeholders that have to be replaced by hand before
running it. That's why it lives outside `supabase/migrations/`: any
`supabase db push` would apply these files as-is, and
`0003_reminder_cron.sql` would create a cron that calls
`https://TU-PROYECTO.supabase.co/...` every 10 minutes with the literal
token `REEMPLAZAR_CON_TU_CRON_SECRET`.

- **`0003_reminder_cron.sql`** — the push reminder cron. Only needed if
  you're going to use notifications. First: deploy the Edge Function and
  store `CRON_SECRET`. See [docs/NOTIFICATIONS.md](../../docs/NOTIFICATIONS.md).

  Runs **every 10 minutes** (job `send-reminders-every-10-min`) since
  reminders v2: same-day reminders ("30 minutes before") need a finer
  tick than the old 15. Re-runnable; it also removes the old
  `send-reminders-every-15-min` job.
- **Already have the 15-minute cron?** You don't need this file again:
  `supabase/migrations/0015_reminder_v2.sql` reschedules the existing job
  to every 10 minutes by copying its own command (URL and Vault header),
  so it carries no placeholders.
