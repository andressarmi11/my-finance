// Edge Function: send-reminders
//
// Corre en Deno (runtime de Supabase Edge Functions). La llama pg_cron
// cada 15 minutos (ver supabase/migrations/0003_reminder_cron.sql).
//
// Que hace:
//   1. Busca reminders con status='scheduled' y remind_at <= ahora.
//   2. Para cada uno, busca las push_subscriptions del mismo usuario.
//   3. Envia un Web Push firmado con VAPID a cada suscripcion.
//   4. Marca el reminder como 'sent' (o 'failed' si todas las
//      suscripciones de ese usuario fallaron).
//
// Variables de entorno requeridas (secrets de la funcion, NUNCA en el
// codigo): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tucorreo@dominio.com).
//
// Desplegar con: supabase functions deploy send-reminders --no-verify-jwt
//   (--no-verify-jwt: quien la llama es pg_cron, que no tiene sesión; la
//    autorización es CRON_SECRET, que esta función verifica ella misma.)
// Configurar secrets con: supabase secrets set VAPID_PUBLIC_KEY=... etc.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@example.com';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

interface ReminderRow {
  id: string;
  user_id: string;
  transaction_id: string;
  remind_at: string;
}
interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
interface TransactionRow {
  id: string;
  concept: string;
  amount: number;
}

/**
 * Constant-time equality. Written out because crypto.subtle.timingSafeEqual
 * exists in Deno but not in Supabase's edge runtime (it answered 500).
 */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

Deno.serve(async (req) => {
  // La funcion solo la debe llamar el cron (con el secret configurado),
  // nunca el cliente directamente.
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  // Without a secret configured, "Bearer " would be the password: anyone
  // could invoke this — and every invocation is billed. Constant-time, so
  // response timing says nothing about how much of a guess was right.
  const got = new TextEncoder().encode(req.headers.get('Authorization') ?? '');
  const want = new TextEncoder().encode(`Bearer ${secret}`);
  if (!secret || !sameBytes(got, want)) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Test mode: one notification to one user's devices, touching no data.
  // Behind the same secret as the cron, so only whoever holds it can fire it.
  const body = await req.json().catch(() => ({})) as { test?: boolean; userId?: string };
  if (body.test && body.userId) {
    const { data: subs } = await supabase
      .from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', body.userId);
    const payload = JSON.stringify({ title: 'Step up', body: '🔔 Prueba: los recordatorios ya te llegan.' });
    let delivered = 0;
    const errors: string[] = [];
    for (const sub of (subs ?? []) as SubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { timeout: 10_000, TTL: 60 * 60 },
        );
        delivered += 1;
      } catch (err) {
        errors.push(String((err as { statusCode?: number }).statusCode ?? err));
      }
    }
    return new Response(JSON.stringify({ subscriptions: subs?.length ?? 0, delivered, errors }), { status: 200 });
  }

  const { data: dueReminders, error: remindersError } = await supabase
    .from('reminders')
    .select('id, user_id, transaction_id, remind_at')
    .eq('status', 'scheduled')
    .lte('remind_at', new Date().toISOString())
    .limit(200);

  if (remindersError) {
    return new Response(JSON.stringify({ error: remindersError.message }), { status: 500 });
  }
  if (!dueReminders || dueReminders.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  let sent = 0;
  let failed = 0;

  // Two queries for the whole batch instead of two per reminder: with the
  // 200-row cap that was up to 400 round-trips per run, every 15 minutes.
  const reminders = dueReminders as ReminderRow[];
  const userIds = [...new Set(reminders.map((r) => r.user_id))];
  const txIds = [...new Set(reminders.map((r) => r.transaction_id))];
  const [{ data: allSubs }, { data: allTx }] = await Promise.all([
    supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds),
    supabase.from('transactions').select('id, user_id, concept, amount').in('id', txIds),
  ]);
  const subsByUser = new Map<string, SubscriptionRow[]>();
  for (const sub of (allSubs ?? []) as Array<SubscriptionRow & { user_id: string }>) {
    subsByUser.set(sub.user_id, [...(subsByUser.get(sub.user_id) ?? []), sub]);
  }
  // Keyed by owner as well: a reminder never reveals someone else's movement
  // (the FK enforces it too, since 0011).
  const txById = new Map(((allTx ?? []) as Array<TransactionRow & { user_id: string }>)
    .map((t) => [`${t.user_id}:${t.id}`, t]));

  for (const reminder of reminders) {
    const subs = subsByUser.get(reminder.user_id) ?? [];
    const transaction = txById.get(`${reminder.user_id}:${reminder.transaction_id}`) ?? null;
    const payload = JSON.stringify({
      title: 'Step up',
      body: transaction
        ? `Recuerda: ${transaction.concept} — $${Number(transaction.amount).toLocaleString('es-CO')}`
        : 'Tienes un pago próximo.',
    });

    let anySucceeded = false;
    for (const sub of subs) {
      try {
        // A push service that never answers used to hold the whole run —
        // billed by wall-clock time — until the platform killed it.
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { timeout: 10_000, TTL: 24 * 60 * 60 },
        );
        anySucceeded = true;
      } catch (err) {
        // Suscripcion vencida o invalida (410/404): se elimina para no
        // reintentarla siempre. Otros errores solo se registran.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error(`Push fallido para suscripcion ${sub.id}:`, err);
        }
      }
    }

    await supabase
      .from('reminders')
      .update({ status: anySucceeded ? 'sent' : 'failed', sent_at: new Date().toISOString() })
      .eq('id', reminder.id);

    if (anySucceeded) sent += 1; else failed += 1;
  }

  return new Response(JSON.stringify({ sent, failed }), { status: 200 });
});
