import { useT } from '@/i18n/idioma';
import { IconDeviceMobileShare } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { isIOS, isStandalone } from '@/lib/platform';

const DISMISS_KEY = 'myfinance:install-banner-dismissed';

/**
 * iOS no dispara "beforeinstallprompt" ni permite programar notificaciones
 * si la pagina esta abierta en una pestaña normal de Safari — hay que
 * estar instalado en la pantalla de inicio. Este banner explica como,
 * en vez de mostrar un boton de "activar notificaciones" que no haria nada.
 *
 * Y avisa lo que nadie espera: en iOS la app instalada tiene su PROPIO
 * almacenamiento, separado del de Safari. Lo cargado en la pestaña no
 * aparece en la app instalada. Lo unico que cruza es la cuenta: al entrar
 * con el mismo correo, useCloudSync baja todo. Sin ese aviso la gente
 * instala, ve la app vacia y cree que perdio sus datos.
 */
export function InstallBanner() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // Si localStorage no esta disponible, igual mostramos el banner.
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* no-op */ }
  }

  return (
    <div
      role="note"
      style={{
        // Compacto: ocupaba un tercio de la pantalla en iPhone.
        margin: '0 var(--gap-l) var(--gap-m)', padding: '8px 12px', borderRadius: 'var(--radius-s)',
        maxWidth: 560, marginInline: 'auto',
        background: 'var(--q10-soft)', border: '1px solid var(--q10)', display: 'flex', gap: 8, alignItems: 'center',
      }}
    >
      <IconDeviceMobileShare size={18} stroke={1.75} aria-hidden style={{ flex: 'none' }} />
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text)', flex: 1, lineHeight: 1.35 }}>
        {t('instalar.como')} <strong>{t('instalar.compartir')}</strong> → <strong>{t('instalar.agregar')}</strong>.
        {' '}{t('instalar.detalle')}
      </p>
      <button
        type="button" onClick={dismiss} aria-label={t('accion.cerrar')}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
