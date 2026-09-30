import { IconBolt, IconCheck, IconMessage, IconMicrophone, type IconProps } from '@tabler/icons-react';
import type { ComponentType, CSSProperties, PointerEvent as ReactPointerEvent, Ref, TouchEvent as ReactTouchEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { CurrencyChips } from '@/components/ui/CurrencyChips';
import { MethodPicker } from '@/components/ui/MethodPicker';
import { MiniCalendar, relativeDayLabel } from '@/components/ui/MiniCalendar';
import { monthName } from '@/components/ui/MonthNav';
import { formatMoney } from '@/domain/money/format';
import { calculatePeriod, isMonthly } from '@/domain/period/period';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import type { Category, TransactionSource } from '@/domain/types';
import { useT } from '@/i18n/language';
import { CURRENCIES, formatRate, quickCurrencyList } from '@/lib/currencies';
import { dateLabel, fill } from '@/lib/dateLabels';
import { shortDay } from '@/lib/formatShortDate';
import { ago, queueTone, type Draft } from './review';
import type { InboxReview } from './useInboxReview';

/**
 * The pieces the phone's sheet and the desktop's panel share (BANDEJA.md,
 * BANDEJA-WEB.md): the editable card, the ‹ N de M › control, the progress
 * segments and the "Todo revisado" end. They read everything from
 * useInboxReview, so both draw the same state.
 */

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

/** Swipe on the card: 50 px, clearly more sideways than down (BANDEJA-WEB.md). */
export function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const begin = (x: number, y: number) => { start.current = { x, y }; };
  const end = (x: number, y: number) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
  };
  return {
    onTouchStart: (e: ReactTouchEvent) => { const p = e.touches[0]; if (p) begin(p.clientX, p.clientY); },
    onTouchEnd: (e: ReactTouchEvent) => { const p = e.changedTouches[0]; if (p) end(p.clientX, p.clientY); },
    onPointerDown: (e: ReactPointerEvent) => { if (e.pointerType === 'mouse') begin(e.clientX, e.clientY); },
    onPointerUp: (e: ReactPointerEvent) => { if (e.pointerType === 'mouse') end(e.clientX, e.clientY); },
  };
}

/** ‹ 2 de 4 › — moving without deciding. The arrows go grey at the ends. */
export function NavPill({ review, radius = 15 }: { review: InboxReview; radius?: number }) {
  const t = useT();
  const { idx, items } = review;
  const canPrev = idx > 0;
  const canNext = idx < items.length - 1;
  const arrow = (enabled: boolean): CSSProperties => ({
    width: 28, height: 28, borderRadius: 14, border: 'none', background: 'none', fontSize: 17,
    cursor: enabled ? 'pointer' : 'default', color: enabled ? 'var(--text)' : 'var(--handle)', padding: 0,
  });
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--paper)', borderRadius: radius, padding: 2 }}>
      <button type="button" onClick={() => review.move(-1)} disabled={!canPrev} aria-label={t('inbox.prev')} aria-keyshortcuts="ArrowUp" style={arrow(canPrev)}>‹</button>
      <span className="figures" style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, minWidth: 44, textAlign: 'center' }}>
        {fill(t('inbox.position'), { n: idx + 1, total: items.length })}
      </span>
      <button type="button" onClick={() => review.move(1)} disabled={!canNext} aria-label={t('inbox.next')} aria-keyshortcuts="ArrowDown" style={arrow(canNext)}>›</button>
    </span>
  );
}

/**
 * The progress bar, one segment per entry: the resolved ones first in
 * --q10, then the waiting ones — the current one in --text, one missing
 * something in --danger at 55%. The waiting ones can be tapped to jump.
 */
export function Segments({ review }: { review: InboxReview }) {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('inbox.progress')}
      style={{ display: 'flex', gap: 4, margin: '6px 0 10px' }}
    >
      {Array.from({ length: review.doneCount }, (_, i) => (
        <span key={`done-${i}`} aria-hidden style={{ flex: 1, padding: '6px 0' }}>
          <span style={{ display: 'block', height: 4, borderRadius: 2, background: 'var(--q10)' }} />
        </span>
      ))}
      {review.items.map((d, i) => {
        const on = i === review.idx;
        const color = on ? 'var(--text)'
          : queueTone(d) === 'missing' ? 'color-mix(in srgb, var(--danger) 55%, transparent)'
          : 'var(--handle)';
        return (
          <button
            key={d.entry.id}
            type="button"
            onClick={() => review.goTo(i)}
            aria-label={fill(t('inbox.position'), { n: i + 1, total: review.items.length })}
            aria-current={on ? 'step' : undefined}
            style={{ flex: 1, height: 16, border: 'none', background: 'none', padding: '6px 0', cursor: 'pointer' }}
          >
            <span style={{ display: 'block', height: 4, borderRadius: 2, background: color }} />
          </button>
        );
      })}
    </div>
  );
}

