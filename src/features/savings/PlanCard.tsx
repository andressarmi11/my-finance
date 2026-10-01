import { useState, type CSSProperties } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { showToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { localRepository } from '@/data/local/localRepository';
import { deletePlan, endPlan, renewPlan, useActivePlan } from '@/data/local/savingsPlans';
import { formatMoney } from '@/domain/money/format';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { planProgress } from '@/domain/savings/progress';
import type { SavingsPlan } from '@/domain/types';
import type { Range } from '@/features/analytics/periodAggregate';
import { useLanguage } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import { fill } from '@/lib/dateLabels';
import { EMPTY } from '@/lib/empty';
import { todayISO } from '@/lib/todayISO';
import { DeleteConfirm, Sparkle } from './HelpMeSaveScreen';
import { fullDate, short } from './text';

const PERIOD_NAME: Record<Range, TextKey> = { quincena: 'save.periodQ', mes: 'save.periodM', trimestre: 'save.periodT', año: 'save.periodY' };
const THIS_PERIOD: Record<Range, TextKey> = { quincena: 'save.thisQ', mes: 'save.thisM', trimestre: 'save.thisT', año: 'save.thisY' };

const greenCard: CSSProperties = {
  background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--positive) 30%, var(--line))', borderRadius: 20,
};

/** "Ayúdame a ahorrar" in Análisis: the way in, or the active plan read against the period on screen. */
export function PlanCard({ range, from, to, desktop = false }: { range: Range; from: string; to: string; desktop?: boolean }) {
  const active = useActivePlan();
  const today = todayISO();
  if (active === undefined) return null;
  if (!active) return <PlanEntry desktop={desktop} />;
  if (active.endDate < today) return <PlanEnded plan={active} desktop={desktop} />;
  return <ActivePlan plan={active} range={range} from={from} to={to} desktop={desktop} />;
}

function SparkleTile({ size }: { size: number }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: size * 0.29, flex: 'none', display: 'grid', placeItems: 'center',
      background: 'color-mix(in srgb, var(--positive) 16%, var(--surface))', color: 'var(--positive-text)',
    }}>
      <Sparkle size={Math.round(size * 0.52)} />
    </span>
  );
}

function PlanEntry({ desktop }: { desktop: boolean }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const open = () => navigate('/analisis/ahorrar');
  if (desktop) {
    return (
      <section aria-label={t('save.title')} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, display: 'flex', alignItems: 'center', gap: 20 }}>
        <SparkleTile size={56} />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 20 }}>{t('save.title')}</span>
          <span style={{ display: 'block', fontSize: 14, color: 'var(--text-muted)', marginTop: 3 }}>{t('save.entrySub')}</span>
        </span>
        <button type="button" onClick={open} style={{ height: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: 'var(--positive)', color: 'var(--paper)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          {t('save.seeMyPlan')}
        </button>
      </section>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      style={{
        width: '100%', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 20,
        border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
      }}
    >
      <SparkleTile size={40} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>{t('save.title')}</span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>{t('save.entrySub')}</span>
      </span>
      <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: 20 }}>›</span>
    </button>
  );
}

