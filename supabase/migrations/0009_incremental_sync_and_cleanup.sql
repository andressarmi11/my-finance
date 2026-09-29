-- Incremental sync, faster RLS, and cleanup of what expires.
--
-- Additive on purpose: the version of the app already installed keeps
-- working against this schema (it selects '*' and ignores the new column;
-- it upserts without it and the trigger fills it in).

-- ── 1. synced_at: the SERVER's clock ───────────────────────────────
--
-- Sync used to download the whole account on every cycle. To download
-- only what changed it needs a cursor, and updated_at can't be it: that's
-- the writing DEVICE's clock, and a phone a few minutes behind would write
-- rows "older" than a cursor another device already passed — never pulled.
-- synced_at is stamped here, on every insert and update, by one clock.

alter table public.transactions add column if not exists synced_at timestamptz not null default now();
alter table public.deletions    add column if not exists synced_at timestamptz not null default now();

create or replace function public.touch_synced_at() returns trigger
language plpgsql as $$
begin
  new.synced_at := now();
  return new;
end $$;

drop trigger if exists transactions_synced_at on public.transactions;
create trigger transactions_synced_at before insert or update on public.transactions
  for each row execute function public.touch_synced_at();

drop trigger if exists deletions_synced_at on public.deletions;
create trigger deletions_synced_at before insert or update on public.deletions
  for each row execute function public.touch_synced_at();

-- ── 2. Indexes for what sync actually asks ─────────────────────────

-- "what changed since my cursor"
create index if not exists transactions_user_synced_idx on public.transactions(user_id, synced_at);
create index if not exists deletions_user_synced_idx    on public.deletions(user_id, synced_at);
-- paging a full download, and the (id, updated_at) comparison, by id
create index if not exists transactions_user_id_idx on public.transactions(user_id, id);
-- reminders had no index by user: every sync scanned everybody's
create index if not exists reminders_user_idx on public.reminders(user_id);

-- ── 3. RLS: auth.uid() once per query, not once per row ────────────
--
-- Same rule, same policies, same names. `(select auth.uid())` lets
-- Postgres evaluate it once (Supabase's own recommendation); bare, it
-- runs for every row it checks. Idempotent: skips what's already wrapped.

do $$
declare p record;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%auth.uid()%'
      and (coalesce(qual, '') || coalesce(with_check, '')) not ilike '%select auth.uid()%'
  loop
    execute format(
      'alter policy %I on public.%I %s %s',
      p.policyname, p.tablename,
      case when p.qual is not null
        then format('using (%s)', replace(p.qual, 'auth.uid()', '(select auth.uid())')) else '' end,
      case when p.with_check is not null
        then format('with check (%s)', replace(p.with_check, 'auth.uid()', '(select auth.uid())')) else '' end
    );
  end loop;
end $$;

-- ── 4. Cleanup of what expires ─────────────────────────────────────
--
-- Only three things, and never a movement:
--   * inbox entries older than 15 days: what a Shortcut sent (SMS,
--     dictation). 15 days to log or discard them; a logged one already
--     lives in transactions, so the raw text isn't needed.
--   * reminders whose date passed more than 15 days ago.
--   * tombstones — the record of what the user deleted — older than 180
--     days. The app treats a device that hasn't synced in that long as
--     stale and re-downloads instead of trusting its copy (see
--     syncService.ts), so nothing deleted comes back.

create or replace function public.cleanup_expired() returns void
language sql security definer set search_path = public as $$
  delete from public.inbox     where created_at < now() - interval '15 days';
  delete from public.reminders where remind_at  < now() - interval '15 days';
  delete from public.deletions where deleted_at < now() - interval '180 days';
$$;

-- security definer lives in public, which PostgREST exposes as RPC: only
-- the scheduler may call it.
revoke all on function public.cleanup_expired() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'cleanup-expired';
-- Daily, 03:17 Colombia (08:17 UTC): off the hour, when nobody is using it.
select cron.schedule('cleanup-expired', '17 8 * * *', 'select public.cleanup_expired()');
