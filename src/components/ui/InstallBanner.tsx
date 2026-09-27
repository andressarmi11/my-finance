import { useT } from '@/i18n/language';
import { IconDeviceMobileShare } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { isIOS, isStandalone } from '@/lib/platform';

const DISMISS_KEY = 'myfinance:install-banner-dismissed';

/**
 * iOS doesn't fire "beforeinstallprompt" nor does it allow scheduling
 * notifications if the page is open in a regular Safari tab — it has to
 * be installed on the home screen. This banner explains how,
 * instead of showing an "enable notifications" button that would do nothing.
 *
 * And it warns about what nobody expects: on iOS the installed app has its
 * OWN storage, separate from Safari's. What was loaded in the tab doesn't
 * show up in the installed app. The only thing that carries over is the
 * account: signing in with the same email, useCloudSync pulls everything
 * down. Without this notice people install, see the app empty and think
 * they lost their data.
 */
export function InstallBanner() {
  const t = useT();
  const [visibleRows, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // If localStorage isn't available, we still show the banner.
    }
    setVisible(true);
  }, []);

  if (!visibleRows) return null;

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* no-op */ }
  }

  return (
    <div
      role="note"
      style={{
        // Compact: it used to take up a third of the screen on iPhone.
        margin: '0 var(--gap-l) var(--gap-m)', padding: '8px 12px', borderRadius: 'var(--radius-s)',
        maxWidth: 560, marginInline: 'auto',
        background: 'var(--q10-soft)', border: '1px solid var(--q10)', display: 'flex', gap: 8, alignItems: 'center',
      }}
    >
      <IconDeviceMobileShare size={18} stroke={1.75} aria-hidden style={{ flex: 'none' }} />
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text)', flex: 1, lineHeight: 1.35 }}>
        {t('install.how')} <strong>{t('install.share')}</strong> → <strong>{t('install.add')}</strong>.
        {' '}{t('install.detail')}
      </p>
      <button
        type="button" onClick={dismiss} aria-label={t('action.close')}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
