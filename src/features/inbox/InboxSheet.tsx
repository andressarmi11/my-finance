import { IconBolt, IconCheck, IconMessage, IconMicrophone, type IconProps } from '@tabler/icons-react';
import type { ComponentType, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useBreakpoint } from '@/app/useBreakpoint';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { CurrencyChips } from '@/components/ui/CurrencyChips';
import { MethodPicker } from '@/components/ui/MethodPicker';
import { MiniCalendar, relativeDayLabel } from '@/components/ui/MiniCalendar';
import { monthName } from '@/components/ui/MonthNav';
import { useDialogo } from '@/components/ui/useDialogo';
import { formatMoney } from '@/domain/money/format';
import { calculatePeriod, isMonthly } from '@/domain/period/period';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import type { Category, PaymentMethod, TransactionSource } from '@/domain/types';
import { useT } from '@/i18n/language';
import { CURRENCIES, formatRate, quickCurrencyList } from '@/lib/currencies';
import { dateLabel, fill } from '@/lib/dateLabels';
import { shortDay } from '@/lib/formatShortDate';
import type { FxState } from '@/lib/fxRates';
import { ago, type Draft, type Edits } from './review';

export const SOURCE_ICON: Record<TransactionSource, ComponentType<IconProps>> = {
  sms: IconMessage,
  atajo: IconBolt,
  dictation: IconMicrophone,
};

/** "SMS · Bancolombia · hace 1 min" — where it came from and when. */
export function useSourceLine() {
  const t = useT();
  return (d: Draft, withKind = true): string => {
    const a = ago(d.entry.createdAt);
    const when = a.unit === 'now' ? t('inbox.agoNow')
      : fill(t(a.unit === 'min' ? 'inbox.agoMin' : a.unit === 'h' ? 'inbox.agoH' : 'inbox.agoD'), { n: a.n });
    return [withKind ? t(`inbox.src.${d.source}`) : null, d.bank, when].filter(Boolean).join(' · ');
  };
}

type Picker = 'category' | 'method' | 'date' | 'currency' | null;

/**
 * Review, one at a time (BANDEJA.md, 3b). Everything is corrected right
 * here — amount, concept, expense or income, category, method, date and
 * currency — and "Anotar" stays off while the amount or the concept is
 * missing. On desktop it's a 520 px dialog: ⏎ records, ⌫ discards.
 */
