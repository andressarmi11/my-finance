import { Children, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SettingsPanelContext } from '@/components/ui/Screen';
import { useDialogo } from '@/components/ui/useDialogo';
import { useT } from '@/i18n/language';
import { fill } from '@/lib/dateLabels';

/**
 * The building blocks of the grouped Settings list (redesign §7) and its
 * sub-screens: a titled group card, a 52px row, a stepper, an iOS switch and
 * a bottom sheet. One look for every Settings screen, so each sub-screen is
 * a thin layer over the logic it already had.
 */

/** "Preferencias", "Cuenta"…: 13px/600 in --text-faint, then the card. */
export function SettingsGroup({ title, right, children, note, style, cardClassName }: {
  title?: string;
  /** Small text at the right of the title ("2 de 3"). */
  right?: ReactNode;
  children: ReactNode;
  /** 12px explanation under the card. */
  note?: ReactNode;
  style?: React.CSSProperties;
  /** A hook for layout CSS (e.g. two columns in the desktop panel). */
  cardClassName?: string;
}) {
  // Conditional rows come in as null/false: only real ones get a divider.
  const rows = Children.toArray(children);
  // Inside the desktop panel's card the lists sit on --paper, not on a
  // second card (prototype 2c).
  const inPanel = useContext(SettingsPanelContext);
  return (
    <section style={{ marginTop: title ? 0 : 22, ...style }}>
      {title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '22px 6px 8px' }}>
          <h2 style={groupTitle}>{title}</h2>
          {right && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>{right}</span>}
        </div>
      )}
      <div className={cardClassName} style={inPanel ? { ...card, background: 'var(--paper)', border: 'none', borderRadius: 14 } : card}>
        {rows.map((row, i) => (
          <div key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>{row}</div>
        ))}
      </div>
      {note && <p style={noteStyle}>{note}</p>}
    </section>
  );
}

export const groupTitle: React.CSSProperties = {
  margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-faint)',
};
export const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius-card)', overflow: 'hidden',
};
export const noteStyle: React.CSSProperties = {
  margin: '8px 6px 0', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', lineHeight: 1.45,
};

/**
 * One row: tinted 30px icon square, 16px label, value in --text-faint and a
 * chevron. A link when it opens a screen, a button when it opens a sheet.
 */
export function SettingsRow({ icon, tint = 'var(--text-muted)', label, value, to, onClick, danger, sub, chevron = true }: {
  icon?: ReactNode;
  tint?: string;
  label: string;
  value?: string;
  sub?: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  const { pathname } = useLocation();
  const inner = (
    <>
      {icon && (
        <span aria-hidden style={{
          width: 30, height: 30, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center',
          background: 'var(--surface-sunken)', color: tint,
        }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, padding: sub ? '8px 0' : 0 }}>
        <span style={{ display: 'block', fontSize: 16, color: danger ? 'var(--danger-text)' : 'var(--text)' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{sub}</span>}
      </span>
      {value && (
        <span style={{ fontSize: 14, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{value}</span>
      )}
      {chevron && <RowChevron />}
    </>
  );
  // On desktop the list stays beside the open sub-screen (§9g 2c): the row
  // of the screen being shown is marked.
  const active = !!to && (pathname === to || pathname.startsWith(`${to}/`));
  if (to) {
    return (
      <Link
        to={to}
        className="row-hover"
        aria-current={active ? 'page' : undefined}
        style={{ ...rowStyle, background: active ? 'var(--surface-sunken)' : 'none' }}
      >
        {inner}
      </Link>
    );
  }
  return <button type="button" className="row-hover" onClick={onClick} style={rowStyle}>{inner}</button>;
}

/** The row's "›" (prototype: an 18px glyph in --text-dim). */
export function RowChevron() {
  return <span aria-hidden style={{ flex: 'none', color: 'var(--text-dim)', fontSize: 18, lineHeight: 1 }}>›</span>;
}

export const rowStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', minHeight: 52,
  border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
  textDecoration: 'none', font: 'inherit',
};

/**
 * [− 10 +]. The middle is a real number input (typing works, and so do the
 * e2e that fill it), clamped on blur. The buttons move by `step`.
 */
export function Stepper({ value, onChange, label, min, max, step = 1, format, onValueClick, width = 32 }: {
  value: number;
  onChange: (v: number) => void;
  /** Accessible name of the input; the buttons are "{label}: menos / más". */
  label: string;
  min: number;
  max: number;
  step?: number;
  /** When set, the middle is read-only text ("500K") instead of an input. */
  format?: (v: number) => string;
  /** With `format`: the middle becomes a button (e.g. open the full sheet). */
  onValueClick?: () => void;
  width?: number;
}) {
  const t = useT();
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  function commit() {
    const n = Number(text);
    const next = Number.isFinite(n) && text.trim() !== '' ? clamp(Math.round(n)) : value;
    setText(String(next));
    if (next !== value) onChange(next);
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--paper)', borderRadius: 12, padding: 3, flex: 'none' }}>
      <button
        type="button"
        aria-label={fill(t('set.stepLess'), { label })}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        style={stepButton(value <= min)}
      >
        −
      </button>
      {format && onValueClick ? (
        <button type="button" className="figures" aria-label={label} onClick={onValueClick} style={{
          minWidth: width, textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-sm)', border: 'none',
          background: 'none', color: 'var(--text)', cursor: 'pointer', padding: '0 2px', minHeight: 30,
        }}>
          {format(value)}
        </button>
      ) : format ? (
        <span className="figures" aria-label={label} style={{ minWidth: width, textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
          {format(value)}
        </span>
      ) : (
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          min={min}
          max={max}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // A value already in range applies as it's typed, so what depends
            // on it (a preview, a sheet's height) doesn't jump on blur. Out
            // of range waits for blur, which clamps it.
            const n = Number(e.target.value);
            if (e.target.value.trim() !== '' && Number.isInteger(n) && n >= min && n <= max && n !== value) onChange(n);
          }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="figures stepper-input"
          style={{
            width, minWidth: width, border: 'none', background: 'none', textAlign: 'center',
            color: 'var(--text)', fontWeight: 700, fontSize: 16, padding: 0,
          }}
        />
      )}
      <button
        type="button"
        aria-label={fill(t('set.stepMore'), { label })}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        style={stepButton(value >= max)}
      >
        +
      </button>
    </span>
  );
}

function stepButton(disabled: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, border: 'none', borderRadius: 9, background: 'var(--surface-sunken)',
    color: 'var(--text)', fontSize: 18, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
  };
}

/** iOS switch, 51×31. A button with role="switch" so it reads as one. */
export function Switch({ on, onChange, label, disabled }: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        position: 'relative', width: 51, height: 31, borderRadius: 16, border: 'none', padding: 0, flex: 'none',
        background: on ? 'var(--positive)' : 'var(--line-strong)', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'background var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: 2, width: 27, height: 27, borderRadius: 14,
        background: 'var(--knob)', boxShadow: '0 2px 4px rgb(0 0 0 / .25)',
        transform: on ? 'translateX(20px)' : 'none', transition: 'transform .25s var(--ease-spring-out)',
      }} />
    </button>
  );
}

