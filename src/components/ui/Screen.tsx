import type { ReactNode } from 'react';

/** Standard container: one width, one padding, across the whole app.
 *  Header with an iOS 18 large title (34pt SF Pro Rounded). `right` slot for
 *  contextual actions (filter buttons, edit, etc). */
export function Screen({ title, subtitle, right, children }: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 var(--gap-l)' }}>
      <header
        style={{
          marginBottom: 'var(--gap-l)',
          display: 'flex',
          // wrap + a minimum base for the title: when the right slot
          // doesn't fit —for example the month navigator with the Today button—
          // it drops to its own line instead of overlapping the title.
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ flex: '1 1 190px', minWidth: 0 }}>
          <h1
            className="figures"
            style={{
              margin: 0,
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              letterSpacing: '-0.022em',
              lineHeight: 'var(--lh-tight)',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                margin: '2px 0 0',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-base)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {right && <div style={{ flex: 'none' }}>{right}</div>}
      </header>
      {children}
    </div>
  );
}
