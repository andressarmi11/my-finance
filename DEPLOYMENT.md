# Deployment — from your computer to your iPhone

A step-by-step guide, from zero, to get Step up from this code to an
app installed on your phone. None of this has to happen in strict
order, but it does have dependencies: you can't install on the iPhone
without having deployed, and you can't deploy without having pushed to
GitHub.

## 0. What you need before starting

- A [GitHub](https://github.com) account (free).
- [Node.js](https://nodejs.org) 20 or higher installed on your computer.
- Git installed.
- **Optional:** a [Supabase](https://supabase.com) account (free) —
  only if you want cloud backup and push notifications. Without this,
  the app is still 100% functional, fully local on your phone.

---

## 1. Run the project on your computer

```bash
git clone https://github.com/<tu-usuario>/step-up.git
cd step-up
npm install
npm run dev
```

Open `http://localhost:5173/step-up/`. You should see the empty
dashboard. Tap "Load sample data" to confirm everything works.

```bash
npm run test        # 123 tests, todos deben pasar
npm run typecheck   # no errors
npm run build        # genera dist/
```

If any of this fails, check the **Common troubleshooting** section at
the end before continuing.

---

## 2. Push the code to GitHub

If the project isn't in a repository yet:

```bash
git init
git add .
git commit -m "Step up — versión inicial"
```

Create a new GitHub repository named **exactly** `step-up`
(lowercase) — the name has to match `base: '/step-up/'` in
`vite.config.ts`, or the app won't find its own files once published.
If you prefer a different name, change that `base` first.

**Important:** the repository must be **public**. Free GitHub Pages
on a personal account doesn't publish sites from private repos.

```bash
git remote add origin https://github.com/<tu-usuario>/step-up.git
git branch -M main
git push -u origin main
```

---

## 3. Enable GitHub Pages

1. On GitHub, go to your repository → **Settings** → **Pages**.
2. Under "Build and deployment" → "Source", choose **GitHub Actions**
   (not "Deploy from a branch" — the workflow already included at
   `.github/workflows/deploy.yml` handles everything).
3. Go to your repo's **Actions** tab. You should see a "Deploy to
   GitHub Pages" workflow running (it triggers automatically from the
   push in the previous step). Wait for it to finish green — it takes
   1-2 minutes.
4. Your app is now live at: `https://<tu-usuario>.github.io/step-up/`

Every time you `git push` to `main`, this workflow runs again and
updates the site automatically.

---

## 4. (Optional) Set up Supabase — cloud backup and notifications

Without this step, the app is 100% functional, it's just that your
data lives only in your phone's browser (with manual export/import
from Settings as a backup). This step adds real sync and push
notifications.

### 4.1 Create the project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Choose a database password (save it; you'll only need it if you
   connect via `psql`, not for day-to-day use).
3. Wait 1-2 minutes for the project to finish being created.

### 4.2 Apply the schema

In the Supabase panel → **SQL Editor** → **New query**, paste and run,
**in this order**, the contents of:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_push_subscriptions.sql`

(The third one, `0003_reminder_cron.sql`, is applied later, in step
4.5 — it needs data you don't have yet.)

### 4.3 Enable email login

Panel → **Authentication** → **Providers** → confirm that **Email** is
enabled, with "Confirm email" and "Magic Link" turned on (this is the
default). You don't need to configure any third-party OAuth — the app
only uses magic link by email.

### 4.4 Connect the app to your project

Panel → **Project Settings** → **API**. Copy:

- **Project URL**
- **anon public** key (the `anon` one, **never** the `service_role` one)

Create a `.env.local` file at the project root (never commit it to
git — it's already in `.gitignore`):

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

For the **deployed** site on GitHub Pages to also use these, add the
same two variables as repository **Secrets**: Settings →
**Secrets and variables** → **Actions** → **New repository secret**.
And edit `.github/workflows/deploy.yml` to pass them to the build step:

```yaml
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}
```

Run `npm run dev` again — now the app will ask you to sign in with
your email before showing any screen. This is intentional: the repo is
public, so the `anon key` is visible in the code anyone can download —
without login (protected by Row Level Security on every table), that
key alone doesn't give anyone access to your data.

### 4.5 Push notifications (optional within the optional)

See **[docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)** — it has its
own complete guide (generating VAPID keys, deploying the Edge
Function, scheduling the cron). It's the most advanced part of the
whole project; skip it if for now you only want cloud backup.

---

## 5. Install on your iPhone

1. Open `https://<tu-usuario>.github.io/step-up/` in **Safari** (it
   has to be Safari — Chrome on iOS can't install PWAs).
2. Tap the **Share** button (the square with the arrow pointing up).
3. Scroll down to **"Add to Home Screen"**.
4. Confirm the name and tap **Add**.

You now have the Step up icon on your home screen, and it opens like
an app — without Safari's toolbar.

If you set up notifications (step 4.5), you can now turn them on from
Settings: **they only work if you open the app from this icon**,
never from a regular Safari tab — that's how Apple designed it.

---

## 6. Updating the app after changes

```bash
git add .
git commit -m "what you changed"
git push
```

The Pages workflow triggers automatically. The icon on your iPhone
updates on its own the next time you open the app with internet
access (the service worker checks for a new version).

---

## Common troubleshooting

| Problem | Likely cause |
|---|---|
| The app shows blank on GitHub Pages, but works with `npm run dev` | The repo name doesn't match `base` in `vite.config.ts` |
| "404" when reloading a screen other than the home one | The deploy workflow didn't copy `404.html` — check that the `cp dist/index.html dist/404.html` step is still in `deploy.yml` |
| The "Add to Home Screen" button doesn't show up on iOS | You have to be in Safari, not Chrome or an in-app browser |
| Notifications don't arrive | Check `docs/NOTIFICATIONS.md` — there are several manual steps (VAPID, Edge Function, cron) that don't happen on their own |
| `npm install` fails or hangs | Check your Node version (`node -v`, must be 20+); try deleting `node_modules` and `package-lock.json` and repeating |
| I changed the card's `cutoffDay`/`paymentDay` and old purchases changed their payment date | This shouldn't happen — each purchase stores its own calculated date (`cyclePaymentDate`) at the moment it's created. If you see this, it's a bug: open an issue |
