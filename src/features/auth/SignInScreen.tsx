import { useState } from 'react';
import { getSupabase } from '@/data/supabase/client';
import { botonStyle, enlaceStyle, inputStyle, MIN_CLAVE, traducirError } from './authStyles';
import { Logo } from '@/components/ui/Logo';

type Modo = 'entrar' | 'crear' | 'olvide';

/**
 * Cuenta con correo y contraseña. Antes era magic link, que en el iPhone
 * es incómodo (hay que salir al correo y volver) y encima abre el enlace
 * en Safari, no en la app instalada — que tiene su propio almacenamiento,
 * así que la sesión caía del lado equivocado.
 *
 * Con correo+contraseña entras en cualquier dispositivo, y eso es lo que
 * hace que los datos te sigan: al iniciar sesión se baja todo de la nube
 * (ver useCloudSync).
 *
 * El cambio de contraseña NO vive acá: vive en NewPasswordScreen, arriba
 * de AuthGate, porque el enlace de recuperación llega con sesión abierta.
 */
export function SignInScreen() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const supabase = await getSupabase();

      if (modo === 'crear') {
        if (clave.length < MIN_CLAVE) throw new Error(`La contraseña necesita al menos ${MIN_CLAVE} caracteres.`);
        const { data, error: err } = await supabase.auth.signUp({ email, password: clave });
        if (err) throw err;
        // Si el proyecto exige confirmar el correo, no hay sesión todavía.
        if (!data.session) {
          setAviso('Cuenta creada. Confirma el correo que te enviamos y vuelve a entrar.');
          setModo('entrar');
        }
        return;
      }

      if (modo === 'entrar') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password: clave });
        if (err) throw err;
        return;
      }

      // olvide
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (err) throw err;
      setAviso(`Te enviamos un enlace a ${email}. Ábrelo y te va a pedir la contraseña nueva.`);
    } catch (e) {
      setError(traducirError(e));
    } finally {
      setOcupado(false);
    }
  }

  const pideClave = modo !== 'olvide';

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--gap-l)' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Logo size={76} tile />
        </div>
        <h1 className="figures" style={{ textAlign: 'center', fontSize: 'var(--text-2xl)', fontWeight: 700, letterSpacing: '-0.022em', margin: '0 0 4px' }}>
          Step up
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0 0 24px', fontSize: 'var(--text-base)' }}>
          {modo === 'crear' ? 'Crea tu cuenta y tus datos te siguen a cualquier dispositivo.'
            : modo === 'olvide' ? 'Te enviamos un enlace para cambiarla.'
            : 'Entra y tus datos aparecen donde estés.'}
        </p>

        {modo !== 'olvide' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <Pestana activa={modo === 'entrar'} onClick={() => { setModo('entrar'); setError(''); }}>
              Ya tengo cuenta
            </Pestana>
            <Pestana activa={modo === 'crear'} onClick={() => { setModo('crear'); setError(''); }}>
              Crear cuenta
            </Pestana>
          </div>
        )}

        <form onSubmit={enviar}>
          <input
            type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com"
            aria-label="Correo"
            style={inputStyle}
          />
          {pideClave && (
            <input
              type="password" required
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              minLength={modo === 'entrar' ? undefined : MIN_CLAVE}
              value={clave} onChange={(e) => setClave(e.target.value)}
              placeholder={modo === 'entrar' ? 'Tu contraseña' : `Contraseña (mínimo ${MIN_CLAVE})`}
              aria-label="Contraseña"
              style={inputStyle}
            />
          )}

          <button type="submit" disabled={ocupado} style={botonStyle}>
            {ocupado ? 'Un momento…'
              : modo === 'crear' ? 'Crear cuenta'
              : modo === 'olvide' ? 'Enviar enlace'
              : 'Entrar'}
          </button>
        </form>

        {modo === 'entrar' && (
          <button type="button" onClick={() => { setModo('olvide'); setError(''); }} style={enlaceStyle}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
        {modo === 'olvide' && (
          <button type="button" onClick={() => { setModo('entrar'); setError(''); setAviso(''); }} style={enlaceStyle}>
            Volver a entrar
          </button>
        )}

        {error && <p role="alert" style={{ color: 'var(--danger-text)', fontSize: 'var(--text-sm)', marginTop: 12, textAlign: 'center' }}>{error}</p>}
        {aviso && <p style={{ color: 'var(--positive-text)', fontSize: 'var(--text-sm)', marginTop: 12, textAlign: 'center' }}>{aviso}</p>}
      </div>
    </div>
  );
}

/* Las pestañas no pueden llamarse igual que el botón de enviar ("Entrar"):
   dos controles con el mismo nombre accesible dejan al lector de pantalla
   sin forma de distinguirlos. */
function Pestana({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={activa}
      style={{
        flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)',
        border: `1px solid ${activa ? 'var(--q10)' : 'var(--line-strong)'}`,
        background: activa ? 'var(--q10)' : 'var(--surface)',
        color: activa ? '#fff' : 'var(--text)',
        fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
