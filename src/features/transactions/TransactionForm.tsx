import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { useT } from '@/i18n/language';
import { IconCalendar, IconX } from '@tabler/icons-react';
import { MiniCalendar, relativeDayLabel } from '@/components/ui/MiniCalendar';
import { dateLabel, fill } from '@/lib/dateLabels';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import { expandInstallments } from '@/domain/credit-card/installments';
import { formatMoney, parseMoney } from '@/domain/money/format';
import type { Category, PaymentMethod, Transaction, TransactionType } from '@/domain/types';
import { nowISO, todayISO } from '@/lib/todayISO';
import { formatShortDate } from '@/lib/formatShortDate';
import { db } from '@/data/db';
import { inferFromConcept, topRecents, normalize, type ConceptIndexEntry } from '@/domain/inference/conceptInference';
import { categoryColor } from '@/domain/seed/categoryColor';
import { haptic } from '@/lib/haptic';
import { Field, FieldGroup } from '@/components/ui/Field';
import { EMPTY } from '@/lib/empty';

function shortDate(iso: string): string {
  const { day, month } = formatShortDate(iso);
  return `${day} ${month}`;
}

/**
 * With the year, but only when needed. A 12-installment plan always
 * crosses into a new year, and without the year "first on Nov 2, last on
 * Oct 2" reads backwards — it looks like the last one falls before the
 * first.
 */
function shortDateConAno(iso: string, reference: string): string {
  const base = shortDate(iso);
  return iso.slice(0, 4) === reference.slice(0, 4) ? base : `${base} ${iso.slice(0, 4)}`;
}

export interface TransactionFormValue {
  type: TransactionType;
  concept: string;
  amountText: string;
  date: string;
  categoryId: string | null;
  paymentMethodId: string | null;
  markPaidNow: boolean;
}

/** Values the form can be opened with. Sent by the TabBar or a URL
 *  (`?nuevo=1&tipo=ingreso&monto=...`), which is how the iOS Shortcut gets in. */
export interface Prefill {
  type: TransactionType;
  concept?: string;
  amountText?: string;
  date?: string;
  markPaidNow?: boolean;
  categoryId?: string | null;
  paymentMethodId?: string | null;
}

function initialValue(
  existing: Transaction | null,
  prefill: Prefill | undefined,
  defaultPaymentMethodId: string | null,
): TransactionFormValue {
  if (existing) {
    return {
      type: existing.type,
      concept: existing.concept,
      amountText: String(existing.amount),
      date: existing.date,
      categoryId: existing.categoryId,
      paymentMethodId: existing.paymentMethodId,
      markPaidNow: existing.status === 'paid',
    };
  }
  const date = prefill?.date ?? todayISO();
  return {
    type: prefill?.type ?? 'expense',
    concept: prefill?.concept ?? '',
    amountText: prefill?.amountText ?? '',
    date,
    categoryId: prefill?.categoryId ?? null,
    paymentMethodId: prefill?.paymentMethodId ?? defaultPaymentMethodId,
    // A transaction dated today or earlier already happened: mark it done.
    // Everything used to come in as 'pending', which inflated "left to pay"
    // and left income out of what's received.
    markPaidNow: prefill?.markPaidNow ?? date <= todayISO(),
  };
}

/**
 * Redesigned form (Phase 3):
 *   - The large amount IS the input (a single field, not display + box).
 *   - Recent-concept chips (top 5): tap → autofill EVERYTHING.
 *   - As you type the concept, autonomous inference of category + method
 *     from history (200ms debounce).
 *   - Type and initial values come from `prefill` (or the existing one).
 */
