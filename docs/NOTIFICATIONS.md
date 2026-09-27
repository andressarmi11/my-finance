# Notifications — how they work and how to turn them on

## Why this isn't trivial on iPhone

Before the guide, the facts that determined this architecture (verified
against the official documentation, not assumptions):

- The Push API on iOS is only available for web apps installed on the
  home screen from Safari — an open tab doesn't count, and no other
  browser on iOS works either (they all run on WebKit). Works from
  iOS 16.4.
- **There is no** API for *scheduled* local notifications in Safari.
  You can't tell the browser "notify me in 3 days" and have it happen
  even if the app is closed. Any tutorial that uses `setTimeout` for
  this is describing something that doesn't work.
- Therefore, the trigger has to live on a server, not on the phone.
  This app uses **pg_cron** (enabled by default on every Supabase
  project, including the free tier) to check every 15 minutes whether
  there are pending reminders, and **pg_net** to call an Edge Function
  that actually sends the push.

## Architecture

```
You save an expense with a future date
   → a row in `reminders` is created/updated LOCALLY (IndexedDB),
     with remind_at = date - X days
   → sync uploads it to Postgres
     (it used to be written straight to the cloud, and offline it was
      lost silently: the upsert failed and nobody retried)
pg_cron, every 15 minutes
   → pg_net calls the `send-reminders` Edge Function
Edge Function
   → looks for due reminders
   → looks up the user's push_subscriptions
   → signs and sends a Web Push (VAPID protocol) to each subscription
   → Apple Push Notification service (APNs) — Safari routes it all through there
   → your iPhone
   → marks the reminder as 'sent'
```

## Limitations you have to accept

- **±15 minute precision**, not to the second — the cron runs every 15
  min. For "you have a payment tomorrow", that's more than enough.
- Subscriptions that expire or become invalid (404/410 code from APNs)
  are deleted automatically by the Edge Function; if that happens,
  just turn them back on from Settings.
- If you uninstall and reinstall the PWA, your previous subscription
  is left orphaned — turn them on again after reinstalling.
- **Plan B always available:** the Dashboard shows "Upcoming payments"
  without depending on any push. If for whatever reason notifications
  don't arrive, that list never fails because it doesn't depend on
  the network or on permissions.
- In the European Union, Apple pulled web push support on iOS 17.4
  because of the DMA. Doesn't apply if you use the app from Colombia,
  it's documented here for completeness.

## Activation guide (for whoever administers the project)

### 1. Generate the VAPID keys

```bash
npx web-push generate-vapid-keys
```

This prints a pair of keys. Real example from one run (yours will be
different — never reuse these):

```
Public Key:
BOOCkd6EkVjwo4PeLJ8CFZK07yXnAlmOWi_dXkxo_ILzs4iMtAZvHWD7fmq8TqpvzStTdFXgnn4LbiYnCHi1boM

Private Key:
xBfEDFU88HG21OOcHQwHuk4FFjFe305oGakMoAAQGvE
```

The **public** one goes in `.env.local` and in the GitHub Actions
secrets as `VITE_VAPID_PUBLIC_KEY` (it's public by design, it can go
in the bundle). The **private** one never touches the frontend or a
git file — it only goes in as an Edge Function secret (step 3).

### 2. Install the Supabase CLI and connect the project

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF   # lo ves en la URL del panel
```

### 3. Configure the Edge Function secrets

```bash
supabase secrets set VAPID_PUBLIC_KEY=BOOCkd6EkVjwo4Pe...
supabase secrets set VAPID_PRIVATE_KEY=xBfEDFU88HG21OOc...
supabase secrets set VAPID_SUBJECT=mailto:tucorreo@dominio.com
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
```

`CRON_SECRET` is a value you make up yourself — it's the password
pg_cron uses to authenticate against your own function so nobody else
can trigger it by hand.

### 4. Deploy the function

```bash
supabase functions deploy send-reminders
```

### 5. Schedule the cron

Open `supabase/manual/0003_reminder_cron.sql`, replace:
- `TU-PROYECTO` with your real project reference.
- `REEMPLAZAR_CON_TU_CRON_SECRET` with the same value you used in
  `CRON_SECRET` above (ideally stored in Vault — the file has the
  alternative commented out).

Then paste it and run it in the Supabase panel's SQL Editor.

### 6. Test it

```bash
curl -X POST https://TU-PROYECTO.supabase.co/functions/v1/send-reminders \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

It should respond `{"sent":0,"failed":0}` if there are no overdue
reminders yet — that alone confirms the function is alive and
authenticating correctly.

### 7. Turn it on on your iPhone

With the app installed on the home screen (not in a Safari tab), go
to **Settings → Reminders → Enable reminders**, accept the
notifications permission. Done — the next expense with a future date
you log will already schedule its alert.
