import { createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * True inside the right-hand panel of Ajustes on desktop (§9g 2c): the
 * sub-screens render there instead of being pushed, so they drop the
 * "‹ Ajustes" link (the list is right beside them) and the 560px column.
 */
export const SettingsPanelContext = createContext(false);

const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

/** Standard container: one width, one padding, across the whole app.
 *  Header with a large title (32px). `right` slot for contextual actions
 *  (filter buttons, edit, etc). `back` puts a "‹ label" link above the title,
 *  for screens that hang from another one (Movimientos from Inicio, the
 *  Ajustes sub-screens from Ajustes). */
export function Screen({ title, subtitle, right, back, backAction, wide, hideTitle = false, panelFree = false, children }: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  back?: { label: string; to: string };
  /** An action on the same row as `back`, at the right ("Seleccionar"). */
  backAction?: ReactNode;
  /** On desktop (≥1100px) use the full content width instead of 560px. */
  wide?: boolean;
  /** The screen shows its own header (Perfil: the big avatar): the title
   *  stays for screen readers, out of sight. */
  hideTitle?: boolean;
  /** In the desktop Ajustes panel: lay out its own cards instead of being one. */
  panelFree?: boolean;
  children?: ReactNode;
}) {
  const inPanel = useContext(SettingsPanelContext);
  if (inPanel && back?.to === '/ajustes') back = undefined;
  return (
    <div className={inPanel ? (panelFree ? 'screen screen-panel panel-free' : 'screen screen-panel') : wide ? 'screen screen-wide' : 'screen'}>
      {(back || backAction) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 44 }}>
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
        style={hideTitle ? SR_ONLY : {
          // With a subtitle the prototype sets the title closer (4px) and
          // leaves 18px under the pair.
          margin: subtitle ? '4px 0 18px' : back || backAction ? '6px 0 16px' : '8px 0 16px',
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
        <div style={{ flex: '1 1 150px', minWidth: 0 }}>
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
                margin: '4px 0 0',
                color: 'var(--text-muted)',
                fontSize: 14,
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
