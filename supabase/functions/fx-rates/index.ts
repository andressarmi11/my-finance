// Edge Function: fx-rates (auditoría de costos, C3)
//
// Corre en Deno. La llama pg_cron una vez al día
// (supabase/migrations/0017_fx_rates.sql). Pide la tabla del día a
// open.er-api.com con base USD y la guarda en public.fx_rates. Los clientes
// leen esa fila (una sola petición a la API al día para todos, en vez de una
// por dispositivo) y derivan cualquier moneda principal de ella.
//
// Si esta función no está desplegada o falla, la app sigue pidiendo la tasa
// directo a open.er-api (src/lib/fxRates.ts): nada se rompe.
//
// Secrets: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (ya existen) y
// CRON_SECRET (el mismo de send-reminders).
//
// Desplegar con: supabase functions deploy fx-rates --no-verify-jwt
//   (quien la llama es pg_cron, sin sesión; la autorización es CRON_SECRET,
//    que la función verifica ella misma.)

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const TIMEOUT_MS = 10_000;

/** Constant-time equality (crypto.subtle.timingSafeEqual isn't in the edge runtime). */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  // Without a secret, "Bearer " would be the password and anyone could make
  // us call the rates API (and bill the invocation).
  const got = new TextEncoder().encode(req.headers.get('Authorization') ?? '');
  const want = new TextEncoder().encode(`Bearer ${secret}`);
  if (!secret || !sameBytes(got, want)) {
    return new Response('No autorizado', { status: 401 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let body: { result?: string; rates?: Record<string, unknown> };
  try {
    const r = await fetch(ENDPOINT, { signal: controller.signal });
    body = await r.json();
  } catch (e) {
    return new Response(`La API de tasas no respondió: ${String(e)}`, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
  if (body.result !== 'success' || !body.rates) {
    return new Response('La API de tasas respondió un error', { status: 502 });
  }

  // Only positive numbers: a bad value must never reach a client.
  const rates: Record<string, number> = {};
  for (const [code, raw] of Object.entries(body.rates)) {
    const x = Number(raw);
    if (/^[A-Z]{3}$/.test(code) && Number.isFinite(x) && x > 0) rates[code] = x;
  }
  if (rates.USD !== 1 || Object.keys(rates).length < 10) {
    return new Response('Tabla de tasas incompleta', { status: 502 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.from('fx_rates').upsert({
    base: 'USD', fetched_on: today, rates, updated_at: new Date().toISOString(),
  });
  if (error) return new Response(`No se pudo guardar: ${error.message}`, { status: 500 });

  return Response.json({ ok: true, fetched_on: today, currencies: Object.keys(rates).length });
});
