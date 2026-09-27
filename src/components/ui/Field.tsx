import type { ReactNode } from 'react';

/**
 * The app's two form labels, so the decision doesn't repeat on every
 * screen.
 *
 * They exist because there were 17 loose `<label>`s and none of them was
 * associated with anything: a screen reader would enter the field and
 * announce "text field", without saying which one. And half of those
 * `<label>`s weren't even labeling a field — they were labeling a group of
 * buttons (Category, Payment method, Frequency), where `<label>` is simply
 * the wrong element: it's not missing an attribute, it's missing being
 * something else.
 */

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-muted)', margin: '0 0 6px',
  textTransform: 'uppercase', letterSpacing: '0.03em',
};

/** Label for ONE control. `htmlFor` must match the input's id. */
export function Field({ label, htmlFor, children }: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <>
      <label htmlFor={htmlFor} style={labelStyle}>{label}</label>
      {children}
    </>
  );
}

/**
 * Label for a GROUP of controls (chips, segments). Uses role="group" +
 * aria-labelledby, which is what a screen reader needs to say
 * "Category, group" before reading the options.
 */
export function FieldGroup({ label, id, children, style }: {
  label: string;
  id: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <>
      <span id={`${id}-rotulo`} style={labelStyle}>{label}</span>
      <div role="group" aria-labelledby={`${id}-rotulo`} style={style}>
        {children}
      </div>
    </>
  );
}
