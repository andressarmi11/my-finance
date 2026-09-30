import { useT } from '@/i18n/language';
import { useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { parseMoney } from '@/domain/money/format';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import { daysInMonth } from '@/domain/dates';
import type { PaymentMethod, PaymentMethodType } from '@/domain/types';
import type { TextKey } from '@/i18n/texts';
import { dateLabel, fill } from '@/lib/dateLabels';
import { todayISO } from '@/lib/todayISO';
import { BottomSheet, ControlRow, SheetTopBar, Stepper, Switch } from '@/features/settings/ui';

const TYPE_LABEL: Record<PaymentMethodType, TextKey> = {
  debit: 'methods.debit', credit: 'methods.credit', cash: 'methods.cash', transfer: 'methods.transfer',
};

/**
 * Create and edit a payment method (redesign §9f): Débito | Crédito |
 * Efectivo and a name. A card also asks for its cutoff and payment days
 * (steppers) and an optional limit, and explains in amber — computed with
 * domain/credit-card/cycle.ts, never by hand — when each purchase gets paid.
 *
 * "Usar por defecto" writes Settings.defaultPaymentMethodId through
 * onSave's second argument: PaymentMethod.isDefault is a legacy field, and
 * a switch that wrote it would seem to do nothing because Settings wins.
 */
export function PaymentMethodForm({
  existing, isDefault = false, onSave, onCancel, onDelete, relatedTransactions }: {
  existing: PaymentMethod | null;
  /** Whether this method is Settings' default today. */
  isDefault?: boolean;
  onSave: (method: PaymentMethod, useAsDefault: boolean) => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** How many transactions would be left without a method if this is deleted. */
  relatedTransactions: number;
}) {
  const t = useT();
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<PaymentMethodType>(existing?.type ?? 'credit');
  const [cutoff, setCutoff] = useState(existing?.cutoffDay ?? 15);
  const [payment, setPayment] = useState(existing?.paymentDay ?? 2);
  const [cupo, setCupo] = useState(existing?.creditLimit ? String(existing.creditLimit) : '');
  const [useAsDefault, setUseAsDefault] = useState(isDefault);
  const [touched, setTouched] = useState(false);

  const isCredit = type === 'credit';
  const canSave = name.trim().length > 0;
  const types: PaymentMethodType[] = existing?.type === 'transfer' ? ['debit', 'credit', 'cash', 'transfer'] : ['debit', 'credit', 'cash'];

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
    }, useAsDefault);
  }

  const title = existing ? t('methods.editOne') : t('methods.newOne');
  return (
    <BottomSheet label={title} onClose={onCancel} zIndex={50}>
      <SheetTopBar title={title} onCancel={onCancel} onSave={handleSubmit} canSave={canSave} />

      <div style={{ marginTop: 16 }}>
        <Segmented
          inset
          label={t('set.methodType')}
          value={type}
          onChange={setType}
          options={types.map((ty) => ({ value: ty, label: t(TYPE_LABEL[ty]) }))}
        />
      </div>

      <label htmlFor="pm-nombre" style={visuallyHidden}>{t('form.name')}</label>
      <input
        id="pm-nombre"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={isCredit ? t('set.cardNamePlaceholder') : t('set.methodNamePlaceholder')}
        style={fieldStyle}
      />
      {touched && !name.trim() && <p style={errorStyle}>{t('methods.nameHint')}</p>}

      {isCredit && (
        <>
          <div style={{ background: 'var(--paper)', borderRadius: 16, marginTop: 10 }}>
            <ControlRow label={t('methods.cutoffDay')}>
              <Stepper label={t('methods.cutoffDay')} value={cutoff} min={1} max={31} onChange={setCutoff} />
            </ControlRow>
            <div style={{ borderTop: '1px solid var(--line)' }}>
              <ControlRow label={t('methods.paymentDay')}>
                <Stepper label={t('methods.paymentDay')} value={payment} min={1} max={31} onChange={setPayment} />
              </ControlRow>
            </div>
          </div>
          <CycleExplanation cutoff={cutoff} payment={payment} />

          <label htmlFor="pm-cupo" style={{ display: 'block', margin: '14px 2px 6px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>
            {t('set.limitOptional')}
          </label>
          <input id="pm-cupo" inputMode="numeric" className="figures" value={cupo} onChange={(e) => setCupo(e.target.value)}
            placeholder="$ 0" style={{ ...fieldStyle, marginTop: 0 }} />
          <p style={hintStyle}>{t('methods.limitHint')}</p>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: '12px 14px', background: 'var(--paper)', borderRadius: 14 }}>
        <span style={{ flex: 1, fontSize: 15 }}>{t('set.useAsDefault')}</span>
        <Switch label={t('set.useAsDefault')} on={useAsDefault} onChange={setUseAsDefault} />
      </div>

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
    </BottomSheet>
  );
}

/**
 * "Compras del 1 al 15 de octubre se pagan el 2 de noviembre. Del 16 en
 * adelante, el 2 de diciembre." Real dates of this month, from cycle.ts.
 */
function CycleExplanation({ cutoff, payment }: { cutoff: number; payment: number }) {
  const t = useT();
  const [y, m] = todayISO().split('-').map(Number) as [number, number];
  const iso = (d: number) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const lastDay = daysInMonth(y, m);
  const cut = Math.min(cutoff, lastDay);
  const before = calculateCreditCardCycle(iso(cut), cutoff, payment);
  let text = fill(t('set.cycleBefore'), { cut, date: dateLabel(iso(cut), t, 'long'), pay: dateLabel(before.paymentDate, t, 'long') });
  if (cut < lastDay) {
    const after = calculateCreditCardCycle(iso(cut + 1), cutoff, payment);
    text += ' ' + fill(t('set.cycleAfter'), { from: cut + 1, pay: dateLabel(after.paymentDate, t, 'long') });
  }
  return (
    <p role="note" style={{
      margin: '10px 0 0', padding: '12px 14px', borderRadius: 14, fontSize: 'var(--text-sm)', lineHeight: 1.5,
      background: 'color-mix(in srgb, var(--q25) 10%, transparent)', color: 'var(--q25-text)',
    }}>
      {text}
    </p>
  );
}

const visuallyHidden: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
const fieldStyle: React.CSSProperties = {
  width: '100%', height: 52, marginTop: 14, padding: '0 14px', borderRadius: 14, border: 'none',
  background: 'var(--paper)', color: 'var(--text)', fontSize: 16, outline: 'none',
};
const errorStyle: React.CSSProperties = { margin: '6px 2px 0', fontSize: 12, color: 'var(--danger-text)' };
const hintStyle: React.CSSProperties = { margin: '6px 2px 0', fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45 };
const deleteButtonStyle: React.CSSProperties = { width: '100%', minHeight: 44, marginTop: 16, borderRadius: 14, border: 'none', background: 'var(--surface-sunken)', color: 'var(--danger-text)', fontWeight: 600, cursor: 'pointer' };
