import { useMemo } from 'react';
import type { PaymentMethod, PaymentMethodType } from '@/domain/types';
import { useT } from '@/i18n/language';
import { Segmented } from './Segmented';

const TYPE_ORDER: PaymentMethodType[] = ['debit', 'credit', 'cash', 'transfer'];
const TYPE_KEY = {
  debit: 'methods.debit', credit: 'methods.credit', cash: 'methods.cash', transfer: 'methods.transfer',
} as const;

/**
 * Payment method as Débito | Crédito | Efectivo (redesign §9b): one segment
 * per TYPE the user has. When a type has several methods —two cards, say—
 * its own names show underneath to pick one.
 */
export function MethodPicker({ methods, value, onChange, inset = false }: {
  methods: PaymentMethod[];
  value: string | null;
  onChange: (id: string) => void;
  /** In the phone sheet: the sheet's inset segmented, no bottom margin (it shares a row with the date). */
  inset?: boolean;
}) {
  const t = useT();
  const selected = methods.find((m) => m.id === value);
  const types = useMemo(() => TYPE_ORDER.filter((ty) => methods.some((m) => m.type === ty)), [methods]);
  const ofType = (ty: PaymentMethodType) => methods.filter((m) => m.type === ty);

  if (types.length === 0) return null;

  // Picking a type keeps the method already chosen within it; otherwise the
  // first one of that type (the user's default when it's of that type).
  const pickType = (ty: PaymentMethodType) => {
    if (selected?.type === ty) return;
    const list = ofType(ty);
    const byDefault = list.find((m) => m.isDefault) ?? list[0];
    if (byDefault) onChange(byDefault.id);
  };

  const siblings = selected ? ofType(selected.type) : [];

  return (
    <div style={{ marginBottom: inset ? 0 : 10 }}>
      <Segmented
        inset={inset}
        label={t('form.paymentMethod')}
        value={(selected?.type ?? '') as PaymentMethodType}
        onChange={pickType}
        options={types.map((ty) => ({ value: ty, label: t(TYPE_KEY[ty]) }))}
      />
      {siblings.length > 1 && (
        <div role="group" aria-label={t(TYPE_KEY[selected!.type])} style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {siblings.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === value}
              onClick={() => onChange(m.id)}
              style={{
                minHeight: 34, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${m.id === value ? 'var(--q10)' : 'var(--line-strong)'}`,
                background: m.id === value ? 'var(--q10-soft)' : 'transparent',
                color: m.id === value ? 'var(--q10-text)' : 'var(--text)',
                fontSize: 'var(--text-sm)', fontWeight: 600,
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