export function TransactionForm({
  existing, prefill, categories, paymentMethods, defaultPaymentMethodId,
  onSave, onDelete, onDuplicate, onCancel,
}: {
  existing: Transaction | null;
  prefill?: Prefill;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string | null;
  onSave: (tx: Transaction, installmentPlan?: { installments: number; installmentAmount?: number }) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState<TransactionFormValue>(() =>
    initialValue(existing, prefill, defaultPaymentMethodId),
  );
  const [touched, setTouched] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [inferredKey, setInferredKey] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []) ?? EMPTY;
  const recents = useMemo(() => topRecents(conceptIndex, 5), [conceptIndex]);

  const amount = parseMoney(value.amountText);
  const selectedMethod = paymentMethods.find((m) => m.id === value.paymentMethodId);
  const isCredit = selectedMethod?.type === 'credit';
  const isIncome = value.type === 'income';

  // Available methods: for income, don't show credit cards (charging income to a card makes no sense).
  const availableMethods = useMemo(
    () => paymentMethods.filter((m) => !isIncome || m.type !== 'credit'),
    [paymentMethods, isIncome],
  );

  /**
   * A card purchase is NOT paid the day you make it: you owe it until you
   * pay the statement. The markPaidNow default ("dated today or earlier,
   * already happened") holds for cash and debit, but with a card it made
   * every purchase born 'paid' — so the available limit never moved and
   * porPagar.ts's "on card" group stayed forever empty.
   *
   * Only applies on create: if you're editing something you already
   * marked paid, your call wins.
   */
  // Installment plan. 1 = no plan, which is the normal case.
  const [installments, setCuotas] = useState(existing?.installmentCount ?? 1);
  const [installmentAmountText, setValorCuotaTexto] = useState('');

  const previousCredit = useRef<boolean | null>(null);
  useEffect(() => {
    if (!existing && isCredit && previousCredit.current !== true) {
      setValue((v) => ({ ...v, markPaidNow: false }));
    }
    if (!isCredit) setCuotas(1);
    previousCredit.current = isCredit;
  }, [isCredit, existing]);

  const paymentPreview = useMemo(() => {
    if (!isCredit || !value.date) return null;
    const cycle = calculateCreditCardCycle(value.date, selectedMethod?.cutoffDay, selectedMethod?.paymentDay);
    return cycle.paymentDate;
  }, [isCredit, value.date, selectedMethod]);

  /** How it would end up split, to show before saving. */
  const installmentPreview = useMemo(() => {
    if (!isCredit || installments <= 1 || !value.date || amount === null || amount <= 0) return null;
    return expandInstallments(
      value.date, amount, installments, selectedMethod?.cutoffDay, selectedMethod?.paymentDay,
      parseMoney(installmentAmountText) ?? undefined,
    );
  }, [isCredit, installments, value.date, amount, selectedMethod, installmentAmountText]);

  // Smart-fill: as you type the concept, infer category + method (200ms debounce).
  // Only if the user hasn't manually edited the chips (i.e. it's still on a previous match).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const key = normalize(value.concept);
      if (!key || key === inferredKey) return;
      const result = inferFromConcept(
        value.concept,
        conceptIndex,
        {
          categoryId: value.categoryId,
          paymentMethodId: value.paymentMethodId,
        },
      );
      if (result.confidence !== 'fallback' && result.source) {
        // Only autofill if the current slots are empty or from the previous match.
        setValue((v) => ({
          ...v,
          categoryId: v.categoryId ?? result.categoryId,
          paymentMethodId: v.paymentMethodId ?? result.paymentMethodId,
        }));
        setInferredKey(key);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value.concept, conceptIndex]);

  function applyRecent(entry: ConceptIndexEntry) {
    haptic('light');
    setValue((v) => ({
      ...v,
      concept: entry.displayName,
      categoryId: entry.categoryId,
      paymentMethodId: entry.paymentMethodId,
    }));
    setInferredKey(entry.id);
  }

  const canSave = value.concept.trim().length > 0 && amount !== null && amount > 0 && !!value.date;

  function handleSubmit() {
    setTouched(true);
    if (!canSave || amount === null) return;

    const now = nowISO();
    const cycle = isCredit ? calculateCreditCardCycle(value.date, selectedMethod?.cutoffDay, selectedMethod?.paymentDay) : null;

    const tx: Transaction = {
      id: existing?.id ?? crypto.randomUUID(),
      type: value.type,
      concept: value.concept.trim(),
      amount,
      date: value.date,
      categoryId: value.categoryId,
      paymentMethodId: value.paymentMethodId,
      status: value.markPaidNow ? 'paid' : (existing?.status === 'scheduled' ? 'scheduled' : 'pending'),
      notes: existing?.notes,
      quincenaKey: existing?.quincenaKey ?? null,
      cycleCutoffDate: cycle?.cycleCutoff,
      cyclePaymentDate: cycle?.paymentDate,
      recurringRuleId: existing?.recurringRuleId,
      periodKey: existing?.periodKey,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    haptic('medium');
    // Editing a single installment does NOT re-split the plan: that's
    // what you do when you pay one. An installment plan is only built on create.
    const isNewInstallmentPlan = !existing && isCredit && installments > 1;
    onSave(tx, isNewInstallmentPlan ? { installments, installmentAmount: parseMoney(installmentAmountText) ?? undefined } : undefined);
  }

  const headerLabel = existing
    ? isIncome ? 'Editar ingreso' : 'Editar gasto'
    : isIncome ? 'Nuevo ingreso' : 'Nuevo gasto';

  const dialogRef = useDialogo(onCancel);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={existing ? 'Editar movimiento' : 'Agregar movimiento'}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex: 50,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          maxHeight: '92vh', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 8px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('action.cancel')}
            style={{
              width: 32, height: 32, borderRadius: 16, border: 'none',
              background: 'var(--surface-sunken)', color: 'var(--text-muted)',
              fontSize: 18, cursor: 'pointer',
            }}
          >
            <IconX size={17} stroke={2.2} aria-hidden />
          </button>
          <span
            style={{
              fontSize: 'var(--text-sm)', fontWeight: 700,
              padding: '4px 10px', borderRadius: 12,
              background: isIncome ? 'var(--positive-soft)' : 'var(--surface-sunken)',
              color: isIncome ? 'var(--positive-text)' : 'var(--text-muted)',
              letterSpacing: '0.02em', textTransform: 'uppercase',
            }}
          >
            {headerLabel}
          </span>
        </div>

        {/* The big number IS the field. There used to be a decorative
            display up top and a small input below: two things showing the same thing. */}
        <input
          value={value.amountText ? formatMoney(Number(value.amountText)) : ''}
          onChange={(e) => setValue((v) => ({ ...v, amountText: e.target.value.replace(/[^0-9]/g, '').slice(0, 12) }))}
          placeholder="$ 0"
          inputMode="numeric"
          enterKeyHint="next"
          autoFocus={!existing}
          aria-label="Valor"
          className="figures"
          style={{
            width: '100%', border: 'none', background: 'none', outline: 'none',
            textAlign: 'center', margin: '12px 0 4px', padding: 0,
            fontSize: 'var(--text-3xl)', fontWeight: 700, letterSpacing: '-0.022em', lineHeight: 1.1,
            color: isIncome ? 'var(--positive-text)' : (amount && amount > 0 ? 'var(--text)' : 'var(--text-faint)'),
          }}
        />
        <p style={{ margin: '0 0 14px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
          {isIncome ? t('form.howMuchIn') : t('form.howMuchOut')}
        </p>
        {touched && (amount === null || amount <= 0) && <p style={errorText}>{t('transactions.enterValidAmount')}</p>}

        {/* Recent-concept chips — only when NOT editing and there's history */}
        {!existing && recents.length > 0 && (
          <>
            <FieldGroup label="Usar reciente" id="tx-recientes" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
              {recents.map((r) => {
                const cat = r.categoryId ? categories.find((c) => c.id === r.categoryId) : null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => applyRecent(r)}
                    style={{
                      flex: 'none', display: 'flex', alignItems: 'center', gap: 6,
                      minHeight: 'var(--tap)', padding: '0 14px', borderRadius: 999,
                      border: '1px solid var(--line-strong)',
                      background: 'var(--surface)', color: 'var(--text)',
                      fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {cat && <CategoryIcon icon={cat.icon} size={15} />}
                    <span>{r.displayName}</span>
                  </button>
                );
              })}
            </FieldGroup>
          </>
        )}

        <Field label={t('form.concept')} htmlFor="tx-concepto">
        <input
          id="tx-concepto"
          value={value.concept}
          onChange={(e) => setValue((v) => ({ ...v, concept: e.target.value }))}
          placeholder="Ej. Restaurante"
          style={inputStyle}
        />
        </Field>
        {touched && !value.concept.trim() && <p style={errorText}>{t('transactions.writeWhatItIs')}</p>}

        <FieldGroup label={t('form.category')} id="tx-categoria" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
          {categories.filter((c) => c.kind === 'both' || c.kind === value.type).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setValue((v) => ({ ...v, categoryId: c.id }))}
              aria-pressed={value.categoryId === c.id}
              style={{
                flex: 'none', display: 'flex', alignItems: 'center', gap: 6,
                minHeight: 'var(--tap)', padding: '0 12px', borderRadius: 999,
                border: `1.5px solid ${value.categoryId === c.id ? categoryColor(c) : 'var(--line)'}`,
                background: value.categoryId === c.id ? `color-mix(in srgb, ${categoryColor(c)} 16%, var(--surface))` : 'var(--surface)',
                color: value.categoryId === c.id ? categoryColor(c) : 'var(--text)',
                fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all var(--dur-fast) var(--ease-spring-out)',
              }}
            >
              <CategoryIcon icon={c.icon} size={15} />{c.name}
            </button>
          ))}
        </FieldGroup>

        <FieldGroup label={t('form.paymentMethod')} id="tx-metodo" style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {availableMethods.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setValue((v) => ({ ...v, paymentMethodId: m.id }))}
              aria-pressed={value.paymentMethodId === m.id}
              style={segmentStyle(value.paymentMethodId === m.id)}
            >
              {m.name}
            </button>
          ))}
        </FieldGroup>
        {isCredit && paymentPreview && installments === 1 && (
          <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--q25-text)', fontWeight: 600 }}>
            {t('transactions.paidOnLong')} {shortDate(paymentPreview)}
          </p>
        )}

        {/* Installment plan. Only on CREATE: editing a single installment
            does not re-split the purchase. */}
        {isCredit && !existing && (
          <>
            <Field label={t('form.installments')} htmlFor="tx-cuotas">
              <input
                id="tx-cuotas" type="number" inputMode="numeric" min={1} max={48}
                value={installments}
                onChange={(e) => setCuotas(Math.max(1, Math.min(48, Number(e.target.value) || 1)))}
                style={inputStyle}
              />
            </Field>

            {installments > 1 && (
              <>
                <Field label={t('form.installmentAmount')} htmlFor="tx-valor-cuota">
                  <input
                    id="tx-valor-cuota" inputMode="numeric"
                    value={installmentAmountText}
                    onChange={(e) => setValorCuotaTexto(e.target.value)}
                    placeholder={installmentPreview ? formatMoney(installmentPreview[0]!.amount) : '$ 0'}
                    style={inputStyle}
                  />
                </Field>
                <p style={{ margin: '-8px 0 14px', fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
                  {installmentPreview
                    ? t('transactions.installmentRange')
                        .replace('{first}', shortDate(installmentPreview[0]!.cyclePaymentDate))
                        .replace('{last}', shortDateConAno(installmentPreview[installmentPreview.length - 1]!.cyclePaymentDate, installmentPreview[0]!.cyclePaymentDate))
                    : t('transactions.installmentInterestHint')}
                </p>
              </>
            )}
          </>
        )}

        {/* The date as a chip ("Hoy", "Ayer", "3 oct") that opens a month
            grid right in the sheet. A past date means it already happened
            (paid/received); a future one stays pending. The pay period is
            still resolved from the date by calculatePeriod, as before. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 600 }}>{t('form.date')}</span>
          <button
            type="button"
            onClick={() => setDateOpen((o) => !o)}
            aria-expanded={dateOpen}
            aria-label={fill(t('form.chooseDate'), { date: dateLabel(value.date, t, 'long') })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 14px',
              borderRadius: 999, cursor: 'pointer', fontSize: 'var(--text-base)', fontWeight: 600,
              border: `1px solid ${dateOpen ? 'var(--q10)' : 'var(--line-strong)'}`,
              background: 'var(--surface)', color: 'var(--text)',
            }}
          >
            <IconCalendar size={16} stroke={1.8} aria-hidden />
            {relativeDayLabel(value.date, todayISO(), t)}
          </button>
        </div>
        {dateOpen && (
          <MiniCalendar
            value={value.date}
            today={todayISO()}
            onChange={(iso) => setValue((v) => ({ ...v, date: iso, markPaidNow: iso <= todayISO() }))}
          />
        )}
        {value.date > todayISO() && !value.markPaidNow && (
          <p style={{ margin: '0 0 10px', fontSize: 'var(--text-sm)', color: 'var(--q25-text)', fontWeight: 600 }}>
            {t('form.datePendingNote')}
          </p>
        )}

        <button
          type="button"
          onClick={() => setValue((v) => ({ ...v, markPaidNow: !v.markPaidNow }))}
          aria-pressed={value.markPaidNow}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            minHeight: 'var(--tap)', padding: '0 4px', margin: '10px 0 20px', background: 'none',
            border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--text-base)',
          }}
        >
          <span>{isIncome ? t('form.alreadyReceived') : isCredit ? t('form.statementAlreadyPaid') : t('form.alreadyPaid')}</span>
          <span
            aria-hidden
            style={{
              width: 44, height: 26, borderRadius: 13, background: value.markPaidNow ? 'var(--positive)' : 'var(--surface-sunken)',
              border: '1px solid var(--line)', position: 'relative', transition: 'background var(--dur-fast)',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: value.markPaidNow ? 21 : 2, width: 20, height: 20,
              borderRadius: 10, background: 'var(--knob)', boxShadow: '0 1px 3px rgb(0 0 0/.3)', transition: 'left var(--dur-fast) var(--ease-spring-out)',
            }} />
          </span>
        </button>

        <button type="button" onClick={handleSubmit} disabled={!canSave} style={saveButtonStyle(canSave)}>
          {t('action.save')}
        </button>

        {existing && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {onDuplicate && (
              <button type="button" onClick={onDuplicate} style={secondaryButtonStyle}>{t('action.duplicate')}</button>
            )}
            {onDelete && (
              <button type="button" onClick={onDelete} style={{ ...secondaryButtonStyle, color: 'var(--danger-text)' }}>
                {t('action.delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 'var(--tap)', padding: '0 12px', marginBottom: 14,
  borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
};
const errorText: React.CSSProperties = { margin: '-10px 0 10px', fontSize: 'var(--text-xs)', color: 'var(--danger-text)' };

function segmentStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, minWidth: 90, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)',
    border: '1px solid var(--line-strong)', background: active ? 'var(--text)' : 'var(--surface)',
    color: active ? 'var(--surface)' : 'var(--text)', fontWeight: 600, cursor: 'pointer',
    fontSize: 'var(--text-base)',
    transition: 'all var(--dur-fast) var(--ease-spring-out)',
  };
}
function saveButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none',
    background: enabled ? 'var(--q10)' : 'var(--surface-sunken)',
    color: enabled ? 'var(--on-accent)' : 'var(--text-faint)',
    fontWeight: 700, fontSize: 16, cursor: enabled ? 'pointer' : 'not-allowed',
    transition: 'background var(--dur-fast) var(--ease-spring-out)',
  };
}
const secondaryButtonStyle: React.CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
  fontSize: 'var(--text-base)',
};
