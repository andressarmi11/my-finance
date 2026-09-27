import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { createToken, hasToken, ingestUrl } from '@/data/supabase/inbox';
import { useSession } from '@/features/auth/useSession';

/**
 * The token that iOS Shortcuts use to drop text into the inbox.
 *
 * It exists because iOS doesn't open a URL inside an installed web app: a
 * Shortcut that opens a link lands in Safari, which has separate storage.
 * With this route the Shortcut doesn't open anything — it sends the text and moves on.
 */
export function AutomationSection() {
  const { session } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [exists, setExiste] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    void hasToken().then(setExiste);
  }, [session]);

  if (!isSupabaseConfigured() || !session) return null;

  async function generate() {
    setBusy(true);
    setError('');
    try {
      setToken(await createToken());
      setExiste(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, que: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(que);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError('Tu navegador no dejó copiar. Selecciona el texto a mano.');
    }
  }

  return (
    <section style={{ marginBottom: 'var(--gap-xl)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 10px' }}>
        Automatizaciones (Atajos)
      </h2>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 'var(--lh-normal)' }}>
        Un Atajo puede mandarte movimientos sin abrir nada: llegan acá y los
        confirmás cuando abras la app. Necesita una clave propia, que solo
        sirve para eso — no puede leer ni borrar nada tuyo.
      </p>

      {token ? (
        <div style={{ background: 'var(--positive-soft)', border: '1px solid var(--positive)', borderRadius: 'var(--radius-s)', padding: '12px 14px', marginBottom: 10 }}>
          <p style={{ margin: '0 0 8px', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            Cópialo ahora: no se vuelve a mostrar.
          </p>

          {/* What actually needs to be pasted: the address with the key
              inside. A single copy, and in the Shortcut all that's left is dragging the
              message variable to the end. */}
          <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>
            Para el Atajo del SMS
          </p>
          <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', marginBottom: 6, color: 'var(--text)' }}>
            {`${ingestUrl()}?origen=sms&token=${token}&texto=`}
          </code>
          <button
            type="button"
            onClick={() => copy(`${ingestUrl()}?origen=sms&token=${token}&texto=`, 'sms')}
            style={{ ...btn, marginBottom: 10 }}
          >
            {copied === 'sms' ? 'Copiada ✓' : 'Copiar dirección del SMS'}
          </button>

          <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>
            Para el Atajo de dictado
          </p>
          <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', marginBottom: 6, color: 'var(--text)' }}>
            {`${ingestUrl()}?origen=dictado&token=${token}&texto=`}
          </code>
          <button
            type="button"
            onClick={() => copy(`${ingestUrl()}?origen=dictado&token=${token}&texto=`, 'dictado')}
            style={{ ...btn, marginBottom: 10 }}
          >
            {copied === 'dictado' ? 'Copiada ✓' : 'Copiar dirección del dictado'}
          </button>

          <details>
            <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Ver solo la clave
            </summary>
            <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', margin: '6px 0', color: 'var(--text-muted)' }}>
              {token}
            </code>
            <button type="button" onClick={() => copy(token, 'token')} style={btn}>
              {copied === 'token' ? 'Copiada ✓' : 'Copiar clave sola'}
            </button>
          </details>
        </div>
      ) : (
        <button type="button" onClick={generate} disabled={busy} style={{ ...btn, width: '100%', marginBottom: 10 }}>
          {busy ? 'Generando…' : exists ? 'Generar una clave nueva' : 'Generar clave'}
        </button>
      )}

      {exists && !token && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', margin: '0 0 10px' }}>
          Ya tienes una clave. Generar otra reemplaza la anterior, y los Atajos
          que usen la vieja dejan de funcionar.
        </p>
      )}

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', margin: '10px 0 0', lineHeight: 'var(--lh-normal)' }}>
        En el Atajo: una acción <strong>Obtener contenido de la URL</strong>,
        pegas la dirección de arriba y arrastras al final la variable del
        mensaje. Nada más: ni método, ni cuerpo, ni campos JSON.
        El paso a paso completo está en docs/ATAJOS_IOS.md.
      </p>

      {error && <p style={{ color: 'var(--danger-text)', fontSize: 'var(--text-sm)', marginTop: 8 }}>{error}</p>}
    </section>
  );
}

const btn: React.CSSProperties = {
  minHeight: 44, padding: '0 16px', borderRadius: 'var(--radius-s)',
  border: '1px solid var(--line-strong)', background: 'var(--surface)',
  color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-base)',
};
