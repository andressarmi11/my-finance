# SQL that is NOT applied automatically

What's in here has placeholders that have to be replaced by hand before
running it. That's why it lives outside `supabase/migrations/`: any
`supabase db push` would apply these files as-is, and
`0003_reminder_cron.sql` would create a cron that calls
`https://TU-PROYECTO.supabase.co/...` every 15 minutes with the literal
token `REEMPLAZAR_CON_TU_CRON_SECRET`.

- **`0003_reminder_cron.sql`** — the push reminder cron. Only needed if
  you're going to use notifications. First: deploy the Edge Function and
  store `CRON_SECRET`. See [docs/NOTIFICATIONS.md](../../docs/NOTIFICATIONS.md).
