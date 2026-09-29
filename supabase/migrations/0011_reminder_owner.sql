-- A reminder may only point at a movement of the same user.
--
-- The FK was reminders(transaction_id) → transactions(id), which checks
-- the movement exists but not whose it is. send-reminders reads the
-- movement with the service role to build the notification, so a
-- reminder pointing at someone else's movement id would push that
-- person's concept and amount to whoever created it. Same (user_id, id)
-- pattern categories and payment methods already use.

alter table public.transactions
  add constraint transactions_user_id_id_key unique (user_id, id);
-- The unique constraint's index covers what this one did (0009).
drop index if exists public.transactions_user_id_idx;

alter table public.reminders drop constraint if exists reminders_transaction_id_fkey;
alter table public.reminders add constraint reminders_transaction_owner_fkey
  foreign key (user_id, transaction_id) references public.transactions(user_id, id) on delete cascade;
