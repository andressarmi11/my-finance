import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { useT } from '@/i18n/language';
import { IconCalendar } from '@tabler/icons-react';
import { MiniCalendar, relativeDayLabel } from '@/components/ui/MiniCalendar';
import { MoreOptions } from '@/components/ui/MoreOptions';
import { CurrencyChips } from '@/components/ui/CurrencyChips';
import { MethodPicker } from '@/components/ui/MethodPicker';
import { ReminderChips } from '@/components/ui/ReminderChips';
import { CURRENCIES, convert, formatRate, quickCurrencyList } from '@/lib/currencies';
import { useFxRate } from '@/lib/fxRates';
import { dateLabel, fill } from '@/lib/dateLabels';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import { expandInstallments } from '@/domain/credit-card/installments';
import { formatMoney, parseMoney } from '@/domain/money/format';
import type { Category, PaymentMethod, Transaction, TransactionType } from '@/domain/types';
import { nowISO, todayISO } from '@/lib/todayISO';
import { shortDay } from '@/lib/formatShortDate';
import { db } from '@/data/db';
import { inferFromConcept, topRecents, normalize, type ConceptIndexEntry } from '@/domain/inference/conceptInference';
import { categoryColor } from '@/domain/seed/categoryColor';
import { haptic } from '@/lib/haptic';
import { Field, FieldGroup } from '@/components/ui/Field';
import { EMPTY } from '@/lib/empty';
import { IconX } from '@tabler/icons-react';
import { useBreakpoint } from '@/app/useBreakpoint';
import { Segmented } from '@/components/ui/Segmented';

function shortDate(iso: string): string {
  return shortDay(iso);
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
  /** In `currency`: the original amount when it isn't the main currency. */
  amountText: string;
  date: string;
  categoryId: string | null;
  paymentMethodId: string | null;
  markPaidNow: boolean;
  currency: string;
  reminder: Transaction['reminder'];
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
  /** A currency the text named ("20 dólares"); the amount is in it. */
  currency?: string;
}

