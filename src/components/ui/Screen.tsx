import { createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * True inside the right-hand panel of Ajustes on desktop (§9g 2c): the
 * sub-screens render there instead of being pushed, so they drop the
 * "‹ Ajustes" link (the list is right beside them) and the 560px column.
 */
export const SettingsPanelContext = createContext(false);

/** Standard container: one width, one padding, across the whole app.
 *  Header with a large title (32px). `right` slot for contextual actions
 *  (filter buttons, edit, etc). `back` puts a "‹ label" link above the title,
 *  for screens that hang from another one (Movimientos from Inicio, the
 *  Ajustes sub-screens from Ajustes). */
export function Screen({ title, subtitle, right, back, backAction, wide, children }: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: { label: string; to: string };
  /** An action on the same row as `back`, at the right ("Seleccionar"). */
  backAction?: ReactNode;
  /** On desktop (≥1100px) use the full content width instead of 560px. */
  wide?: boolean;
  children?: ReactNode;
}) {
  const inPanel = useContext(SettingsPanelContext);
  if (inPanel && back?.to === '/ajustes') back = undefined;
  return (
    <div className={inPanel ? 'screen screen-panel' : wide ? 'screen screen-wide' : 'screen'}>
      {(back || backAction) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
      {back ? (
        <Link
          to={back.to}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            minHeight: 'var(--tap)',
            color: 'var(--q10-text)', fontSize: 'var(--text-md)', fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1, marginTop: -2 }}>‹</span>
          {back.label}
        </Link>
      ) : <span />}
          {backAction}
        </div>
      )}
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
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.025em',
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
