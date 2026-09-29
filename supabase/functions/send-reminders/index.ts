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
// Desplegar con: supabase functions deploy send-reminders
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

Deno.serve(async (req) => {
  // La funcion solo la debe llamar el cron (con el secret configurado),
  // nunca el cliente directamente.
  const auth = req.headers.get('Authorization');
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  // Without a secret configured, "Bearer " would be the password: anyone
  // could invoke this — and every invocation is billed.
  if (!secret || !auth || auth !== `Bearer ${secret}`) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

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
    supabase.from('transactions').select('id, concept, amount').in('id', txIds),
  ]);
  const subsByUser = new Map<string, SubscriptionRow[]>();
  for (const sub of (allSubs ?? []) as Array<SubscriptionRow & { user_id: string }>) {
    subsByUser.set(sub.user_id, [...(subsByUser.get(sub.user_id) ?? []), sub]);
  }
  const txById = new Map(((allTx ?? []) as TransactionRow[]).map((t) => [t.id, t]));

  for (const reminder of reminders) {
    const subs = subsByUser.get(reminder.user_id) ?? [];
    const transaction = txById.get(reminder.transaction_id) ?? null;
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