function initialValue(
  existing: Transaction | null,
  prefill: Prefill | undefined,
  defaultPaymentMethodId: string | null,
  mainCurrency: string,
): TransactionFormValue {
  if (existing) {
    const foreign = existing.currency && existing.currency !== mainCurrency && existing.originalAmount != null && existing.fxRate;
    return {
      type: existing.type,
      concept: existing.concept,
      amountText: String(foreign ? existing.originalAmount : existing.amount),
      date: existing.date,
      categoryId: existing.categoryId,
      paymentMethodId: existing.paymentMethodId,
      markPaidNow: existing.status === 'paid',
      currency: foreign ? existing.currency! : mainCurrency,
      reminder: existing.reminder ?? null,
    };
  }
  const date = prefill?.date ?? todayISO();
  const currency = prefill?.currency && CURRENCIES.some((c) => c.code === prefill.currency) ? prefill.currency : mainCurrency;
  return {
    currency,
    reminder: null,
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
  mainCurrency = 'COP', quickCurrencies,
  onSave, onDelete, onDuplicate, onCancel, onRecurring,
}: {
  existing: Transaction | null;
  prefill?: Prefill;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string | null;
  /** Settings.currency: `amount` is always stored in it. */
  mainCurrency?: string;
  quickCurrencies?: string[];
  onSave: (tx: Transaction, installmentPlan?: { installments: number; installmentAmount?: number }) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCancel: () => void;
  /** Desktop: "Recurrente" in the type switch hands over to the recurring form. */
  onRecurring?: () => void;
}) {
  const t = useT();
  // Desktop (§9g 2d): the same form, laid out as a centred 780px dialog with
  // the month always visible on the right. Same fields, same validation.
  const wide = useBreakpoint() === 'desktop';
  const [value, setValue] = useState<TransactionFormValue>(() =>
    initialValue(existing, prefill, defaultPaymentMethodId, mainCurrency),
  );
  const [touched, setTouched] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [inferredKey, setInferredKey] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []) ?? EMPTY;
  const recents = useMemo(() => topRecents(conceptIndex, 5), [conceptIndex]);

  // What was typed is in `value.currency`; what gets stored is always the
  // integer in the main currency, so no calculation in the domain changes.
  const originalAmount = parseMoney(value.amountText);
  const isForeign = value.currency !== mainCurrency;
  // The rate is fetched, never typed (lib/fxRates). Editing a transaction
  // keeps the rate it was saved with, as long as its currency doesn't change.
  const fx = useFxRate(
    value.currency, mainCurrency,
    existing?.currency === value.currency ? existing.fxRate : undefined,
  );
  const fxRate = fx.status === 'same' ? 1 : fx.status === 'ready' ? fx.rate : null;
  const amount = originalAmount !== null && fxRate !== null ? convert(originalAmount, fxRate) : null;
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

  /** Desktop's Gasto | Ingreso switch: keeps what still fits the new type. */
  function switchType(next: TransactionType) {
    setValue((v) => {
      if (v.type === next) return v;
      const cat = categories.find((c) => c.id === v.categoryId);
      const keepCategory = cat && (cat.kind === 'both' || cat.kind === next);
      const method = paymentMethods.find((m) => m.id === v.paymentMethodId);
      const keepMethod = !(next === 'income' && method?.type === 'credit');
      const fallback = paymentMethods.find((m) => m.id === defaultPaymentMethodId && m.type !== 'credit')?.id ?? null;
      return {
        ...v,
        type: next,
        categoryId: keepCategory ? v.categoryId : null,
        paymentMethodId: keepMethod ? v.paymentMethodId : fallback,
      };
    });
  }

  function pickCurrency(code: string) {
    setValue((v) => (code === v.currency ? v : { ...v, currency: code }));
  }

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
      ...(isForeign && originalAmount !== null && fxRate !== null
        ? { currency: value.currency, originalAmount, fxRate }
        : {}),
      ...(value.reminder != null ? { reminder: value.reminder } : {}),
      ...(existing?.time ? { time: existing.time } : {}),
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
    ? t(isIncome ? 'form.editIncome' : 'form.editExpense')
    : t(isIncome ? 'form.newIncome' : 'form.newExpense');

  // The amount's own currency: symbol small and grey beside the figure.
  const sample = formatMoney(0, value.currency);
  const symbol = sample.replace(/[\d\s]/g, '');
  const symbolAfter = sample.trimEnd().endsWith(symbol);
  const figure = value.amountText ? formatMoney(Number(value.amountText), value.currency).replace(symbol, '').trim() : '';
  const quick = quickCurrencyList(mainCurrency, quickCurrencies);

  const dialogRef = useDialogo(onCancel);

  // The pieces, shared by the phone sheet and the desktop dialog.
  const amountInput = (
    <input
      value={figure}
      onChange={(e) => setValue((v) => ({ ...v, amountText: e.target.value.replace(/[^0-9]/g, '').slice(0, 12) }))}
      placeholder="0"
      // On the phone the sheet has its own keypad (prototype 1a): the
      // system keyboard would cover it. The field stays a real input, so
      // a hardware keyboard, paste and screen readers still work.
      inputMode={wide ? 'numeric' : 'none'}
      enterKeyHint="next"
      autoFocus={!existing}
      aria-label={t('form.amount')}
      className="figures"
      // size=1: without it the input asks for ~20 characters of width and
      // the sizing grid around it (phone) can't shrink to the figure.
      size={1}
      style={{
        width: '100%', flex: wide ? 1 : undefined, ...(wide ? {} : { position: 'absolute' as const, inset: 0 }),
        minWidth: 0, border: 'none', background: 'none', outline: 'none',
        textAlign: wide ? 'left' : 'center', padding: 0,
        fontSize: wide ? 44 : 48, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: wide ? 1.1 : 1,
        color: !(amount && amount > 0) ? 'var(--text-dim)' : isIncome ? 'var(--positive-text)' : 'var(--text)',
      }}
    />
  );
  const symbolMark = (
    <span aria-hidden className="figures" style={{ fontSize: wide ? 30 : 24, fontWeight: 700, color: 'var(--text-faint)', marginTop: wide ? 0 : 7, lineHeight: 'normal', letterSpacing: '-0.035em' }}>{symbol}</span>
  );
  const amountField = (
    <label style={{ display: 'flex', alignItems: wide ? 'baseline' : 'flex-start', justifyContent: wide ? 'flex-start' : 'center', gap: wide ? 6 : 4, margin: wide ? 0 : '26px 0 0' }}>
      {!symbolAfter && symbolMark}
      {wide ? amountInput : (
        // As wide as the figure: a hidden copy of the text sizes the cell,
        // so the symbol sits right beside the number (a width in `ch` left
        // a gap, the digits being narrower than a `0`).
        <span style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <span
            aria-hidden
            className="figures"
            style={{ display: 'block', visibility: 'hidden', whiteSpace: 'pre', fontSize: 48, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, padding: '0 1px' }}
          >
            {figure || '0'}
          </span>
          {amountInput}
        </span>
      )}
      {symbolAfter && symbolMark}
    </label>
  );


  // Equivalence in the main currency, at today's rate.
  const amountHint = isForeign ? (
    <FxLine fx={fx} amount={amount} main={mainCurrency} align={wide ? 'left' : 'center'} compact={!wide} />
  ) : (
    // Keeps the line's height, so picking another currency doesn't push
    // the rest down.
    <div aria-hidden style={{ height: 16, marginTop: wide ? 6 : 4 }} />
  );
  const amountError = touched && (amount === null || amount <= 0) && <p style={errorText}>{t('transactions.enterValidAmount')}</p>;

  const conceptField = (
    <input
      id="tx-concepto"
      value={value.concept}
      onChange={(e) => setValue((v) => ({ ...v, concept: e.target.value }))}
      placeholder={t('form.conceptPlaceholder')}
      aria-label={t('form.concept')}
      style={wide ? {
        width: '100%', height: 44, padding: '0 12px', margin: '8px 0 0',
        borderRadius: 12, border: '1px solid var(--line-strong)', outline: 'none',
        background: 'var(--paper)', color: 'var(--text)', fontSize: 15, textAlign: 'left',
      } : {
        // Prototype 1a: just text, centred under the amount.
        width: '100%', margin: '4px 0 8px', padding: '6px 0', border: 'none', outline: 'none',
        background: 'none', color: 'var(--text)', fontSize: 16, textAlign: 'center',
      }}
    />
  );
  const conceptError = touched && !value.concept.trim() && <p style={errorText}>{t('transactions.writeWhatItIs')}</p>;

  // Recent-concept chips — only when NOT editing and there's history
  const recentChips = !existing && recents.length > 0 && (
    <FieldGroup label={t('form.useRecent')} id="tx-recientes" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
      {recents.map((r) => {
        const cat = r.categoryId ? categories.find((c) => c.id === r.categoryId) : null;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => applyRecent(r)}
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 6,
              minHeight: 34, padding: '0 12px', borderRadius: 999,
              border: '1px solid var(--line-strong)',
              background: 'transparent', color: 'var(--text)',
              fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {cat && <CategoryIcon icon={cat.icon} size={15} />}
            <span>{r.displayName}</span>
          </button>
        );
      })}
    </FieldGroup>
  );

  // Category chips: the active one wears its colour. On desktop they wrap.
  const categoryButtons = (
    <>
      {categories.filter((c) => c.kind === 'both' || c.kind === value.type).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setValue((v) => ({ ...v, categoryId: c.id }))}
          aria-pressed={value.categoryId === c.id}
          style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 6,
            height: wide ? 34 : 36, padding: '0 12px 0 8px', borderRadius: 18,
            border: `1px solid ${value.categoryId === c.id ? categoryColor(c) : 'var(--line)'}`,
            background: value.categoryId === c.id ? `color-mix(in srgb, ${categoryColor(c)} 18%, var(--surface))` : 'var(--paper)',
            color: 'var(--text)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'all var(--dur-fast) var(--ease-spring-out)',
          }}
        >
          <span style={{ display: 'flex', color: categoryColor(c) }}><CategoryIcon icon={c.icon} size={16} /></span>{c.name}
        </button>
      ))}
    </>
  );
  const categoryChips = wide ? (
    <>
      <DeskLabel id="tx-categoria">{t('form.category')}</DeskLabel>
      <div role="group" aria-labelledby="tx-categoria" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {categoryButtons}
      </div>
    </>
  ) : (
    <div
      role="group"
      aria-label={t('form.category')}
      className="noscroll"
      style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -16px 12px', padding: '0 16px' }}
    >
      {categoryButtons}
    </div>
  );

  const cardCycleLine = isCredit && paymentPreview && installments === 1 && (
        <p style={{ margin: '0 0 10px', fontSize: wide ? 'var(--text-sm)' : 12, color: 'var(--q25-text)', fontWeight: wide ? 600 : 400, textAlign: wide ? 'left' : 'center' }}>
          {fill(t('form.cardCycle'), { cutoff: selectedMethod?.cutoffDay ?? 15, payment: shortDate(paymentPreview) })}
        </p>
  );


  const pickDate = (iso: string) => setValue((v) => ({ ...v, date: iso, markPaidNow: iso <= todayISO() }));
  const datePendingNote = value.date > todayISO() && !value.markPaidNow && (
    <p style={{ margin: '0 0 10px', fontSize: wide ? 'var(--text-sm)' : 12, color: 'var(--q25-text)', fontWeight: wide ? 600 : 400, textAlign: wide ? 'left' : 'center' }}>
      {t('form.datePendingNote')}
    </p>
  );

  // This transaction's reminder.
  const reminderField = <ReminderChips value={value.reminder} onChange={(reminder) => setValue((v) => ({ ...v, reminder }))} />;

  // Advanced: hidden, not removed. Open on its own when editing something
  // that already uses it.
  const moreOptions = (
    <MoreOptions startOpen={Boolean(existing && value.markPaidNow !== (existing.status === 'paid'))}>
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

      <button
        type="button"
        onClick={() => setValue((v) => ({ ...v, markPaidNow: !v.markPaidNow }))}
        aria-pressed={value.markPaidNow}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: 'var(--tap)', padding: '0 4px', margin: '0 0 6px', background: 'none',
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
    </MoreOptions>
  );

  const editActions = existing && (
    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
      {onDuplicate && (
        <button type="button" onClick={onDuplicate} style={secondaryButtonStyle}>{t('action.duplicate')}</button>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} style={{ ...secondaryButtonStyle, color: 'var(--danger-text)' }}>
          {t('action.delete')}
        </button>
      )}
    </div>
  );

  const saveButtonStyle: React.CSSProperties = {
    border: 'none', fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed',
    background: canSave ? 'var(--q10)' : 'var(--surface-sunken)',
    color: canSave ? 'var(--on-accent)' : 'var(--text-faint)',
    transition: 'background var(--dur-fast) var(--ease-spring-out)',
  };

  if (wide) {
    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={existing ? t('form.dialogEdit') : t('form.dialogAdd')}
        className="dialog-wide"
        style={{
          position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 55%, transparent)',
          display: 'grid', placeItems: 'center', padding: 24, zIndex: 50,
          animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
        }}
        onClick={onCancel}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 780, maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto',
            background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 24,
            padding: '24px 26px', boxShadow: 'var(--shadow-3)',
            animation: 'dialogIn var(--dur-med) var(--ease-spring-out)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h2 style={{ flex: 1, margin: 0, fontSize: 20, fontWeight: 700, color: isIncome ? 'var(--positive-text)' : 'var(--text)' }}>
              {headerLabel}
            </h2>
            {!existing && (
              <div style={{ width: onRecurring ? 360 : 240 }}>
                <Segmented
                  size="s"
                  label={t('desk.formType')}
                  value={value.type}
                  onChange={(next) => {
                    if (next === 'recurring') onRecurring?.();
                    else switchType(next);
                  }}
                  options={[
                    { value: 'expense', label: t('desk.typeExpense') },
                    { value: 'income', label: t('desk.typeIncome') },
                    ...(onRecurring ? [{ value: 'recurring' as const, label: t('desk.typeRecurring') }] : []),
                  ] as Array<{ value: TransactionType | 'recurring'; label: string }>}
                />
              </div>
            )}
            <button
              type="button"
              onClick={onCancel}
              aria-label={t('action.close')}
              style={{
                width: 34, height: 34, borderRadius: 17, border: 'none', flex: 'none', cursor: 'pointer',
                background: 'var(--surface-sunken)', color: 'var(--text-muted)', display: 'grid', placeItems: 'center',
              }}
            >
              <IconX size={17} stroke={2} aria-hidden />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 290px', gap: 28, marginTop: 18 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ borderBottom: '1px solid var(--line-strong)', paddingBottom: 6 }}>{amountField}</div>
              {amountHint}
              {amountError}
              {conceptField}
              {conceptError}
              {recentChips}
              {/* Each block under a small label (prototype 2a). */}
              <DeskLabel>{t('form.currency')}</DeskLabel>
              <CurrencyChips value={value.currency} quick={quick} onChange={pickCurrency} align="start" />
              {categoryChips}
              <DeskLabel>{t('form.paymentMethod')}</DeskLabel>
              <div style={{ width: 360, maxWidth: '100%' }}>
                <MethodPicker
                  inset
                  methods={availableMethods}
                  value={value.paymentMethodId}
                  onChange={(id) => setValue((v) => ({ ...v, paymentMethodId: id }))}
                />
              </div>
              {cardCycleLine}
              <DeskLabel>{t('form.reminder')}</DeskLabel>
              <ReminderChips value={value.reminder} onChange={(reminder) => setValue((v) => ({ ...v, reminder }))} wrap />
              <div style={{ marginTop: 12 }}>{moreOptions}</div>
              {editActions}
            </div>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-faint)' }}>
                {fill(t('desk.dateOf'), { date: relativeDayLabel(value.date, todayISO(), t) })}
              </p>
              <MiniCalendar value={value.date} today={todayISO()} onChange={pickDate} />
              {datePendingNote}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                height: 42, padding: '0 18px', borderRadius: 12, border: '1px solid var(--line-strong)',
                background: 'none', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              {t('action.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave}
              style={{ ...saveButtonStyle, height: 42, padding: '0 22px', borderRadius: 12, fontSize: 14 }}
            >
              {t('action.save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={existing ? t('form.dialogEdit') : t('form.dialogAdd')}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex: 50,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
      onClick={onCancel}
    >
      {/* Compact sheet: as tall as its content, never taller than the
          screen minus 54px, scrolling inside. No flexible spacer. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '28px 28px 0 0', padding: '10px 18px calc(var(--safe-bottom) + 20px)',
          maxHeight: 'calc(100% - 54px)', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--handle)', margin: '0 auto 8px' }} />

        {/* 1. Cancelar · title · Guardar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              justifySelf: 'start', minHeight: 'var(--tap)', padding: 0, border: 'none', background: 'none',
              color: 'var(--q10-text)', fontSize: 16, cursor: 'pointer',
            }}
          >
            {t('action.cancel')}
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {headerLabel}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSave}
            style={{
              ...saveButtonStyle,
              justifySelf: 'end', height: 34, padding: '0 16px', borderRadius: 17, fontSize: 14,
            }}
          >
            {t('action.save')}
          </button>
        </div>

        {/* 2. The big amount IS the field, its currency's symbol small and
            grey beside it; under it the equivalence and the concept. */}
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          {amountField}
          {amountHint}
          {conceptField}
        </div>
        {amountError}
        {conceptError}
        {recentChips}

        <div style={{ marginTop: 6 }}>
          {/* 3. Currency, 4. category. */}
          <CurrencyChips value={value.currency} quick={quick} onChange={pickCurrency} />
          {categoryChips}

          {/* 5. Method and date on one row. The date is a chip ("Hoy",
              "Ayer", "3 Oct") that opens a month grid in the sheet. A past
              date means it already happened (paid/received); a future one
              stays pending. The pay period still comes from the date. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MethodPicker
                inset
                methods={availableMethods}
                value={value.paymentMethodId}
                onChange={(id) => setValue((v) => ({ ...v, paymentMethodId: id }))}
              />
            </div>
            <button
              type="button"
              onClick={() => setDateOpen((o) => !o)}
              aria-expanded={dateOpen}
              aria-label={fill(t('form.chooseDate'), { date: dateLabel(value.date, t, 'long') })}
              style={{
                flex: 'none', display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 12px',
                borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 600, alignSelf: 'flex-start',
                border: `1px solid ${dateOpen ? 'var(--q10)' : 'transparent'}`,
                background: dateOpen ? 'var(--q10-soft)' : 'var(--paper)', color: 'var(--text)',
              }}
            >
              <IconCalendar size={15} stroke={2} aria-hidden />
              {relativeDayLabel(value.date, todayISO(), t)}
            </button>
          </div>
          {cardCycleLine}
          {dateOpen && <MiniCalendar value={value.date} today={todayISO()} onChange={pickDate} />}
          {datePendingNote}
        </div>

        {/* 6. This transaction's reminder. */}
        <div style={{ marginTop: 18 }}>{reminderField}</div>

        {/* 7. The keypad (prototype 1a, §5.6): 3×4 keys, 000 and ⌫. */}
        <Keypad
          label={t('form.keypad')}
          deleteLabel={t('form.deleteDigit')}
          onKey={(key) => setValue((v) => {
            if (key === '⌫') return { ...v, amountText: v.amountText.slice(0, -1) };
            const next = (v.amountText + key).replace(/^0+/, '');
            return { ...v, amountText: next.length > 10 ? v.amountText : next };
          })}
        />

        {/* 8. Advanced options, folded. */}
        <div style={{ marginTop: 12 }}>{moreOptions}</div>

        {editActions}
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

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
  fontSize: 'var(--text-base)',
};

/** A block's small label in the desktop form (prototype 2a: "Moneda", "Categoría"…). */
function DeskLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return <div id={id} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-faint)', margin: '16px 0 8px' }}>{children}</div>;
}

/** The sheet's own number pad. Buttons, so it reads fine with a screen
 *  reader; the amount field above stays the real input. */
function Keypad({ onKey, label, deleteLabel }: { onKey: (key: string) => void; label: string; deleteLabel: string }) {
  const [pressed, setPressed] = useState<string | null>(null);
  return (
    <div role="group" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 20 }}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'].map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key === '⌫' ? deleteLabel : undefined}
          onClick={() => { haptic('light'); onKey(key); }}
          onPointerDown={() => setPressed(key)}
          onPointerUp={() => setPressed(null)}
          onPointerLeave={() => setPressed(null)}
          style={{
            height: 56, border: 'none', borderRadius: 16, cursor: 'pointer',
            background: pressed === key ? 'var(--line-strong)' : 'var(--surface-sunken)',
            color: 'var(--text)', fontSize: 22, fontWeight: 500,
          }}
        >
          {key}
        </button>
      ))}
    </div>
  );
}

