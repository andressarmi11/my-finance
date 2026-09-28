/**
 * Inbox: what the automations (iOS Shortcuts) send in and nobody has
 * confirmed yet.
 *
 * Lives only in the cloud, not in Dexie: there are few rows, they're
 * ephemeral, and without a connection there's nothing to pick up anyway.
 * Duplicating them locally would be inventing a sync problem that
 * doesn't exist.
 */
import { getSupabase } from './client';
import { translate } from '@/i18n/language';

export interface InboxEntry {
  id: string;
  text: string;
  origen: string;
  createdAt: string;
}

async function userId(): Promise<string> {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(translate('supabase.noActiveSession'));
  return session.user.id;
}

export async function listPending(): Promise<InboxEntry[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('inbox')
    .select('id, texto, origen, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as Array<{ id: string; texto: string; origen: string; created_at: string }>).map((r) => ({
    id: r.id, text: r.texto, origen: r.origen, createdAt: r.created_at,
  }));
}

export async function closeEntry(id: string, outcome: 'done' | 'discarded'): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('inbox').update({ status: outcome }).eq('id', id);
  if (error) throw error;
}

/* ─────────────── Token for Shortcuts ─────────────── */

async function hashHex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a new token and returns the plaintext ONCE: only the hash stays
 * in the database. If the user loses it, they generate another one;
 * there's no way to recover it, and that's on purpose.
 */
export async function createToken(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = `mf_${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;

  const [supabase, uid] = await Promise.all([getSupabase(), userId()]);
  // Only one per account: generating another replaces the previous one,
  // so an old leaked token stops working.
  await supabase.from('ingest_tokens').delete().eq('user_id', uid);
  const { error } = await supabase
    .from('ingest_tokens')
    .insert({ user_id: uid, token_hash: await hashHex(token) });
  if (error) throw error;
  return token;
}

export async function hasToken(): Promise<boolean> {
  const supabase = await getSupabase();
  const { count, error } = await supabase
    .from('ingest_tokens')
    .select('id', { count: 'exact', head: true });
  if (error) return false;
  return (count ?? 0) > 0;
}

/** The URL of the function the Shortcut is going to call. */
export function ingestUrl(): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return base ? `${base}/functions/v1/ingest` : '';
}
