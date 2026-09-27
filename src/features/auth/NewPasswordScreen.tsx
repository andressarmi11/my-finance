import { IconKey } from '@tabler/icons-react';
import { useState } from 'react';
import { getSupabase } from '@/data/supabase/client';
import { salirDeRecuperacion } from './recovery';
import { botonStyle, enlaceStyle, inputStyle, MIN_CLAVE, traducirError } from './authStyles';

/**
 * Se muestra al abrir el enlace de "olvidé mi contraseña", ANTES de dejar
 * entrar a la app.
 *
 * El enlace abre sesión por su cuenta, así que sin esta pantalla el efecto
 * era entrar directo y no poder cambiar nada — que es justo lo que uno fue
 * a hacer. Ver recovery.ts.
 */
export function NewPasswordScreen() {
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  const coinciden = clave.length > 0 && clave === repetir;
  const puedeGuardar = clave.length >= MIN_CLAVE && coinciden && !ocupado;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeGuardar) return;
    setOcupado(true);
    setError('');
    try {
      const supabase = await getSupabase();
      const { error: err } = await supabase.auth.updateUser({ password: clave });
      if (err) throw err;
      setListo(true);
      // Un respiro para que se lea el mensaje antes de que aparezca la app.
      setTimeout(salirDeRecuperacion, 1200);
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    // Cerrar sesión a propósito: la sesión de recuperación entró sin que
    // nadie escribiera una contraseña. Dejarla abierta sería una puerta
    // sin llave para quien tenga el enlace del correo.
    try {
      const supabase = await getSupabase();
      await supabase.auth.signOut();
    } finally {
      salirDeRecuperacion();
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--gap-l)' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <p style={{ textAlign: 'center', margin: '0 0 10px', color: 'var(--q10)' }}>
          <IconKey size={38} stroke={1.6} aria-hidden />
        </p>
        <h1 style={{ textAlign: 'center', fontSize: 'var(--text-xl)', fontWeight: 700, margin: '0 0 4px' }}>
          Contraseña nueva
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0 0 24px', fontSize: 'var(--text-base)' }}>
          Elige la que vas a usar de ahora en adelante.
        </p>

        {listo ? (
          <p role="status" style={{ textAlign: 'center', color: 'var(--positive-text)', fontWeight: 600 }}>
            Contraseña actualizada. Entrando…
          </p>
        ) : (
          <form onSubmit={guardar}>
            <input
              type="password" required autoFocus autoComplete="new-password" minLength={MIN_CLAVE}
              value={clave} onChange={(e) => setClave(e.target.value)}
              placeholder={`Contraseña nueva (mínimo ${MIN_CLAVE})`}
              aria-label="Contraseña nueva"
              style={inputStyle}
            />
            <input
              type="password" required autoComplete="new-password"
              value={repetir} onChange={(e) => setRepetir(e.target.value)}
              placeholder="Repetirla"
              aria-label="Repetir la contraseña"
              style={{
                ...inputStyle,
                borderColor: repetir.length > 0 && !coinciden ? 'var(--danger)' : 'var(--line-strong)',
              }}
            />
            {repetir.length > 0 && !coinciden && (
              <p style={{ margin: '-4px 0 10px', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>
                Las dos contraseñas no son iguales.
              </p>
            )}

            <button type="submit" disabled={!puedeGuardar} style={{ ...botonStyle, opacity: puedeGuardar ? 1 : 0.5 }}>
              {ocupado ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        {!listo && (
          <button type="button" onClick={cancelar} style={enlaceStyle}>
            Cancelar y volver a entrar
          </button>
        )}

        {error && (
          <p role="alert" style={{ color: 'var(--danger-text)', fontSize: 'var(--text-sm)', marginTop: 12, textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
