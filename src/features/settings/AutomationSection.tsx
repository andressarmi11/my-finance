import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { createToken, hasToken, ingestUrl } from '@/data/supabase/inbox';
import { useSession } from '@/features/auth/useSession';
import { useT } from '@/i18n/language';

/**
 * The token that iOS Shortcuts use to drop text into the inbox.
 *
 * It exists because iOS doesn't open a URL inside an installed web app: a
 * Shortcut that opens a link lands in Safari, which has separate storage.
 * With this route the Shortcut doesn't open anything — it sends the text and moves on.
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

  if (!isSupabaseConfigured() || !session) return null;

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

  return (
    <section style={{ marginBottom: 'var(--gap-xl)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 10px' }}>
        {t('automation.titleFull')}
      </h2>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 'var(--lh-normal)' }}>
        {t('automation.intro')}
      </p>

      {token ? (
        <div style={{ background: 'var(--positive-soft)', border: '1px solid var(--positive)', borderRadius: 'var(--radius-s)', padding: '12px 14px', marginBottom: 10 }}>
          <p style={{ margin: '0 0 8px', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            {t('automation.copyNow')}
          </p>

          {/* What actually needs to be pasted: the address with the key
              inside. A single copy, and in the Shortcut all that's left is dragging the
              message variable to the end. */}
          <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>
            {t('automation.forSmsShortcut')}
          </p>
          <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', marginBottom: 6, color: 'var(--text)' }}>
            {`${ingestUrl()}?origen=sms&token=${token}&texto=`}
          </code>
          <button
            type="button"
            onClick={() => copy(`${ingestUrl()}?origen=sms&token=${token}&texto=`, 'sms')}
            style={{ ...btn, marginBottom: 10 }}
          >
            {copied === 'sms' ? t('automation.copiedTick') : t('automation.copySmsAddress')}
          </button>

          <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>
            {t('automation.forDictationShortcut')}
          </p>
          <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', marginBottom: 6, color: 'var(--text)' }}>
            {`${ingestUrl()}?origen=dictado&token=${token}&texto=`}
          </code>
          <button
            type="button"
            onClick={() => copy(`${ingestUrl()}?origen=dictado&token=${token}&texto=`, 'dictado')}
            style={{ ...btn, marginBottom: 10 }}
          >
            {copied === 'dictado' ? t('automation.copiedTick') : t('automation.copyDictationAddress')}
          </button>

          <details>
            <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {t('automation.showKeyOnly')}
            </summary>
            <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', margin: '6px 0', color: 'var(--text-muted)' }}>
              {token}
            </code>
            <button type="button" onClick={() => copy(token, 'token')} style={btn}>
              {copied === 'token' ? t('automation.copiedTick') : t('automation.copyKeyAlone')}
            </button>
          </details>
        </div>
      ) : (
        <button type="button" onClick={generate} disabled={busy} style={{ ...btn, width: '100%', marginBottom: 10 }}>
          {busy ? t('automation.generating') : exists ? t('automation.generateNewKey') : t('automation.generateKey')}
        </button>
      )}

      {exists && !token && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', margin: '0 0 10px' }}>
          {t('automation.alreadyHasKey')}
        </p>
      )}

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', margin: '10px 0 0', lineHeight: 'var(--lh-normal)' }}>
        {t('automation.shortcutStepsBefore')} <strong>{t('automation.shortcutStepsAction')}</strong>,{' '}
        {t('automation.shortcutStepsTail')}
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