type Picker = 'category' | 'method' | 'date' | 'currency' | null;

/**
 * The editable card (paper): source, expense/income, the big amount, the
 * concept, the chips that open the §9b selectors, the coloured hint and the
 * original message (folded on the phone, always open on desktop).
 */
export function InboxFields({ review, d, originalAlwaysOpen = false, amountRef, padding = 16, swipe }: {
  review: InboxReview;
  d: Draft;
  originalAlwaysOpen?: boolean;
  amountRef?: Ref<HTMLInputElement>;
  padding?: number;
  swipe?: ReturnType<typeof useSwipe>;
}) {
  const t = useT();
  const sourceLine = useSourceLine();
  const { fx, mainCurrency, categories, methods, today } = review;
  const [picker, setPicker] = useState<Picker>(null);
  const [showOrig, setShowOrig] = useState(false);
  // A different entry starts with everything folded.
  useEffect(() => { setPicker(null); setShowOrig(false); }, [d.entry.id]);

  const SourceIcon = SOURCE_ICON[d.source];
  const income = d.type === 'income';
  const cat = categories.find((c) => c.id === d.categoryId);
  const method = methods.find((m) => m.id === d.paymentMethodId);
  const visibleCats = categories.filter((c) => !c.isArchived && (c.kind === 'both' || c.kind === d.type));
  const flag = CURRENCIES.find((c) => c.code === d.currency)?.flag ?? '';
  const foreign = d.currency !== mainCurrency;
  const dayWord = d.date === today ? `${t('date.today')}, ${shortDay(d.date)}` : relativeDayLabel(d.date, today, t);
  const toggle = (p: Exclude<Picker, null>) => setPicker((cur) => (cur === p ? null : p));
  const hint = hintFor(d, { cat, today, payDays: review.payDays, t });
  const onPatch = review.patch;

  const chip: CSSProperties = {
    height: 32, padding: '0 11px', borderRadius: 16, border: '1px solid var(--line-strong)',
    background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap',
  };
  const open = (p: Picker): CSSProperties => (picker === p ? { borderColor: 'var(--q10)', background: 'var(--q10-soft)' } : {});

  return (
    <div {...swipe} data-testid="inbox-card" style={{ background: 'var(--paper)', borderRadius: 20, padding, touchAction: 'pan-y' }}>
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
            quick={quickCurrencyList(mainCurrency, review.quickCurrencies)}
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

      {originalAlwaysOpen ? (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)' }}>{t('inbox.originalMessage')}</div>
      ) : (
        <button
          type="button"
          onClick={() => setShowOrig((v) => !v)}
          aria-expanded={showOrig}
          style={{ marginTop: 10, border: 'none', background: 'none', padding: 0, color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}
        >
          {showOrig ? '▾' : '▸'} {t(showOrig ? 'inbox.hideOriginal' : 'inbox.showOriginal')}
        </button>
      )}
      {(originalAlwaysOpen || showOrig) && (
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
  );
}

/** "Todo revisado · N anotados · M descartados". */
export function AllDone({ review, compact = false }: { review: InboxReview; compact?: boolean }) {
  const t = useT();
  return (
    <div style={{ textAlign: 'center', padding: compact ? '80px 22px 0' : '26px 0 8px' }}>
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
        {fill(t('inbox.doneSummary'), { done: review.recorded, discarded: review.discarded })}
      </div>
      <button
        type="button"
        onClick={review.close}
        style={{
          marginTop: 20, width: compact ? 'auto' : '100%', height: compact ? 44 : 50, padding: compact ? '0 28px' : 0,
          borderRadius: compact ? 12 : 14, border: 'none', background: 'var(--surface-sunken)',
          fontWeight: 600, fontSize: compact ? 14 : 15, cursor: 'pointer', color: 'var(--text)',
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
