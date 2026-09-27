# Architecture

## Layers

```
UI (React, componentes .tsx)
   ↓ hooks (useLiveQuery de Dexie, hooks propios)
domain/ (pure TypeScript — no React, no Dexie, no Supabase)
   ↓
Repository (interfaz, src/data/repository.ts)
   ├─ LocalRepository   (Dexie / IndexedDB) — fuente de verdad offline
   └─ SupabaseRepository (Postgres, via RLS) — cloud backup/sync
```

`domain/` is the layer that actually matters: pure functions, 100%
tested, that have no idea whether they're running in a browser, a
test, or (in theory) a server. See `docs/FINANCIAL_LOGIC.md` for the
detail on each one.

## Why local-first

The app works fully without any account or setup: everything lives in
the device's IndexedDB from the first use. Supabase (Phase 13) is an
**optional** layer on top — if the environment variables aren't
configured, that code doesn't even get downloaded (see below).

Both repositories implement the same `Repository` interface
(`src/data/repository.ts`), so in theory the UI could be agnostic to
which one it's using — in practice, today the UI still reads from
Dexie directly (via `useLiveQuery`) for the live screens, and Supabase
is used for: authentication, explicit manual sync
(`data/sync/syncService.ts`), and push notifications. A full real-time
sync (where every screen reads indifferently from either repository)
is the natural extension if live multi-device support is needed later
— the data model and the interface are already ready for that, no
redesign would be needed.

## Code-splitting

Two heavy dependencies are split into their own chunks, loaded only
when needed:

- **Recharts** (~115kB gzipped) — only used by the Analytics screen,
  loaded with `React.lazy()` in the router.
- **`@supabase/supabase-js`** (~150kB gzipped) — `getSupabase()` in
  `data/supabase/client.ts` imports it with a dynamic `import()`. If
  the Supabase variables are never configured, that code is never
  downloaded: a fully local user's initial bundle weighs ~59kB gzipped.

## Security: why Auth isn't optional if you use Supabase

The repository is public on GitHub Pages, so Supabase's `anon key` is
visible in the code to anyone who looks for it. That's normal — it's
designed to be public. What protects the data is that every table has
Row Level Security (`supabase/migrations/0001_init.sql`) with a policy
that only allows reading/writing rows where `auth.uid() = user_id`.
Without a logged-in session, that key doesn't give anyone access to
anything.

## Notifications: why the trigger lives on the server

Documented in detail in `docs/NOTIFICATIONS.md` — summary: Safari on
iOS has no API for *scheduled* local notifications, so pg_cron + an
Edge Function + Web Push (VAPID) is the only architecture that
actually works, not a matter of preference.

## Data model

See `src/domain/types.ts` for the exact definitions. Entities:
`Settings`, `Category`, `PaymentMethod`, `Transaction`, `RecurringRule`,
`Budget`, `Reminder`. The Postgres schema
(`supabase/migrations/0001_init.sql`) is a snake_case mirror of these
same types — the conversion lives in `src/data/supabase/mappers.ts`,
with round-trip tests.
