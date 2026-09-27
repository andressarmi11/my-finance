/**
 * Supabase client. The rest of the app asks isSupabaseConfigured() before
 * using this — without the env vars, the app keeps working 100% locally
 * (Phases 1-12 behavior).
 *
 * IMPORTANT: getSupabase() is async on purpose. @supabase/supabase-js
 * weighs ~240kB — if it were imported statically here, it would end up in
 * the main bundle for ALL users, even those who never configure Supabase.
 * The dynamic import() splits it into its own chunk, which only downloads
 * if this function actually gets called.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/** Throws if called without being configured — always check isSupabaseConfigured() first. */
export async function getSupabase(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no esta configurado (faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  }
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url!, anonKey!);
  }
  return client;
}