/** The plan's end date passed: renew it for as long, or end it (budgets back to before). */
function PlanEnded({ plan, desktop }: { plan: SavingsPlan; desktop: boolean }) {
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }
  return (
    <section aria-label={t('save.endedTitle')} style={{ ...greenCard, padding: desktop ? 24 : 16, margin: desktop ? 0 : '0 0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SparkleTile size={32} />
        <span style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>{t('save.endedTitle')}</span>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {fill(t('save.endedBody'), { date: fullDate(plan.endDate, language) })}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(async () => {
            const renewed = await renewPlan(plan);
            showToast(fill(t('save.renewed'), { date: fullDate(renewed.endDate, language) }));
          })}
          style={{ height: 42, borderRadius: 12, border: 'none', background: 'var(--positive)', color: 'var(--paper)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          {t('save.renew')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(async () => { await endPlan(plan); showToast(t('save.ended')); })}
          style={{ height: 42, borderRadius: 12, border: '1px solid var(--line-strong)', background: 'none', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          {t('save.end')}
        </button>
      </div>
    </section>
  );
}

function ActivePlan({ plan, range, from, to, desktop }: { plan: SavingsPlan; range: Range; from: string; to: string; desktop: boolean }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const today = todayISO();
  const p = planProgress({ plan, from, to, isPayPeriod: range === 'quincena', today, transactions });
  const period = t(THIS_PERIOD[range]);
  const title = fill(t('save.planOf'), { period: t(PERIOD_NAME[range]) });
  const windowTxt = `${fullDate(plan.startDate, language)} → ${fullDate(plan.endDate, language)}`;
  const and = t('save.and');

  let body: React.ReactNode;
  if (!p.covers) {
    body = (
      <div style={{ marginTop: desktop ? 16 : 12, padding: desktop ? 14 : 12, borderRadius: 12, background: 'var(--paper)', fontSize: desktop ? 14 : 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {p.reason === 'notStarted'
          ? fill(t('save.planStartsLater'), { date: fullDate(plan.startDate, language), period })
          : fill(t('save.planEnded'), { period })}
      </div>
    );
  } else {
    const rows = p.rows.map((r) => {
      const cat = byId.get(r.categoryId);
      return {
        ...r, name: cat?.name ?? r.categoryId, icon: cat?.icon ?? 'other', color: cat ? categoryColor(cat) : UNCATEGORIZED_COLOR,
      };
    });
    const exceeded = rows.filter((r) => r.exceeded).map((r) => r.name);
    const ahead = rows.filter((r) => r.ahead && !r.exceeded).map((r) => r.name);
    const note = !p.started
      ? fill(t('save.notStartedNote'), { date: fullDate(plan.startDate, language) })
      : exceeded.length
        ? fill(t('save.paceExceeded'), { names: exceeded.join(and) }) + (ahead.length ? fill(t('save.paceAheadShort'), { names: ahead.join(and) }) : '')
        : ahead.length ? fill(t('save.paceAhead'), { names: ahead.join(and) }) : t('save.paceOk');
    const noteColor = exceeded.length ? 'var(--danger-text)' : ahead.length ? 'var(--q25-text, var(--q25))' : 'var(--positive-text)';
    const paceX = `calc(${(p.pace * 100).toFixed(1)}% - 1px)`;
    const months = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', language === 'en' ? '.' : ',');
    body = (<>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: desktop ? 20 : 14, fontSize: desktop ? 14 : 13, color: 'var(--text-muted)' }}>
        <span>{fill(t(p.started ? 'save.savedIn' : 'save.notYetIn'), { period })}</span>
        <span className="figures">{fill(t('save.goalOf'), { amount: formatMoney(p.goal) })}</span>
      </div>
      <div className="figures" data-testid="plan-saved" style={{ fontSize: desktop ? 40 : 28, fontWeight: 700, letterSpacing: '-.03em', color: 'var(--positive-text)', marginTop: 2 }}>
        {formatMoney(p.saved)}
      </div>
      <div
        role="progressbar"
        aria-label={fill(t(p.started ? 'save.savedIn' : 'save.notYetIn'), { period })}
        aria-valuemin={0}
        aria-valuemax={p.goal}
        aria-valuenow={Math.min(p.saved, p.goal)}
        style={{ position: 'relative', height: desktop ? 10 : 8, borderRadius: 5, background: 'var(--line)', marginTop: desktop ? 12 : 10 }}
      >
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p.goal ? Math.min(100, (p.saved / p.goal) * 100) : 0}%`, borderRadius: 5, background: 'var(--positive)' }} />
        <span aria-hidden data-testid="pace-line" style={{ position: 'absolute', top: desktop ? -4 : -3, bottom: desktop ? -4 : -3, left: paceX, width: 2, borderRadius: 1, background: 'var(--text)', opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: desktop ? 13 : 12, marginTop: desktop ? 10 : 8, color: noteColor }}>{note}</div>
      <div style={desktop
        ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)' }
        : { marginTop: 14, paddingTop: 4, borderTop: '1px solid var(--line)' }}
      >
        {rows.map((r) => {
          const w = r.top ? Math.min(100, (r.spent / r.top) * 100) : 0;
          const bar = r.exceeded ? 'var(--danger)' : r.ahead ? 'var(--q25)' : r.color;
          const txtColor = r.exceeded ? 'var(--danger-text)' : r.ahead ? 'var(--q25-text, var(--q25))' : 'var(--text-muted)';
          return (
            <div key={r.categoryId} data-testid={`plan-row-${r.categoryId}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <CategoryAvatar icon={r.icon} color={r.color} size={desktop ? 30 : 28} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span className="figures" style={{ color: txtColor }}>{fill(t('save.categorySpent'), { spent: short(r.spent), top: short(r.top) })}</span>
                </span>
                <span style={{ display: 'block', position: 'relative', height: 5, borderRadius: 3, background: 'var(--line)', marginTop: 6 }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w.toFixed(1)}%`, borderRadius: 3, background: bar }} />
                  <span aria-hidden style={{ position: 'absolute', top: -2, bottom: -2, left: paceX, width: 2, background: 'var(--text)', opacity: 0.45 }} />
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {(range === 'año' || range === 'trimestre') && (
        <div style={{ marginTop: desktop ? 12 : 8, padding: desktop ? '12px 14px' : '10px 12px', borderRadius: 12, background: 'var(--paper)', fontSize: desktop ? 14 : 13 }}>
          {range === 'año'
            ? fill(t('save.projection'), { amount: formatMoney(p.projection), n: months(p.monthsToDecember) })
            : fill(t('save.quarterCover'), { n: months(p.planMonths) })}
        </div>
      )}
    </>);
  }

  return (
    <section aria-label={title} data-testid="plan-card" style={{ ...greenCard, padding: desktop ? 24 : 16, margin: desktop ? 0 : '0 0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: desktop ? 12 : 10 }}>
        <SparkleTile size={desktop ? 38 : 32} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: desktop ? 18 : 16 }}>{title}</span>
          <span className="figures" style={{ display: 'block', fontSize: desktop ? 13 : 12, color: 'var(--text-muted)' }}>{windowTxt}</span>
        </span>
        {desktop ? (<>
          <button type="button" onClick={() => navigate('/analisis/ahorrar')} style={outlined('var(--q10-text)')}>{t('save.adjust')}</button>
          <button type="button" onClick={() => setConfirming(true)} style={outlined('var(--danger-text)')}>{t('save.delete')}</button>
        </>) : (
          <button type="button" onClick={() => navigate('/analisis/ahorrar')} style={{ border: 'none', background: 'none', color: 'var(--q10-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}>
            {t('save.adjust')}
          </button>
        )}
      </div>
      {body}
      {confirming && (
        <DeleteConfirm
          onCancel={() => setConfirming(false)}
          onConfirm={() => void deletePlan(plan).then(() => { setConfirming(false); showToast(t('save.deleted')); })}
        />
      )}
    </section>
  );
}

function outlined(color: string): CSSProperties {
  return { height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'none', color, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
}
