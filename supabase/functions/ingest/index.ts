// Edge Function: ingest
//
// Recibe texto crudo de un Atajo de iOS y lo deja en la bandeja del
// usuario. Es el camino que hace que la automatización del SMS no tenga
// que abrir nada: el Atajo manda el mensaje acá y sigue de largo.
//
// A propósito NO interpreta el texto. El parser vive en la app
// (src/domain/nlp) y hay uno solo; duplicarlo en Deno sería garantizar que
// los dos digan cosas distintas con el tiempo.
//
// Autenticación: un token de un solo propósito por usuario, guardado
// hasheado en ingest_tokens. Solo permite AGREGAR a la bandeja — no lee
// movimientos ni configuración. Si se filtra, lo peor es basura en la
// bandeja, que el usuario ve antes de confirmar.
//
// Desplegar: supabase functions deploy ingest --no-verify-jwt
//   (--no-verify-jwt porque el Atajo no tiene sesión de Supabase; la
//    autenticación la hace esta función con su propio token.)

import { createClient } from 'npm:@supabase/supabase-js@2';

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

  const { error: errInsert } = await admin
    .from('inbox')
    .insert({ user_id: fila.user_id, texto, origen });

  if (errInsert) return responder(500, { error: 'No se pudo guardar.' });

  await admin
    .from('ingest_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', fila.id);

  return responder(200, { ok: true });
});
