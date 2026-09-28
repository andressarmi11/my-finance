import { Component, type ReactNode } from 'react';
import { translate } from '@/i18n/language';

/**
 * Turns a blank screen into a message that can be resolved.
 *
 * Born from a concrete case: Analytics is the only route loaded with
 * lazy(), its file carries a hash that changes on every deploy, and the app
 * is a PWA that caches. A browser with the old index would request a file
 * that no longer existed, the import would fail, and since there was no
 * error boundary React would unmount the WHOLE tree: blank screen, no
 * message, no way out except closing and reopening.
 *
 * For that specific case —a chunk that's gone— it reloads itself once,
 * because the real fix is fetching the new index and there's nothing the
 * user can decide there. For any other error it shows the message
 * and leaves the button, without reloading in a loop.
 */

const RELOAD_MARK = 'myfinance:recarga-por-chunk';

/** Is this the "the file I requested no longer exists" failure? */
function isStaleChunk(error: unknown): boolean {
  const m = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(m);
}

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (!isStaleChunk(error)) return;
    // Only once: if reloading doesn't fix it, better to show the message
    // than to leave the user in a reload loop.
    try {
      if (sessionStorage.getItem(RELOAD_MARK)) return;
      sessionStorage.setItem(RELOAD_MARK, '1');
    } catch {
      return; // without sessionStorage we won't risk the loop
    }
    window.location.reload();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const byUpdate = isStaleChunk(error);
    return (
      <div style={{ padding: 'var(--gap-l)', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 34, margin: '24px 0 8px' }} aria-hidden>🌀</p>
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 6px' }}>
          {translate(byUpdate ? 'error.appUpdated' : 'error.somethingBroke')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', margin: '0 0 18px', lineHeight: 'var(--lh-normal)' }}>
          {translate(byUpdate ? 'error.appUpdatedBody' : 'error.somethingBrokeBody')}
        </p>
        <button
          type="button"
          onClick={() => {
            try { sessionStorage.removeItem(RELOAD_MARK); } catch { /* no big deal */ }
            window.location.reload();
          }}
          style={{
            width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none',
            background: 'var(--q10)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
          }}
        >
          Recargar
        </button>
        {!byUpdate && (
          <details style={{ marginTop: 16, textAlign: 'left' }}>
            <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', cursor: 'pointer' }}>
              {translate('error.technicalDetail')}
            </summary>
            <pre style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8 }}>
              {error.message}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
