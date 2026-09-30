## [Unreleased] — Redesign v4, phase 7: reminders v2 (backend)

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 7; §9f
"Recordatorios v2"; pending 3, the schedule and the cron).

> **Deploy note:** run Supabase migration `0015_reminder_v2.sql` before
> deploying this version (the app always sends `settings.reminder`). Redeploy
> the Edge Function: `supabase functions deploy send-reminders --no-verify-jwt`.
> The migration also moves an existing reminder cron from every 15 to every
> 10 minutes; a new project gets that from `supabase/manual/0003_reminder_cron.sql`.

### Added
- `Settings.reminder` (the general reminder: `{ mode: 'days' | 'sameDay',
  days, time, sameDay: { kind: 'hours' | 'minutes' | 'at', value } }`).
  Absent = derived from `reminderDefaultDaysBefore` (N days before at 09:00),
  so nobody's reminders move.
- `domain/reminders/schedule.ts` gains `reminderInstant` (the instant in UTC,
  Colombia time UTC−5 with no DST: N days before at a time; same day N hours
  or minutes before the transaction's `time`, 09:00 if it has none; or at an
  exact clock time; `'none'` = no reminder), `generalReminderRule`,
  `effectiveReminderRule` (the transaction's own rule > the general one) and
  `planReminder` (what to write locally). `calculateReminderTime` is untouched,
  and with the default rule `reminderInstant` returns exactly the same instant
  (tested for 0–7 days across month, leap-year and year boundaries).
- Migration `0015_reminder_v2.sql`: `settings.reminder jsonb` (null or an
  object) and the cron rescheduled to `*/10 * * * *` by copying the existing
  job's command (no URL or secret in the migration; a no-op without pg_cron
  or without the job).
- `ReminderRuleEditor` (not mounted yet; Ajustes → Recordatorios mounts it):
  "Días antes | El mismo día"; days 1–7 and the time in half-hour steps; or
  1 hora antes · Horas antes [− 2 +] · Minutos antes [− 30 +] (steps of 5) ·
  A una hora exacta [8:00 a. m.]; a live notification preview ("GYM vence
  mañana · $ 100.000 · Salud · Débito") with the time it would arrive.
  Texts in ES and EN.

### Changed
- Saving a transaction schedules its reminder with `reminderInstant`, so the
  per-transaction chips from phase 4 now take effect. Choosing "Sin aviso"
  dismisses a still-pending reminder. Saving a transaction without changing
  when its reminder fires no longer re-arms one that was already sent.
- `send-reminders` Edge Function, now every 10 minutes:
  - Sends only reminders due in (now − 24 h, now]; older ones are never sent
    late.
  - Claims each chunk with a conditional update (`scheduled` → `sent`,
    `sent_at`, `updated_at`) and sends only what the update returned, so
    overlapping runs can't send one twice; the ones no device received end
    as `failed`. `updated_at` moves so the server's `sent` wins on sync.
  - Hard caps: 500 reminders per run, chunks of 100 ids, 10 s per push,
    10 pushes in flight, 60 s of claiming per run; it never calls itself —
    whatever is left waits for the next tick. It answers
    `{ sent, failed, deferred }`.
  - Limits and pure helpers live in `supabase/functions/send-reminders/policy.ts`.
- `supabase/manual/0003_reminder_cron.sql` schedules `send-reminders-every-10-min`
  and removes the old 15-minute job. Docs: `DEPLOYMENT.md`,
  `supabase/manual/README.md`, `docs/NOTIFICATIONS.md`, `docs/FINANCIAL_LOGIC.md`.
- Mappers carry `settings.reminder` (always sent, `null` when absent); the
  backup schema accepts it (optional, validated like the per-transaction one).

### Tests
- Unit: `reminderInstant` for every mode, month/leap-year/year boundaries,
  crossing midnight backwards, bad data, override precedence, and identical
  output to `calculateReminderTime` for the default rule; `planReminder`;
  settings mapper round-trips for each rule kind and for rows from before
  0015; backup schema; the editor's stepper/clock/preview helpers; the Edge
  Function's window, chunking, bounded concurrency, time budget and payload
  (`vitest` now also runs `supabase/functions/**/*.test.ts`).