/** A labelled line inside a group: text on the left, a control on the right. */
export function ControlRow({ label, children, dot }: { label: string; children: ReactNode; dot?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 54 }}>
      {dot && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: dot, flex: 'none' }} />}
      <span style={{ flex: 1, fontSize: 16 }}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Bottom sheet: dim backdrop, 28px top radius, as tall as its content
 * (max: screen − 54px) with its own scroll. Traps the keyboard (useDialogo).
 */
export function BottomSheet({ label, onClose, children, zIndex = 60 }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
}) {
  const ref = useDialogo(onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 45%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '28px 28px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 24px)',
          maxHeight: 'calc(100dvh - 54px)', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div aria-hidden style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--line-strong)', margin: '0 auto 12px' }} />
        {children}
      </div>
    </div>
  );
}

/** Cancelar · title · Guardar pill (grey until the form is valid). */
export function SheetTopBar({ title, onCancel, onSave, canSave }: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
}) {
  const t = useT();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <button type="button" onClick={onCancel} style={{ border: 'none', background: 'none', color: 'var(--q10-text)', fontSize: 'var(--text-md)', cursor: 'pointer', padding: 0, minHeight: 'var(--tap)' }}>
        {t('action.cancel')}
      </button>
      <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', textAlign: 'center' }}>{title}</span>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        style={{
          border: 'none', height: 34, padding: '0 16px', borderRadius: 17, fontWeight: 700,
          fontSize: 'var(--text-base)', cursor: canSave ? 'pointer' : 'not-allowed',
          background: canSave ? 'var(--q10)' : 'var(--surface-sunken)',
          color: canSave ? 'var(--on-accent)' : 'var(--text-faint)',
        }}
      >
        {t('action.save')}
      </button>
    </div>
  );
}

/** Full-width dashed "+ Nueva …" button under a list. */
export function DashedButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginTop: 12, width: '100%', height: 48, borderRadius: 16, border: '1px dashed var(--line-strong)',
        background: 'transparent', fontWeight: 600, fontSize: 15, cursor: 'pointer', color: 'var(--q10-text)',
      }}
    >
      {children}
    </button>
  );
}

/** The back link every Settings sub-screen carries. */
export function useSettingsBack() {
  const t = useT();
  return { label: t('nav.settings'), to: '/ajustes' };
}