/** "≈ $ 80.000 COP · tasa de hoy 4.016" — read-only: the rate is fetched. */
export function FxLine({ fx, amount, main, align = 'center', compact = false }: {
  fx: ReturnType<typeof useFxRate>; amount: number | null; main: string; align?: 'center' | 'left';
  /** Under the phone sheet's amount: 12px, one fixed-height line. */
  compact?: boolean;
}) {
  const t = useT();
  let text: string;
  if (fx.status === 'loading') text = t('form.fxLoading');
  else if (fx.status === 'unavailable') text = t('form.fxUnavailable');
  else if (fx.status === 'ready') {
    const approx = amount !== null ? `${fill(t('form.fxApprox'), { amount: formatMoney(amount, main), main })} · ` : '';
    const rate = formatRate(fx.rate);
    text = approx + (!fx.fetchedOn
      ? fill(t('form.fxSavedRate'), { rate })
      : fx.stale
        ? fill(t('form.fxRateOn'), { rate, date: dateLabel(fx.fetchedOn, t, 'short') })
        : fill(t('form.fxTodayRate'), { rate }));
  } else text = '';
  return (
    <p
      role="status"
      className="figures"
      style={{
        margin: compact ? '4px 0 0' : '0 0 10px', textAlign: align, fontSize: compact ? 12 : 'var(--text-sm)',
        minHeight: compact ? 16 : undefined,
        color: fx.status === 'unavailable' ? 'var(--danger-text)' : 'var(--text-muted)',
      }}
    >
      {text}
    </p>
  );
}
