import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { createToken, hasToken, ingestUrl } from '@/data/supabase/inbox';
import { useSession } from '@/features/auth/useSession';
import { useT } from '@/i18n/language';
import { card, noteStyle } from './ui';

export const SHORTCUTS_GUIDE_URL = 'https://github.com/andressarmi11/step-up/blob/main/docs/ATAJOS_IOS.md';

/**
 * The token that iOS Shortcuts use to drop text into the inbox (Atajos de
 * iOS, redesign §9d).
 *
 * It exists because iOS doesn't open a URL inside an installed web app: a
 * Shortcut that opens a link lands in Safari, which has separate storage.
 * With this route the Shortcut doesn't open anything — it sends the text and moves on.
 *
 * The key is only readable the moment it's generated (the server keeps a
 * hash), so afterwards the card shows it masked and "Copiar" waits for a
 * new one.
 */
export function AutomationSection() {
  const { session } = useSession();
  const t = useT();
  const [token, setToken] = useState<string | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    void hasToken().then(setExists);
  }, [session]);

  if (!isSupabaseConfigured() || !session) {
    return <p style={{ ...noteStyle, margin: 0, fontSize: 'var(--text-sm)' }}>{t('set.shortcutsNeedAccount')}</p>;
  }

  async function generate() {
    setBusy(true);
    setError('');
    try {
      setToken(await createToken());
      setExists(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('automation.couldNotGenerate'));
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
      setError(t('automation.clipboardBlocked'));
    }
  }

  const smsUrl = token ? `${ingestUrl()}?origen=sms&token=${token}&texto=` : '';
  const dictationUrl = token ? `${ingestUrl()}?origen=dictado&token=${token}&texto=` : '';
  const masked = token ? `${token.slice(0, 4)}••••••••${token.slice(-4)}` : '••••••••••••';

  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: exists ? 'var(--positive)' : 'var(--line-strong)' }} />
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{exists ? t('set.keyActive') : t('set.keyNone')}</span>
        {exists && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('set.keySendOnly')}</span>}
      </div>

      {exists && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, background: 'var(--paper)', borderRadius: 12, padding: '10px 12px' }}>
          <span aria-label={t('set.keyMasked')} style={{ flex: 1, minWidth: 0, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {masked}
          </span>
          <button
            type="button"
            disabled={!token}
            onClick={() => copy(smsUrl, 'sms')}
            style={{
              border: 'none', background: 'var(--q10-soft)', color: 'var(--q10-text)', height: 30, padding: '0 12px',
              borderRadius: 15, fontWeight: 600, fontSize: 'var(--text-sm)', cursor: token ? 'pointer' : 'not-allowed',
              opacity: token ? 1 : 0.5, flex: 'none',
            }}
          >
            {copied === 'sms' ? t('automation.copiedTick') : t('automation.copy')}
          </button>
        </div>
      )}
      {token ? (
        <p style={{ margin: '8px 2px 0', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--positive-text)' }}>{t('automation.copyNow')}</p>
      ) : exists ? (
        <p style={{ margin: '8px 2px 0', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', lineHeight: 1.45 }}>{t('set.keyOnlyOnce')}</p>
      ) : null}

      {token && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('set.moreAddresses')}</summary>
          <p style={{ margin: '8px 0 4px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>{t('automation.forDictationShortcut')}</p>
          <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', marginBottom: 6, color: 'var(--text)' }}>{dictationUrl}</code>
          <button type="button" onClick={() => copy(dictationUrl, 'dictado')} style={{ ...btn, marginBottom: 10 }}>
            {copied === 'dictado' ? t('automation.copiedTick') : t('automation.copyDictationAddress')}
          </button>
          <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', margin: '6px 0', color: 'var(--text-muted)' }}>{token}</code>
          <button type="button" onClick={() => copy(token, 'token')} style={btn}>
            {copied === 'token' ? t('automation.copiedTick') : t('automation.copyKeyAlone')}
          </button>
        </details>
      )}

      <button type="button" onClick={generate} disabled={busy} style={{ ...btn, width: '100%', marginTop: 12 }}>
        {busy ? t('automation.generating') : exists ? t('automation.generateNewKey') : t('automation.generateKey')}
      </button>
      {exists && <p style={{ margin: '8px 2px 0', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', lineHeight: 1.45 }}>{t('set.newKeyWarning')}</p>}
      {error && <p role="alert" style={{ color: 'var(--danger-text)', fontSize: 'var(--text-sm)', margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}

const btn: React.CSSProperties = {
  minHeight: 44, padding: '0 16px', borderRadius: 12,
  border: '1px solid var(--line-strong)', background: 'transparent',
  color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-base)',
};
