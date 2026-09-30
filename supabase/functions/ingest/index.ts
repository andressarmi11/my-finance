// Edge Function: ingest
//
// Recibe texto crudo de un Atajo de iOS y lo deja en la bandeja del
// usuario. Es el camino que hace que la automatización del SMS no tenga
// que abrir nada: el Atajo manda el mensaje acá y sigue de largo.
//
// Guarda el texto crudo: la interpretación que vale es la de la app, que
// el usuario revisa antes de anotar. Pero la notificación dice lo que
// entendió ("Gasto de $ 500.000 en Restaurante El Cielo", BANDEJA.md), y
// para eso usa EL MISMO parser de la app, empaquetado en pushText.gen.js
// (npm run build:push-text) — nunca una copia escrita en Deno.
//
// La notificación es best-effort: si no hay suscripciones, faltan las
// claves VAPID o el envío falla, el movimiento igual queda en la bandeja.
//
// Autenticación: un token de un solo propósito por usuario, guardado
// hasheado en ingest_tokens. Solo permite AGREGAR a la bandeja — no lee
// movimientos ni configuración. Si se filtra, lo peor es basura en la
// bandeja, que el usuario ve antes de confirmar.
//
// Secrets para la notificación (los mismos de send-reminders):
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
//
// Desplegar: supabase functions deploy ingest --no-verify-jwt
//   (--no-verify-jwt porque el Atajo no tiene sesión de Supabase; la
//    autenticación la hace esta función con su propio token.)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { pushText } from './pushText.gen.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const ORIGENES = new Set(['sms', 'dictado', 'atajo']);

// Per-user burst cap. A bank SMS or a dictation is one entry every few
// minutes at most; a leaked key in a loop is thousands. Counted from the
// inbox itself (indexed by user_id, created_at), so there's no extra state.
const MAX_PER_MINUTE = 20;
// And a ceiling on what's waiting: past this nobody is reviewing them.
const MAX_PENDING = 300;
// 2.000 characters of text plus the token and JSON punctuation, with room.
const MAX_BODY_BYTES = 16 * 1024;

async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function responder(status: number, cuerpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Subscription { id: string; endpoint: string; p256dh: string; auth: string; language?: string | null }

/** Today in Colombia: the parser resolves "mañana" / "el 5" against it. */
function todayBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** What happened with the notification: in the response and in the function's logs. */
interface PushReport {
  subscriptions: number;
  sent: number;
  /** Why nothing (or not everything) went out, when that's the case. */
  problem?: string;
  errors?: string[];
}

/**
 * One notification per entry, saying what was understood. Same `tag` per
 * user, so a burst of four shows as one that says "4 por revisar" instead
 * of four banners. Tapping it opens the review on THIS entry.
 *
 * Never throws: the entry is already in the inbox. But it says what went
 * wrong — it used to swallow every error, and a push that never arrived
 * left nothing to look at.
 */
async function notify(userId: string, entryId: string, texto: string, pending: number): Promise<PushReport> {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) return { subscriptions: 0, sent: 0, problem: 'Faltan los secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.' };
  try {
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@example.com', publicKey, privateKey);
  } catch (e) {
    return { subscriptions: 0, sent: 0, problem: `Claves VAPID inválidas: ${String(e)}` };
  }

  // `language` is migration 0018; before it, ask without it (Spanish).
  let subs: Subscription[] = [];
  const withLang = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth, language').eq('user_id', userId);
  if (withLang.error) {
    const plain = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
    if (plain.error) return { subscriptions: 0, sent: 0, problem: `No se pudieron leer las suscripciones: ${plain.error.message}` };
    subs = (plain.data ?? []) as Subscription[];
  } else {
    subs = (withLang.data ?? []) as Subscription[];
  }
  if (subs.length === 0) return { subscriptions: 0, sent: 0, problem: 'Esta cuenta no tiene ningún dispositivo con notificaciones activas.' };

  const { data: settings } = await admin.from('settings').select('currency').eq('user_id', userId).maybeSingle();
  const currency = (settings?.currency as string | undefined) ?? 'COP';
  const today = todayBogota();

  const errors: string[] = [];
  let sent = 0;
  await Promise.all(subs.map(async (sub) => {
    try {
      const language = sub.language === 'en' ? 'en' : 'es';
      const { title, body } = pushText(texto, { today, language, currency, pending });
      const payload = JSON.stringify({ title, body, tag: `inbox-${userId}`, url: `/?revisar=${entryId}` });
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 3600, timeout: 10_000 },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      const host = (() => { try { return new URL(sub.endpoint).host; } catch { return '?'; } })();
      errors.push(`${host}: ${status ?? ''} ${(e as { body?: string }).body ?? String(e)}`.trim());
      // Gone for good: the browser unsubscribed. Same cleanup as send-reminders.
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id);
    }
  }));
  return { subscriptions: subs.length, sent, ...(errors.length ? { errors } : {}) };
}

