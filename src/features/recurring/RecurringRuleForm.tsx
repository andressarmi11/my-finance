import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { useT } from '@/i18n/language';
import { useEffect, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import type { Category, Frequency, PaymentMethod, RecurringRule, TransactionType } from '@/domain/types';
import { parseMoney } from '@/domain/money/format';
import { todayISO } from '@/lib/todayISO';
import { Field, FieldGroup } from '@/components/ui/Field';
import type { TextKey } from '@/i18n/texts';
import { MoreOptions } from '@/components/ui/MoreOptions';
import { MonthChipGrid } from '@/components/ui/MonthChipGrid';
import { nextOccurrences } from '@/domain/recurring/expansion';
import { previewRuleSave } from '@/data/local/recurringEdit';
import { dateLabel, fill } from '@/lib/dateLabels';
import { CurrencyChips } from '@/components/ui/CurrencyChips';
import { convert, quickCurrencyList } from '@/lib/currencies';
import { useFxRate } from '@/lib/fxRates';
import { FxLine } from '@/features/transactions/TransactionForm';
import { Segmented } from '@/components/ui/Segmented';
import { MethodPicker } from '@/components/ui/MethodPicker';
import { categoryColor } from '@/domain/seed/categoryColor';
import { formatMoney } from '@/domain/money/format';

/** Advanced repetition, behind "More options". 'none' = the simple frequency row. */
type Repeat = 'none' | 'interval' | 'months';

const FREQUENCIES: Array<{ value: Frequency; label: TextKey }> = [
  { value: 'monthly', label: 'recurring.monthly' },
  { value: 'biweekly', label: 'recurring.biweekly' },
  { value: 'weekly', label: 'recurring.weekly' },
  { value: 'yearly', label: 'recurring.yearly' },
];

export function RecurringRuleForm({
  existing, categories, paymentMethods, mainCurrency = 'COP', quickCurrencies, onSave, onCancel, onDelete,
}: {
  existing: RecurringRule | null;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  /** Settings.currency: the rule's `amount` is always stored in it. */
  mainCurrency?: string;
  quickCurrencies?: string[];
  onSave: (rule: RecurringRule) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const t = useT();
  const [type, setType] = useState<TransactionType>(existing?.type ?? 'expense');
  const [name, setName] = useState(existing?.name ?? '');
  // A rule entered in another currency (redesign §9b) edits its original
  // amount; `amount` stays the converted integer, so nothing downstream moves.
  const foreign = !!existing?.currency && existing.currency !== mainCurrency
    && existing.originalAmount != null && !!existing.fxRate;
  const [currency, setCurrency] = useState(foreign ? existing!.currency! : mainCurrency);
  const [amountText, setAmountText] = useState(
    existing ? String(Math.round(foreign ? existing.originalAmount! : existing.amount)) : '',
  );
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(existing?.paymentMethodId ?? paymentMethods[0]?.id ?? null);
  // 'custom' is not a button in the simple row: it lives in `repeat` below.
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency === 'custom' ? 'monthly' : existing?.frequency ?? 'monthly');
  const [repeat, setRepeat] = useState<Repeat>(
    existing?.frequency !== 'custom' ? 'none' : existing.months ? 'months' : 'interval',
  );
  const [every, setEvery] = useState(existing?.interval?.every ?? 2);
  const [unit, setUnit] = useState<'months' | 'weeks'>(existing?.interval?.unit ?? 'months');
  const [monthSet, setMonthSet] = useState<Set<string>>(new Set((existing?.months ?? []).map(String)));
  const [dayOfMonth, setDayOfMonth] = useState(existing?.dayOfMonth ?? 1);
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayISO());
  const [hasEnd, setHasEnd] = useState(Boolean(existing?.endDate));
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [touched, setTouched] = useState(false);

  const originalAmount = parseMoney(amountText);
  const isForeign = currency !== mainCurrency;
  // The rate is fetched, never typed (lib/fxRates); an edited rule keeps
  // the rate it was saved with while its currency doesn't change.
  const fx = useFxRate(currency, mainCurrency, existing?.currency === currency ? existing.fxRate : undefined);
  const fxRate = fx.status === 'same' ? 1 : fx.status === 'ready' ? fx.rate : null;
  const amount = originalAmount !== null && fxRate !== null ? convert(originalAmount, fxRate) : null;
  const canSave = name.trim().length > 0 && amount !== null && amount > 0 && !!startDate
    && (repeat !== 'months' || monthSet.size > 0);
  const needsDayOfMonth = repeat === 'none' ? frequency === 'monthly' : repeat === 'months' || unit === 'months';
  const maxEvery = unit === 'months' ? 12 : 26;

  function buildRule(): RecurringRule {
    const custom = repeat !== 'none';
    return {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      type,
      amount: amount ?? 0,
      ...(isForeign && originalAmount !== null && fxRate !== null
        ? { currency, originalAmount, fxRate }
        : {}),
      categoryId,
      paymentMethodId,
      frequency: custom ? 'custom' : frequency,
      dayOfMonth: needsDayOfMonth ? dayOfMonth : undefined,
      interval: repeat === 'interval' ? { every, unit } : undefined,
      months: repeat === 'months' ? [...monthSet].map(Number).sort((a, b) => a - b) : undefined,
      startDate,
      endDate: hasEnd && endDate ? endDate : undefined,
      isActive,
      // The real date gets stamped by the repository on save.
      updatedAt: existing?.updatedAt ?? '',
    };
  }

  // What an edit would touch among the already-generated pending payments,
  // so the button can say it BEFORE the tap instead of surprising afterwards.
  const [impact, setImpact] = useState<{ affected: number; from: string | null }>({ affected: 0, from: null });
  // The name never changes WHICH occurrences move (matching is by id/period),
  // so typing it must not re-run the preview; the rest is debounced.
  const draftKey = existing && canSave ? JSON.stringify({ ...buildRule(), name: '', updatedAt: '' }) : '';
  useEffect(() => {
    if (!draftKey) { setImpact({ affected: 0, from: null }); return; }
    let alive = true;
    const timer = window.setTimeout(() => {
      previewRuleSave(buildRule()).then((r) => { if (alive) setImpact(r); });
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
    // buildRule reads exactly what draftKey serialises.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Only the schedule has to be valid, not the name or amount.
  const scheduleValid = repeat === 'interval' || (repeat === 'months' && monthSet.size > 0);
  const thisYear = todayISO().slice(0, 4);
  const upcoming = scheduleValid ? nextOccurrences(buildRule(), todayISO(), 3) : [];

  function handleSubmit() {
    setTouched(true);
    if (!canSave || amount === null) return;
    onSave(buildRule());
  }

  const dialogRef = useDialogo(onCancel);
  // The currency's own symbol, small and grey beside the figure.
  const symbol = formatMoney(0, currency).replace(/[\d\s.,]/g, '');
  const digits = amountText.replace(/[^0-9]/g, '');
  const figure = digits ? formatMoney(Number(digits), currency).replace(symbol, '').trim() : '';
  const saveLabel = impact.affected > 0 ? fill(t('recurring.saveAndUpdate'), { n: impact.affected }) : t('action.save');

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={existing ? t('action.edit') : t('action.newRecurring')}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onCancel}
    >
      {/* The same sheet as a new expense (redesign §9b, prototype 1a
          "Recurrente"): Gasto | Ingreso on top, "Cada mes, el día" instead
          of the date, and the keypad. The rest of the schedule lives in
          "Más opciones". */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', borderRadius: '28px 28px 0 0', padding: '10px 16px calc(var(--safe-bottom) + 24px)', maxHeight: 'calc(100% - 54px)', overflowY: 'auto' }}
      >
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--handle)', margin: '0 auto 10px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={onCancel} style={{ justifySelf: 'start', minHeight: 'var(--tap)', padding: 0, border: 'none', background: 'none', color: 'var(--q10-text)', fontSize: 16, cursor: 'pointer' }}>
            {t('action.cancel')}
          </button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            {existing ? t('recurring.editOne') : t('action.newRecurring')}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSave}
            style={{
              justifySelf: 'end', height: 34, padding: '0 16px', borderRadius: 17, border: 'none', whiteSpace: 'nowrap',
              background: canSave ? 'var(--q10)' : 'var(--surface-sunken)', color: canSave ? 'var(--on-accent)' : 'var(--text-dim)',
              fontWeight: 700, fontSize: 14, cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            {saveLabel}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <Segmented
            inset
            size="s"
            labelSize={13}
            label={t('desk.formType')}
            value={type}
            onChange={setType}
            options={[{ value: 'expense', label: t('desk.typeExpense') }, { value: 'income', label: t('desk.typeIncome') }]}
          />
        </div>

        {impact.affected > 0 && impact.from && (
          <p role="status" style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: 'var(--radius-s)', background: 'var(--q10-soft)', color: 'var(--text)', fontSize: 'var(--text-sm)' }}>
            {fill(t('recurring.willUpdate'), { n: impact.affected, date: dateLabel(impact.from, t) })}
          </p>
        )}

        {/* The amount, big and centred, sized to its figure; the name under it. */}
        <div style={{ textAlign: 'center', padding: '26px 0 8px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 4 }}>
            <span aria-hidden className="figures" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-faint)', marginTop: 7, lineHeight: 'normal' }}>{symbol}</span>
            <span style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <span aria-hidden className="figures" style={{ display: 'block', visibility: 'hidden', whiteSpace: 'pre', fontSize: 48, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, padding: '0 1px' }}>
                {figure || '0'}
              </span>
              <input
                id="rr-valor"
                value={figure}
                onChange={(e) => setAmountText(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                placeholder="0"
                inputMode="none"
                size={1}
                aria-label={t('form.amount')}
                className="figures"
                style={{
                  position: 'absolute', inset: 0, width: '100%', minWidth: 0, border: 'none', background: 'none', outline: 'none', padding: 0,
                  textAlign: 'center', fontSize: 48, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1,
                  color: !(amount && amount > 0) ? 'var(--text-dim)' : type === 'income' ? 'var(--positive-text)' : 'var(--text)',
                }}
              />
            </span>
          </label>
          {isForeign
            ? <FxLine fx={fx} amount={amount} main={mainCurrency} compact />
            : <div aria-hidden style={{ height: 16, marginTop: 4 }} />}
          <input
            id="rr-nombre"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('form.conceptPlaceholder')}
            aria-label={t('form.name')}
            style={{ width: '100%', margin: '4px 0 0', padding: '6px 0', border: 'none', outline: 'none', background: 'none', color: 'var(--text)', fontSize: 16, textAlign: 'center' }}
          />
        </div>
        {touched && !name.trim() && <p style={errorText}>{t('recurring.giveItAName')}</p>}
        {touched && (amount === null || amount <= 0) && <p style={errorText}>{t('transactions.enterValidAmount')}</p>}

        <div style={{ marginTop: 6 }}>
          <CurrencyChips value={currency} quick={quickCurrencyList(mainCurrency, quickCurrencies)} onChange={setCurrency} />

          <div
            role="group"
            aria-label={t('form.category')}
            className="noscroll"
            style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -16px 12px', padding: '0 16px' }}
          >
            {categories.filter((c) => c.kind === 'both' || c.kind === type).map((c) => {
              const on = categoryId === c.id;
              const color = categoryColor(c);
              return (
                <button
                  key={c.id} type="button" onClick={() => setCategoryId(c.id)} aria-pressed={on}
                  style={{
                    flex: 'none', display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px 0 8px', borderRadius: 18,
                    border: `1px solid ${on ? color : 'var(--line)'}`,
                    background: on ? `color-mix(in srgb, ${color} 18%, var(--surface))` : 'var(--paper)',
                    color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'flex', color }}><CategoryIcon icon={c.icon} size={16} /></span>{c.name}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: 12 }}>
            <MethodPicker inset methods={paymentMethods} value={paymentMethodId} onChange={setPaymentMethodId} />
          </div>

          {/* The day, where a one-off expense has its date. Other
              frequencies and schedules are in "Más opciones". */}
          {repeat === 'none' && frequency === 'monthly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--paper)', borderRadius: 12, padding: '4px 4px 4px 12px' }}>
              <label htmlFor="rr-dia" style={{ flex: 1, fontSize: 14, color: 'var(--text-muted)' }}>{t('recurring.everyMonthOnDay')}</label>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 3 }}>
                <button type="button" aria-label={t('recurring.dayLess')} disabled={dayOfMonth <= 1} onClick={() => setDayOfMonth((d) => Math.max(1, d - 1))} style={dayButton}>−</button>
                <input
                  id="rr-dia"
                  type="number" inputMode="numeric" min={1} max={31} value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="figures stepper-input"
                  style={{ width: 32, border: 'none', background: 'none', textAlign: 'center', color: 'var(--text)', fontWeight: 700, fontSize: 16, padding: 0 }}
                />
                <button type="button" aria-label={t('recurring.dayMore')} disabled={dayOfMonth >= 31} onClick={() => setDayOfMonth((d) => Math.min(31, d + 1))} style={dayButton}>+</button>
              </span>
            </div>
          )}
          {repeat !== 'none' && (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center' }}>{t('recurring.setInMore')}</p>
          )}
        </div>

        {/* The keypad, as in the expense sheet. */}
        <div role="group" aria-label={t('form.keypad')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 20 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'].map((key) => (
            <button
              key={key}
              type="button"
              aria-label={key === '⌫' ? t('form.deleteDigit') : undefined}
              onClick={() => setAmountText((v) => {
                if (key === '⌫') return v.slice(0, -1);
                const next = (v + key).replace(/^0+/, '');
                return next.length > 10 ? v : next;
              })}
              style={{ height: 56, border: 'none', borderRadius: 16, cursor: 'pointer', background: 'var(--surface-sunken)', color: 'var(--text)', fontSize: 22, fontWeight: 500 }}
            >
              {key}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
        <MoreOptions startOpen={repeat !== 'none'}>
          <FieldGroup label={t('recurring.frequency')} id="rr-frecuencia" style={{ display: 'flex', gap: 6, marginBottom: repeat === 'none' ? 14 : 4, opacity: repeat === 'none' ? 1 : 0.45 }}>
            {FREQUENCIES.map((f) => (
              <button key={f.value} type="button" onClick={() => setFrequency(f.value)} disabled={repeat !== 'none'} aria-pressed={repeat === 'none' && frequency === f.value} style={segmentStyle(repeat === 'none' && frequency === f.value)}>
                {t(f.label)}
              </button>
            ))}
          </FieldGroup>

          {needsDayOfMonth && !(repeat === 'none' && frequency === 'monthly') && (
            <Field label={t('recurring.dayOfMonth')} htmlFor="rr-dia-mas">
              <input
                id="rr-dia-mas"
                type="number" inputMode="numeric" min={1} max={31} value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                style={inputStyle}
              />
            </Field>
          )}

          <FieldGroup label={t('recurring.howRepeats')} id="rr-repite" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {([['none', 'recurring.standard'], ['interval', 'recurring.everySoOften'], ['months', 'recurring.specificMonths']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setRepeat(value)} aria-pressed={repeat === value} style={segmentStyle(repeat === value)}>
                {t(label)}
              </button>
            ))}
          </FieldGroup>

          {repeat === 'interval' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <button type="button" aria-label={t('recurring.less')} disabled={every <= 1} onClick={() => setEvery((n) => Math.max(1, n - 1))} style={dayButton}>−</button>
                <span aria-live="polite" className="figures" style={{ minWidth: 44, textAlign: 'center', fontSize: 18, fontWeight: 700 }}>{every}</span>
                <button type="button" aria-label={t('recurring.more')} disabled={every >= maxEvery} onClick={() => setEvery((n) => Math.min(maxEvery, n + 1))} style={dayButton}>+</button>
                <div role="group" aria-label={t('recurring.everySoOften')} style={{ flex: 1, display: 'flex', gap: 6, marginLeft: 6 }}>
                  {(['weeks', 'months'] as const).map((u) => (
                    <button
                      key={u} type="button" aria-pressed={unit === u} style={segmentStyle(unit === u)}
                      onClick={() => { setUnit(u); setEvery((n) => Math.min(n, u === 'months' ? 12 : 26)); }}
                    >
                      {t(u === 'weeks' ? 'recurring.weeksUnit' : 'recurring.monthsUnit')}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{t('recurring.everyHint')}</p>
            </div>
          )}

          {repeat === 'months' && (
            <MonthChipGrid
              items={Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), month: i + 1 }))}
              selected={monthSet}
              onToggle={(k) => setMonthSet((prev) => {
                const next = new Set(prev);
                if (!next.delete(k)) next.add(k);
                return next;
              })}
            />
          )}
          {repeat === 'months' && monthSet.size === 0 && (
            <p style={{ margin: '-6px 0 10px', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>{t('recurring.pickMonths')}</p>
          )}
          {upcoming.length > 0 && (
            <p style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {fill(t('recurring.next'), { dates: upcoming.map((d) => dateLabel(d, t) + (d.slice(0, 4) !== thisYear ? ` ${d.slice(0, 4)}` : '')).join(' · ') })}
            </p>
          )}

          <Field label={t('recurring.startsOn')} htmlFor="rr-inicio">
            <input id="rr-inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </Field>

          <button
            type="button"
            onClick={() => setHasEnd((v) => !v)}
            aria-pressed={hasEnd}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 'var(--tap)', padding: '0 4px', marginBottom: hasEnd ? 8 : 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
          >
            <span>{t('recurring.hasEndDate')}</span>
            <ToggleDot on={hasEnd} />
          </button>
          {hasEnd && (
            <input aria-label={t('recurring.endDate')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          )}

          <button
            type="button"
            onClick={() => setIsActive((v) => !v)}
            aria-pressed={isActive}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 'var(--tap)', padding: '0 4px', margin: '4px 0 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
          >
            <span>{t('recurring.active')}</span>
            <ToggleDot on={isActive} activeColor="var(--positive)" />
          </button>
        </MoreOptions>
        </div>

        {existing && onDelete && (
          <button type="button" onClick={onDelete} style={{ width: '100%', minHeight: 44, marginTop: 10, borderRadius: 14, border: 'none', background: 'var(--surface-sunken)', color: 'var(--danger-text)', fontWeight: 600, cursor: 'pointer' }}>
            {t('recurring.deleteOne')}
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleDot({ on, activeColor = 'var(--text)' }: { on: boolean; activeColor?: string }) {
  return (
    <span aria-hidden style={{ width: 44, height: 26, borderRadius: 13, background: on ? activeColor : 'var(--surface-sunken)', border: '1px solid var(--line)', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 21 : 2, width: 20, height: 20, borderRadius: 10, background: 'var(--knob)', boxShadow: '0 1px 3px rgb(0 0 0/.3)' }} />
    </span>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', minHeight: 'var(--tap)', padding: '0 12px', marginBottom: 14, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16 };
const dayButton: React.CSSProperties = { width: 32, height: 32, flex: 'none', borderRadius: 9, border: 'none', background: 'var(--surface-sunken)', color: 'var(--text)', fontSize: 18, cursor: 'pointer' };
const errorText: React.CSSProperties = { margin: '0 0 8px', fontSize: 12, color: 'var(--danger-text)', textAlign: 'center' };
function segmentStyle(active: boolean): React.CSSProperties {
  return { flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: active ? 'var(--text)' : 'var(--surface)', color: active ? 'var(--surface)' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 13 };
}
