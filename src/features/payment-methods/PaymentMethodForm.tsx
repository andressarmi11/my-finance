import { useT } from '@/i18n/language';
import { useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { Field, FieldGroup } from '@/components/ui/Field';
import { parseMoney } from '@/domain/money/format';
import type { PaymentMethod, PaymentMethodType } from '@/domain/types';

const TYPES: Array<{ id: PaymentMethodType; label: string }> = [
  { id: 'debit', label: 'Débito' },
  { id: 'credit', label: 'Crédito' },
  { id: 'cash', label: 'Efectivo' },
  { id: 'transfer', label: 'Transfer.' },
];

/**
 * Create and edit a payment method. The cutoff, payment day, and limit only
 * show up if the type is credit: they're the three fields that make a
 * card ITS OWN and not a copy of the first one.
 *
 * There's no "default" checkbox on purpose. That data lives in
 * Settings.defaultPaymentMethodId, not here — PaymentMethod.isDefault is left
 * as a legacy field (see domain/types.ts). A checkbox that wrote
 * isDefault would seem to do nothing, because Settings wins the ??.
 */
export function PaymentMethodForm({
  existing, onSave, onCancel, onDelete, relatedTransactions }: {
  existing: PaymentMethod | null;
  onSave: (method: PaymentMethod) => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** How many transactions would be left without a method if this is deleted. */
  relatedTransactions: number;
}) {
  const t = useT();
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<PaymentMethodType>(existing?.type ?? 'credit');
  const [cutoffDay, setCutoffDay] = useState(String(existing?.cutoffDay ?? 15));
  const [paymentDay, setPaymentDay] = useState(String(existing?.paymentDay ?? 2));
  const [cupo, setCupo] = useState(existing?.creditLimit ? String(existing.creditLimit) : '');
  const [touched, setTouched] = useState(false);

  const isCredit = type === 'credit';
  const cutoff = Number(cutoffDay);
  const payment = Number(paymentDay);
  const validDays = !isCredit || (isDayOfMonth(cutoff) && isDayOfMonth(payment));
  const canSave = name.trim().length > 0 && validDays;

  function handleSubmit() {
    setTouched(true);
    if (!canSave) return;
    const limit = parseMoney(cupo);
    onSave({
      // crypto.randomUUID and never a fixed slug: the PK in Postgres is
      // (user_id, id), and a repeated id across devices collides.
      id: existing?.id ?? crypto.randomUUID(),
      type,
      name: name.trim(),
      isDefault: existing?.isDefault ?? false,
      ...(isCredit
        ? { cutoffDay: cutoff, paymentDay: payment, ...(limit && limit > 0 ? { creditLimit: limit } : {}) }
        : {}),
      // The real date gets stamped by localRepository; here the type is enough.
      updatedAt: existing?.updatedAt ?? '',
    });
  }

  const dialogRef = useDialogo(onCancel);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={existing ? t('methods.editOne') : t('methods.newOne')}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />

        <Field label={t('form.name')} htmlFor="pm-nombre">
          <input id="pm-nombre" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Visa Bancolombia" style={inputStyle} />
        </Field>
        {touched && !name.trim() && <p style={errorStyle}>{t('methods.nameHint')}</p>}

        <FieldGroup label="Tipo" id="pm-tipo" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {TYPES.map((t) => (
            <button key={t.id} type="button" onClick={() => setType(t.id)} aria-pressed={type === t.id} style={segmentStyle(type === t.id)}>
              {t.label}
            </button>
          ))}
        </FieldGroup>

        {isCredit && (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <Field label={t('methods.cutoffDay')} htmlFor="pm-corte">
                <input id="pm-corte" type="number" inputMode="numeric" min={1} max={31} value={cutoffDay}
                  onChange={(e) => setCutoffDay(e.target.value)} style={inputStyle} />
              </Field>
              <Field label={t('methods.paymentDay')} htmlFor="pm-pago">
                <input id="pm-pago" type="number" inputMode="numeric" min={1} max={31} value={paymentDay}
                  onChange={(e) => setPaymentDay(e.target.value)} style={inputStyle} />
              </Field>
            </div>
            {touched && !validDays && <p style={errorStyle}>{t('methods.dayRangeHint')}</p>}

            <Field label="Cupo (opcional)" htmlFor="pm-cupo">
              <input id="pm-cupo" inputMode="numeric" value={cupo} onChange={(e) => setCupo(e.target.value)}
                placeholder="$ 0" style={inputStyle} />
            </Field>
            <p style={hintStyle}>
              {t('methods.limitHint')}
            </p>
          </>
        )}

        <button type="button" onClick={handleSubmit} disabled={!canSave} style={saveButtonStyle(canSave)}>{t('action.save')}</button>

        {existing && onDelete && (
          <>
            <button type="button" onClick={onDelete} style={deleteButtonStyle}>{t('action.delete')}</button>
            {relatedTransactions > 0 && (
              <p style={hintStyle}>
                {t('transactions.willBeLeftWithout')
                  .replace('{n}', String(relatedTransactions))
                  .replace('{noun}', relatedTransactions === 1
                    ? t('transactions.willBeLeftOne')
                    : t('transactions.willBeLeftMany'))}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function isDayOfMonth(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

const inputStyle: React.CSSProperties = { width: '100%', minHeight: 'var(--tap)', padding: '0 12px', marginBottom: 14, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16 };
const errorStyle: React.CSSProperties = { margin: '-10px 0 10px', fontSize: 12, color: 'var(--danger-text)' };
const hintStyle: React.CSSProperties = { margin: '-6px 0 14px', fontSize: 12, color: 'var(--text-faint)' };
const deleteButtonStyle: React.CSSProperties = { width: '100%', minHeight: 44, marginTop: 10, marginBottom: 8, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--danger-text)', fontWeight: 600, cursor: 'pointer' };
function segmentStyle(active: boolean): React.CSSProperties {
  return { flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: active ? 'var(--text)' : 'var(--surface)', color: active ? 'var(--surface)' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 14 };
}
function saveButtonStyle(enabled: boolean): React.CSSProperties {
  return { width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none', background: enabled ? 'var(--text)' : 'var(--surface-sunken)', color: enabled ? 'var(--surface)' : 'var(--text-faint)', fontWeight: 700, fontSize: 16, cursor: enabled ? 'pointer' : 'not-allowed' };
}