/**
 * Acepta GET con parámetros y POST con JSON.
 *
 * El GET existe para que armar el Atajo sea una sola pegada: en
 * "Obtener contenido de la URL" el usuario pega UNA dirección y arrastra
 * la variable al final, sin tocar método ni cuerpo ni campos JSON. Que la
 * clave viaje en la URL es aceptable acá porque solo sirve para agregar
 * texto a la bandeja de su dueño: no lee nada ni borra nada.
 */
Deno.serve(async (req) => {
  let datos: { token?: string; texto?: string; origen?: string } = {};

  if (req.method === 'GET') {
    const url = new URL(req.url);
    datos = {
      token: url.searchParams.get('token') ?? undefined,
      texto: url.searchParams.get('texto') ?? undefined,
      origen: url.searchParams.get('origen') ?? undefined,
    };
  } else if (req.method === 'POST') {
    // Refuse oversized bodies BEFORE parsing them: the text is capped at
    // 2.000 characters anyway, and parsing megabytes of JSON is billed CPU.
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return responder(413, { error: 'El cuerpo es demasiado grande.' });
    }
    try {
      datos = await req.json();
    } catch {
      return responder(400, { error: 'Cuerpo inválido: se esperaba JSON.' });
    }
  } else {
    return responder(405, { error: 'Usa GET o POST.' });
  }

  const token = (datos.token ?? '').trim();
  const texto = (datos.texto ?? '').trim();

  if (!token) return responder(401, { error: 'Falta el token.' });
  if (!texto) return responder(400, { error: 'Falta el texto.' });
  if (texto.length > 2000) return responder(400, { error: 'El texto es demasiado largo.' });

  const origen = ORIGENES.has(datos.origen ?? '') ? datos.origen! : 'atajo';

  const { data: fila, error: errToken } = await admin
    .from('ingest_tokens')
    .select('id, user_id')
    .eq('token_hash', await sha256Hex(token))
    .maybeSingle();

  // Mismo mensaje y mismo tiempo de respuesta para token inexistente y
  // token equivocado: no hay nada que aprender probando.
  if (errToken || !fila) return responder(401, { error: 'Token inválido.' });

  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const [{ count: recent }, { count: pending }] = await Promise.all([
    admin.from('inbox').select('id', { count: 'exact', head: true })
      // status = pending so it rides the partial index inbox_pendientes_idx
      // instead of scanning every user's inbox; spam stays pending anyway.
      .eq('user_id', fila.user_id).eq('status', 'pending').gte('created_at', minuteAgo),
    admin.from('inbox').select('id', { count: 'exact', head: true })
      .eq('user_id', fila.user_id).eq('status', 'pending'),
  ]);
  if ((recent ?? 0) >= MAX_PER_MINUTE) {
    return responder(429, { error: 'Demasiados mensajes seguidos. Intenta en un minuto.' });
  }
  if ((pending ?? 0) >= MAX_PENDING) {
    return responder(429, { error: 'La bandeja está llena: revisa lo que tienes pendiente.' });
  }

  const { data: creada, error: errInsert } = await admin
    .from('inbox')
    .insert({ user_id: fila.user_id, texto, origen })
    .select('id')
    .single();

  if (errInsert || !creada) return responder(500, { error: 'No se pudo guardar.' });

  // Never fails the ingestion: the entry is already in the inbox.
  const push = await notify(fila.user_id, creada.id as string, texto, (pending ?? 0) + 1)
    .catch((e): PushReport => ({ subscriptions: 0, sent: 0, problem: String(e) }));
  if (push.problem || push.errors) console.error('ingest push', JSON.stringify(push));
  else console.log('ingest push', JSON.stringify(push));

  await admin
    .from('ingest_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', fila.id);

  // How the notification went: only counts and reasons, nothing of the user's.
  return responder(200, { ok: true, push });
});