export function InboxSheet(props: {
  current: Draft | null;
  position: number;
  total: number;
  doneCount: number;
  recorded: number;
  discarded: number;
  bulkCount: number;
  busy: boolean;
  fx: FxState;
  mainCurrency: string;
  quickCurrencies: string[] | undefined;
  payDays: number[];
  categories: Category[];
  methods: PaymentMethod[];
  today: string;
  onPatch: (e: Edits) => void;
  onAccept: () => void;
  onDiscard: () => void;
  onAcceptAll: () => void;
  onClose: () => void;
}) {
  const { current: d, onClose } = props;
  const t = useT();
  const desktop = useBreakpoint() === 'desktop';
  const dialogRef = useDialogo(onClose);

  function onKeyDown(e: KeyboardEvent) {
    if (!desktop || !d) return;
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      if (d.complete && !props.busy) props.onAccept();
    } else if (e.key === 'Backspace' && !typing) {
      e.preventDefault();
      if (!props.busy) props.onDiscard();
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={t('inbox.reviewTitle')}
      className={desktop ? 'dialog-wide' : undefined}
      onClick={onClose}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'color-mix(in srgb, black 55%, transparent)',
        display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center',
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: desktop ? 520 : 560, background: 'var(--surface)',
          border: desktop ? '1px solid var(--line-strong)' : undefined, boxShadow: desktop ? 'var(--shadow-3)' : undefined,
          borderRadius: desktop ? 24 : '28px 28px 0 0',
          padding: desktop ? '20px 22px 22px' : '10px 18px calc(var(--safe-bottom) + 30px)',
          maxHeight: desktop ? '90vh' : '92vh', overflowY: 'auto',
          animation: `${desktop ? 'fadeIn' : 'slideUp'} var(--dur-med) var(--ease-spring-out)`,
        }}
      >
        {!desktop && <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--handle)', margin: '0 auto 12px' }} />}
        {d ? <Review {...props} current={d} desktop={desktop} /> : (
          <AllDone recorded={props.recorded} discarded={props.discarded} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function Review(props: Parameters<typeof InboxSheet>[0] & { current: Draft; desktop: boolean }) {
  const { current: d, fx, mainCurrency, categories, methods, today, onPatch } = props;
  const t = useT();
  const sourceLine = useSourceLine();
  const [picker, setPicker] = useState<Picker>(null);
  const [showOrig, setShowOrig] = useState(false);
  // A different entry starts with everything folded.
  useEffect(() => { setPicker(null); setShowOrig(false); }, [d.entry.id]);

  // Desktop: ⏎ records. So focus starts on "Anotar" — or on the amount when
  // that's what's missing — not on ✕ (the dialog's first control), where ⏎
  // would close it. After the dialog's own initial focus, hence the timeout.
  const acceptRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const { desktop } = props;
  useEffect(() => {
    if (!desktop) return;
    const id = setTimeout(() => (d.missing === 'amount' ? amountRef.current : acceptRef.current)?.focus(), 0);
    return () => clearTimeout(id);
    // Only when the entry changes, never while the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.entry.id, desktop]);

  const SourceIcon = SOURCE_ICON[d.source];
  const income = d.type === 'income';
  const cat = categories.find((c) => c.id === d.categoryId);
  const method = methods.find((m) => m.id === d.paymentMethodId);
  const visibleCats = categories.filter((c) => !c.isArchived && (c.kind === 'both' || c.kind === d.type));
  const flag = CURRENCIES.find((c) => c.code === d.currency)?.flag ?? '';
  const foreign = d.currency !== mainCurrency;
  const fxReady = !foreign || fx.status === 'ready';
  const canAccept = d.complete && fxReady && !props.busy;
  const dayWord = d.date === today ? `${t('date.today')}, ${shortDay(d.date)}` : relativeDayLabel(d.date, today, t);
  const toggle = (p: Exclude<Picker, null>) => setPicker((cur) => (cur === p ? null : p));

  const hint = hintFor(d, { cat, today, payDays: props.payDays, t });

  const chip: React.CSSProperties = {
    height: 32, padding: '0 11px', borderRadius: 16, border: '1px solid var(--line-strong)',
    background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap',
  };
  const open = (p: Picker): React.CSSProperties => (picker === p ? { borderColor: 'var(--q10)', background: 'var(--q10-soft)' } : {});

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ flex: 1, margin: 0, fontWeight: 700, fontSize: 18 }}>{t('inbox.reviewTitle')}</h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          {fill(t('inbox.position'), { i: props.position, n: props.total })}
        </span>
        <button
          type="button"
          onClick={props.onClose}
          aria-label={t('action.close')}
          style={{
            width: 30, height: 30, borderRadius: 15, border: 'none', background: 'var(--surface-sunken)',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
          }}
        >
          ✕
        </button>
      </div>
      <div
        role="progressbar"
        aria-label={t('inbox.progress')}
        aria-valuemin={0}
        aria-valuemax={props.total}
        aria-valuenow={props.doneCount}
        style={{ display: 'flex', gap: 4, margin: '10px 0 14px' }}
      >
        {Array.from({ length: props.total }, (_, i) => (
          <span
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i === props.position - 1 ? 'var(--text)' : i < props.doneCount ? 'var(--q10)' : 'var(--line-strong)',
            }}
          />
        ))}
      </div>

      <div style={{ background: 'var(--paper)', borderRadius: 20, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', color: 'var(--q25)' }}><SourceIcon size={14} stroke={2} aria-hidden /></span>
          {sourceLine(d)}
        </div>

        <div
          role="group"
          aria-label={t('inbox.typeLabel')}
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--surface)', borderRadius: 10,
            padding: 3, marginTop: 12, width: 180,
          }}
        >
          {(['expense', 'income'] as const).map((k) => {
            const on = d.type === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  if (on) return;
                  // A category of the other kind no longer fits: back to none.
                  const fits = !cat || cat.kind === 'both' || cat.kind === k;
                  onPatch({ type: k, ...(fits ? {} : { categoryId: null }) });
                }}
                style={{
                  height: 28, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  background: on ? 'var(--line-strong)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-faint)',
                }}
              >
                {t(k === 'expense' ? 'inbox.kindExpense' : 'inbox.kindIncome')}
              </button>
            );
          })}
        </div>

        <label
          style={{
            display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10, paddingBottom: 4,
            borderBottom: `1.5px solid ${d.missing === 'amount' ? 'var(--danger)' : 'var(--line-strong)'}`,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-faint)' }}>
            {CURRENCY_SYMBOL[d.currency] ?? '$'}
          </span>
          <input
            ref={amountRef}
            aria-label={t('inbox.amountLabel')}
            value={d.amount != null ? groupDigits(d.amount, d.currency) : ''}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
              onPatch({ amount: digits ? Number(digits) : null });
            }}
            placeholder={t('inbox.amountPlaceholder')}
            inputMode="numeric"
            className="figures"
            style={{
              flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', padding: 0,
              fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em',
              color: income ? 'var(--positive-text)' : 'var(--text)',
            }}
          />
        </label>
        {foreign && fx.status === 'ready' && d.amount != null && (
          <div className="figures" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            1 {d.currency} = {formatRate(fx.rate)} {mainCurrency}
          </div>
        )}
        <input
          aria-label={t('inbox.conceptLabel')}
          value={d.concept}
          onChange={(e) => onPatch({ concept: e.target.value })}
          placeholder={t('inbox.conceptPlaceholder')}
          style={{
            width: '100%', marginTop: 8, border: 'none', background: 'none', outline: 'none', padding: 0,
            fontSize: 16, fontWeight: 500, color: 'var(--text)',
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => toggle('category')}
            aria-expanded={picker === 'category'}
            aria-label={`${t('form.category')}: ${cat?.name ?? t('categories.none')}`}
            style={{ ...chip, padding: '0 11px 0 7px', ...open('category') }}
          >
            <span style={{ display: 'flex', color: cat ? categoryColor(cat) : UNCATEGORIZED_COLOR }}>
              <CategoryIcon icon={cat?.icon ?? 'other'} size={15} stroke={2} />
            </span>
            {cat?.name ?? t('categories.none')}
          </button>
          <button
            type="button"
            onClick={() => toggle('method')}
            aria-expanded={picker === 'method'}
            aria-label={`${t('form.paymentMethod')}: ${method?.name ?? '—'}`}
            style={{ ...chip, ...open('method') }}
          >
            {method?.name ?? '—'}
          </button>
          <button
            type="button"
            onClick={() => toggle('date')}
            aria-expanded={picker === 'date'}
            aria-label={fill(t('form.chooseDate'), { date: dateLabel(d.date, t, 'long') })}
            style={{ ...chip, ...open('date') }}
          >
            {dayWord}
          </button>
          <button
            type="button"
            onClick={() => toggle('currency')}
            aria-expanded={picker === 'currency'}
            aria-label={`${t('form.currency')}: ${d.currency}`}
            style={{ ...chip, gap: 5, ...open('currency') }}
          >
            <span aria-hidden>{flag}</span>{d.currency}
          </button>
        </div>

        {picker === 'category' && (
          <div role="group" aria-label={t('form.category')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {visibleCats.map((c) => {
              const on = c.id === d.categoryId;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { onPatch({ categoryId: c.id }); setPicker(null); }}
                  style={{
                    ...chip, padding: '0 11px 0 7px',
                    border: `1px solid ${on ? categoryColor(c) : 'var(--line)'}`,
                    background: on ? `color-mix(in srgb, ${categoryColor(c)} 18%, var(--surface))` : 'var(--surface)',
                  }}
                >
                  <span style={{ display: 'flex', color: categoryColor(c) }}><CategoryIcon icon={c.icon} size={15} stroke={2} /></span>
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
        {picker === 'method' && (
          <div style={{ marginTop: 10 }}>
            <MethodPicker
              inset
              methods={income ? methods.filter((m) => m.type !== 'credit') : methods}
              value={d.paymentMethodId}
              onChange={(id) => { onPatch({ paymentMethodId: id }); setPicker(null); }}
            />
          </div>
        )}
        {picker === 'date' && (
          <div style={{ marginTop: 10 }}>
            <MiniCalendar value={d.date} today={today} onChange={(iso) => { onPatch({ date: iso }); setPicker(null); }} />
          </div>
        )}
        {picker === 'currency' && (
          <div style={{ marginTop: 10 }}>
            <CurrencyChips
              value={d.currency}
              quick={quickCurrencyList(mainCurrency, props.quickCurrencies)}
              onChange={(code) => { onPatch({ currency: code }); setPicker(null); }}
              align="start"
            />
          </div>
        )}

        <div
          data-hint={d.hint}
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '9px 11px', borderRadius: 12,
            background: HINT_STYLE[hint.tone].bg, color: HINT_STYLE[hint.tone].color, fontSize: 13, fontWeight: 500,
          }}
        >
          <span aria-hidden style={{ flex: 'none', marginTop: 1 }}>{HINT_STYLE[hint.tone].mark}</span>
          <span>{hint.text}</span>
        </div>

        <button
          type="button"
          onClick={() => setShowOrig((v) => !v)}
          aria-expanded={showOrig}
          style={{ marginTop: 10, border: 'none', background: 'none', padding: 0, color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}
        >
          {showOrig ? '▾' : '▸'} {t(showOrig ? 'inbox.hideOriginal' : 'inbox.showOriginal')}
        </button>
        {showOrig && (
          <div
            style={{
              marginTop: 6, padding: '10px 12px', borderRadius: 12, background: 'var(--surface)',
              font: '12px/1.45 ui-monospace, Menlo, monospace', color: 'var(--text-muted)', wordBreak: 'break-word',
            }}
          >
            {d.entry.text}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 8, marginTop: 14 }}>
        <button
          type="button"
          onClick={props.onDiscard}
          disabled={props.busy}
          aria-keyshortcuts={props.desktop ? 'Backspace' : undefined}
          style={{
            height: 50, borderRadius: 14, border: '1px solid var(--line-strong)', background: 'none',
            fontWeight: 600, fontSize: 15, cursor: 'pointer', color: 'var(--text-muted)',
          }}
        >
          {t('inbox.discard')}
        </button>
        <button
          ref={acceptRef}
          type="button"
          onClick={props.onAccept}
          disabled={!canAccept}
          aria-keyshortcuts={props.desktop ? 'Enter' : undefined}
          style={{
            height: 50, borderRadius: 14, border: 'none', fontWeight: 700, fontSize: 15,
            cursor: canAccept ? 'pointer' : 'not-allowed',
            background: canAccept ? 'var(--q10)' : 'var(--surface-sunken)',
            color: canAccept ? 'var(--on-accent)' : 'var(--text-dim)',
          }}
        >
          {t(d.status === 'pending' ? 'inbox.schedule' : 'inbox.record')}
        </button>
      </div>
      {props.bulkCount >= 2 && (
        <button
          type="button"
          onClick={props.onAcceptAll}
          disabled={props.busy}
          style={{
            width: '100%', marginTop: 6, height: 40, border: 'none', background: 'none',
            color: 'var(--q10-text)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}
        >
          {fill(t('inbox.recordAllComplete'), { n: props.bulkCount })}
        </button>
      )}
    </>
  );
}

function AllDone({ recorded, discarded, onClose }: { recorded: number; discarded: number; onClose: () => void }) {
  const t = useT();
  return (
    <div style={{ textAlign: 'center', padding: '26px 0 8px' }}>
      <span
        aria-hidden
        style={{
          width: 56, height: 56, borderRadius: 28, display: 'inline-grid', placeItems: 'center',
          background: 'color-mix(in srgb, var(--positive) 14%, transparent)', color: 'var(--positive)',
        }}
      >
        <IconCheck size={26} stroke={2.6} />
      </span>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '12px 0 0' }}>{t('inbox.allReviewed')}</h2>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
        {fill(t('inbox.doneSummary'), { done: recorded, discarded })}
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: 20, width: '100%', height: 50, borderRadius: 14, border: 'none', background: 'var(--surface-sunken)',
          fontWeight: 600, fontSize: 15, cursor: 'pointer', color: 'var(--text)',
        }}
      >
        {t('action.close')}
      </button>
    </div>
  );
}

type Tone = 'green' | 'blue' | 'red';
const HINT_STYLE: Record<Tone, { bg: string; color: string; mark: string }> = {
  green: { bg: 'color-mix(in srgb, var(--positive) 10%, transparent)', color: 'var(--positive-text)', mark: '✓' },
  blue: { bg: 'var(--q10-soft)', color: 'var(--q10-text)', mark: '◷' },
  red: { bg: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger-text)', mark: '!' },
};

/** The coloured line under the fields: what it understood and how sure it is. */
function hintFor(d: Draft, ctx: { cat: Category | undefined; today: string; payDays: number[]; t: ReturnType<typeof useT> }): { tone: Tone; text: string } {
  const { t } = ctx;
  switch (d.hint) {
    case 'missing':
      return { tone: 'red', text: t(d.missing === 'concept' ? 'inbox.hintMissingConcept' : 'inbox.hintMissingAmount') };
    case 'typed':
      return { tone: 'green', text: t(d.originallyMissing === 'concept' ? 'inbox.hintTypedConcept' : 'inbox.hintTypedAmount') };
    case 'future':
      return { tone: 'blue', text: fill(t('inbox.hintFuture'), { date: shortDay(d.date) }) };
    case 'learned':
      if (ctx.cat) return { tone: 'green', text: fill(t('inbox.hintLearned'), { category: ctx.cat.name }) };
      break;
    default:
      break;
  }
  const period = calculatePeriod(d.date, ctx.payDays);
  const where = isMonthly(ctx.payDays)
    ? capitalize(monthName(Number(period.start.slice(5, 7))))
    : fill(t('inbox.periodPay'), { day: Number(period.start.slice(8, 10)) });
  const kind = t(d.type === 'income' ? 'inbox.kindIncome' : 'inbox.kindExpense');
  return {
    tone: 'green',
    text: d.date === ctx.today
      ? fill(t('inbox.hintOkToday'), { kind, period: where })
      : fill(t('inbox.hintOkDay'), { kind, date: shortDay(d.date), period: where }),
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', PEN: 'S/' };

/** 500000 → "500.000" (or "500,000" in dollars): the figure without its symbol. */
function groupDigits(n: number, currency: string): string {
  return formatMoney(n, currency).replace(/[^\d.,]/g, '');
}

