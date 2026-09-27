# Account and sync

With an account, your data stops living only on the phone: you sign in
with email and password on any device and everything shows up.

This also fixes two things that are surprising on iOS:

- **Installing the app on the home screen "erases" the data.** It
  doesn't erase it: on iOS the installed app has its own storage,
  separate from Safari's. What you loaded in the tab doesn't carry
  over. With an account, opening the installed app downloads
  everything and both sides end up in sync.
- **Shortcuts open Safari, not the installed app.** iOS doesn't know
  how to route a URL into an installed web app. Without an account,
  the expense you log from a Shortcut stays in Safari and you don't
  see it in the app. With an account, both sides sync against the
  same cloud.

---

## What the app does on its own

Once there's a session, you don't have to touch any button:

| When | What happens |
|---|---|
| On sign-in | Downloads everything from the cloud before showing anything |
| On returning to the app | Syncs (at most once per minute) |
| On leaving the app | Uploads what you added |
| On getting internet back | Retries |

Without internet the app works the same; whatever's pending uploads
the next chance it gets. In Settings → Your account there's a
**Sync now** to force it.

**Deletions travel too.** Every deletion leaves a "tombstone"
(`src/data/sync/tombstones.ts`) that syncs like any other piece of
data. Without that, a device that still had the row would upload it
again and the deleted item would reappear.

---

## Current setup status

| Step | Status |
|---|---|
| Migrations 0001, 0002, 0004, 0005 applied | done |
| `.env.local` with URL and anon key | done |
| Repo secrets in GitHub Actions | done |
| **Confirm email / Redirect URLs in the dashboard** | pending — steps below in step 2 |

What's missing needs to be done in the Supabase dashboard: the
Management API is behind the keychain and the CLI doesn't expose that
setting.

**And watch out for the account that already exists:**
`andressarmi11@hotmail.com` was created with a magic link, so **it has
no password**. Signing in with email and password will say "Incorrect
email or password." Use **Forgot your password?** once to set one
(needs step 2, Redirect URLs, done first), or create a new account.

## Setup (one time only)

### 1. Apply the migrations

In the Supabase project's SQL Editor, in order:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_push_subscriptions.sql
supabase/migrations/0004_text_ids_and_profile.sql
supabase/migrations/0005_deletions.sql
```

**0004 is mandatory**: without it, sync fails with `invalid input
syntax for type uuid`. The categories the app seeds use ids like
`cat-hogar`, and the original schema declared them as `uuid`. It also
adds `display_name` and `onboarded_at`.

The reminder cron no longer lives here: it has placeholders that have
to be replaced by hand, so it's in `supabase/manual/` so that no
`db push` applies it as-is. It's only needed if you're going to use
notifications.

### 2. Enable email + password

Dashboard → **Authentication** → **Sign In / Providers** → **Email**:

- **Enable Email provider**: yes.
- **Confirm email**: currently **on** (I checked by creating and
  deleting a test account: signup returns a user but no session).
  You decide:
  - **Off** — you're signed in as soon as you create the account.
    More convenient, and fine for a personal app.
  - **On** — you have to open an email before the first sign-in. The
    app handles it: it shows "Confirm the email we sent you."

Under **URL Configuration**, add to *Redirect URLs*:

```
https://<tu-usuario>.github.io/step-up/
http://localhost:5173/step-up/
```

Without that, the "forgot my password" link won't come back to the app.

### 3. The keys, locally and on GitHub

In `.env.local` (not committed, it's in `.gitignore`):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon key from the dashboard>
```

And on GitHub → repo → **Settings** → **Secrets and variables** →
**Actions** → *New repository secret*, the same two names. The deploy
workflow already reads them.

> The anon key is public by design: it goes inside the bundle the
> browser downloads. What protects the data is **RLS** — every row
> carries a `user_id` and the policies only allow seeing your own
> (`0001_init.sql`). That's why the app requires a session when
> Supabase is configured.

### 4. Verify it

```bash
npm run dev
```

The **Sign in / Create account** screen should show up. Create the
account, complete the initial setup, add an expense. Open the same URL
in another browser, sign in with the same email: it has to be there.

---

## If something fails

| Symptom | Cause |
|---|---|
| The login screen doesn't show up | The env vars are missing; the app runs 100% local |
| `invalid input syntax for type uuid` | Migration 0004 hasn't been applied |
| `relation "public.deletions" does not exist` | Missing 0005 |
| "Need to confirm your email" | *Confirm email* is on in Supabase |
| The password link doesn't come back to the app | Missing the URL in *Redirect URLs* |
| The password link signs you in directly without letting you change it | Was a bug on our end, fixed: the link opens a session, and the gate showed the app before asking. See `src/features/auth/recovery.ts` |
| Asks for name and categories on every login | Was a bug on our end, fixed. Settings had no `updatedAt`, so downloading from the cloud blindly overwrote the local data; and setup is completed AFTER the login's push, so it never got uploaded. See `elegirSettings` in `src/data/sync/syncService.ts` and `pedirSync` in `useCloudSync.ts` |
| I sign in on another device and see nothing | Check Settings → Your account → Sync now; if it errors, the message says which one |
