import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBreakpoint } from '@/app/useBreakpoint';
import { CategoryAvatar, CategoryIcon } from '@/components/ui/CategoryIcon';
import { showToast } from '@/components/ui/Toast';
import { useDialogo } from '@/components/ui/useDialogo';
import { deletePlan, savePlan } from '@/data/local/savingsPlans';
import { formatMoney } from '@/domain/money/format';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import type { CategoryPlan } from '@/domain/savings/types';
import type { Category, SavingsIntensity, SavingsPlan, SavingsPlanUnit } from '@/domain/types';
import { Switch } from '@/features/settings/ui';
import { useLanguage } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import { fill } from '@/lib/dateLabels';
import { durationText, fullDate, monthYear, reasonText, short } from './text';
import { usePlanDraft, type PlanDraftState, type StartOption } from './usePlanDraft';

type Step = 'main' | 'custom' | 'done';
type T = (k: TextKey) => string;

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20 };
const sectionLabel: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-faint)', margin: '22px 4px 8px' };
const sparkle = 'M12 3l1.9 5.1l5.1 1.9l-5.1 1.9l-1.9 5.1l-1.9 -5.1l-5.1 -1.9l5.1 -1.9z M19 15l.8 2.2l2.2 .8l-2.2 .8l-.8 2.2l-.8 -2.2l-2.2 -.8l2.2 -.8z';

export function Sparkle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={sparkle} />
    </svg>
  );
}

/**
 * "Ayúdame a ahorrar" (PRESUPUESTOS-Y-AHORRO.md, part B; prototype 1a and
 * 3a). Three steps on the phone — Tu plan, Personalizar, Listo — as a full
 * screen coming in from the right, over the tab bar. On desktop, a page
 * inside Análisis: the plan on the left and "Personalizar" always open on
 * the right. Nothing is applied until the user confirms.
 */
export function HelpMeSaveScreen() {
  const desktop = useBreakpoint() === 'desktop';
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromBudgets = params.get('desde') === 'presupuestos';
  const d = usePlanDraft();
  const [step, setStep] = useState<Step>('main');
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState<SavingsPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const backTo = fromBudgets ? '/ajustes/presupuestos' : '/analisis';
  const close = () => navigate(backTo);

  async function create() {
    if (busy || d.plan.total <= 0) return;
    setBusy(true);
    try {
      const plan = await savePlan(d.draft);
      if (desktop) navigate('/analisis');
      else { setSaved(plan); setStep('done'); }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!d.active) return;
    await deletePlan(d.active);
    setConfirming(false);
    showToast(t('save.deleted'));
    navigate(backTo);
  }

  const deleteDialog = confirming && <DeleteConfirm onCancel={() => setConfirming(false)} onConfirm={() => void remove()} />;

  if (desktop) {
    return (
      <div>
        <button type="button" onClick={close} style={linkButton}>‹ {t(fromBudgets ? 'save.backBudgets' : 'save.backAnalysis')}</button>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, flex: 1, fontSize: 32, fontWeight: 700, letterSpacing: '-.025em' }}>{t('save.title')}</h1>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{basedOn(t, d.plan.historyMonths)}</span>
        </div>
        {!d.loading && !d.plan.enoughHistory ? <NotEnough /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 420px', gap: 24, marginTop: 22, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...card, padding: 24, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 28, alignItems: 'center' }}>
                <div>
                  <Hero d={d} desktop />
                  <div style={{ fontSize: 13, marginTop: 10, color: 'var(--text-muted)' }}>
                    {fill(t('save.startsEnds'), { start: fullDate(d.startDate, language), end: fullDate(d.endDate, language) })}
                  </div>
                </div>
                <Distribution d={d} desktop />
              </div>
              {d.plan.over && <Warn d={d} />}
              <section aria-label={t('save.whereToCut')} style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 6px', fontWeight: 700, fontSize: 16 }}>{t('save.whereToCut')}</div>
                {cutsOf(d).map((c) => <CutRowDesktop key={c.categoryId} c={c} d={d} />)}
                {cutsOf(d).length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>{t('save.noCuts')}</div>}
                <NotTouched d={d} style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', margin: 0 }} />
              </section>
            </div>
            <aside aria-label={t('save.customize')} style={{ ...card, padding: 20, position: 'sticky', top: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{t('save.customize')}</div>
              <Customize d={d} compact />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t(d.mode === 'goal' ? 'save.footGoal' : 'save.footMonthly')}</span>
                <span className="figures" style={{ fontSize: 20, fontWeight: 700, color: 'var(--positive-text)' }}>{formatMoney(d.plan.total)}</span>
              </div>
              <Cta d={d} onClick={() => void create()} style={{ marginTop: 12, width: '100%', height: 48, fontSize: 15 }} />
              {d.active && (
                <button type="button" onClick={() => setConfirming(true)} style={{ ...dangerLink, marginTop: 6, width: '100%', height: 38 }}>{t('save.delete')}</button>
              )}
            </aside>
          </div>
        )}
        {deleteDialog}
      </div>
    );
  }

  // Phone: a full screen over the tab bar.
  const backLabel = step === 'custom' ? t('save.backPlan') : t(fromBudgets ? 'save.backBudgets' : 'save.backAnalysis');
  const stepLabel = t(step === 'main' ? 'save.step1' : step === 'custom' ? 'save.step2' : 'save.step3');
  const top = () => document.getElementById('plan-scroll')?.scrollTo({ top: 0 });
  const go = (s: Step) => { setStep(s); requestAnimationFrame(top); };

  return (
    <div
      role="region"
      aria-label={t('save.title')}
      style={{
        position: 'fixed', inset: 0, zIndex: 45, background: 'var(--paper)',
        animation: 'slideInRight .38s var(--ease-spring-out)',
      }}
    >
      <div id="plan-scroll" className="noscroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 'calc(var(--safe-top) + 12px) 20px 230px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
          <button type="button" onClick={() => (step === 'custom' ? go('main') : close())} style={linkButton}>
            <span aria-hidden style={{ fontSize: 24, lineHeight: 1 }}>‹</span>{backLabel}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>{stepLabel}</span>
        </div>

        {step === 'main' && (<>
          <h1 style={titleStyle}>{t('save.title')}</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{basedOn(t, d.plan.historyMonths)}</p>
          {!d.loading && !d.plan.enoughHistory ? <NotEnough /> : (<>
            <div style={{ textAlign: 'center', padding: '26px 0 18px' }}>
              <Hero d={d} />
              <button
                type="button"
                onClick={() => go('custom')}
                style={{
                  marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 15,
                  border: '1px solid var(--line-strong)', background: 'var(--surface)', fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
                }}
              >
                {fill(t('save.startsPill'), { date: fullDate(d.startDate, language) })}
                <span style={{ color: 'var(--q10-text)' }}>{t('save.change')}</span>
              </button>
            </div>
            {d.plan.over && <Warn d={d} />}
            <div style={{ ...card, padding: 16 }}><Distribution d={d} /></div>
            <div style={sectionLabel}>{t('save.whereToCut')}</div>
            <div role="list" aria-label={t('save.whereToCut')} style={{ ...card, overflow: 'hidden' }}>
              {cutsOf(d).map((c, i) => <CutRow key={c.categoryId} c={c} d={d} first={i === 0} />)}
              {cutsOf(d).length === 0 && <div style={{ padding: 18, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>{t('save.noCuts')}</div>}
            </div>
            <NotTouched d={d} />
          </>)}
        </>)}

        {step === 'custom' && (<>
          <h1 style={titleStyle}>{t('save.customizeTitle')}</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{t('save.recalcs')}</p>
          <Customize d={d} />
        </>)}

        {step === 'done' && saved && <Done plan={saved} d={d} />}
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 20px calc(var(--safe-bottom) + 24px)',
        background: 'linear-gradient(transparent, var(--paper) 26%)', display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {step === 'main' && d.plan.enoughHistory && (<>
          <Cta d={d} onClick={() => void create()} style={{ height: 52, fontSize: 16 }} />
          <button type="button" onClick={() => go('custom')} style={secondaryButton}>{t('save.customize')}</button>
          {d.active && <button type="button" onClick={() => setConfirming(true)} style={{ ...dangerLink, height: 36 }}>{t('save.delete')}</button>}
        </>)}
        {step === 'main' && !d.plan.enoughHistory && !d.loading && (
          <button type="button" onClick={close} style={secondaryButton}>{backLabel}</button>
        )}
        {step === 'custom' && (<>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px', fontSize: 14 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t(d.mode === 'goal' ? 'save.footGoal' : 'save.footMonthly')}</span>
            <span className="figures" data-testid="plan-foot-amount" style={{ fontWeight: 700, color: 'var(--positive-text)' }}>{formatMoney(d.plan.total)}</span>
          </div>
          <button type="button" onClick={() => go('main')} style={primaryButton}>{t('save.seePlan')}</button>
        </>)}
        {step === 'done' && (<>
          <button type="button" onClick={() => navigate('/ajustes/presupuestos')} style={primaryButton}>{t('save.seeBudgets')}</button>
          <button type="button" onClick={() => navigate('/analisis')} style={secondaryButton}>{t('save.backToAnalysis')}</button>
        </>)}
      </div>
      {deleteDialog}
    </div>
  );
}

const linkButton: CSSProperties = {
  border: 'none', background: 'none', color: 'var(--q10-text)', fontSize: 16, fontWeight: 500, cursor: 'pointer', padding: 0,
  display: 'flex', alignItems: 'center', gap: 4,
};
const titleStyle: CSSProperties = { margin: '4px 0 4px', fontSize: 30, fontWeight: 700, letterSpacing: '-.025em' };
const primaryButton: CSSProperties = {
  height: 52, borderRadius: 16, border: 'none', background: 'var(--q10)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 16, cursor: 'pointer',
};
const secondaryButton: CSSProperties = {
  height: 46, borderRadius: 14, border: '1px solid var(--line-strong)', background: 'var(--paper)', fontWeight: 600, fontSize: 15,
  cursor: 'pointer', color: 'var(--text)',
};
const dangerLink: CSSProperties = { border: 'none', background: 'none', color: 'var(--danger-text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' };

function basedOn(t: T, months: number): string {
  if (months <= 1) return t('save.basedOn1');
  return months >= 3 ? t('save.basedOn') : fill(t('save.basedOnN'), { n: months });
}

/** The categories the plan cuts, biggest cut first. */
function cutsOf(d: PlanDraftState): CategoryPlan[] {
  return d.plan.categories.filter((c) => c.cut > 0).sort((a, b) => b.cut - a.cut);
}

function catOf(d: PlanDraftState, id: string): { name: string; icon: string; color: string } {
  const c: Category | undefined = d.categoryById.get(id);
  return { name: c?.name ?? id, icon: c?.icon ?? 'other', color: c ? categoryColor(c) : UNCATEGORIZED_COLOR };
}

function NotEnough() {
  const { t } = useLanguage();
  return (
    <div style={{ ...card, padding: 20, marginTop: 22, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('save.notEnough')}</div>
  );
}

function Hero({ d, desktop = false }: { d: PlanDraftState; desktop?: boolean }) {
  const { t, language } = useLanguage();
  const goal = d.mode === 'goal';
  const label = goal ? fill(t('save.heroGoal'), { goal: d.goalName.trim() || t('save.yourGoal') }) : t('save.heroMonthly');
  const months = d.plan.goalMonths;
  const sub = goal && months
    ? fill(t(months === 1 ? 'save.heroSubGoal1' : 'save.heroSubGoal'), { n: months, date: monthYear(d.endDate, language) })
    : d.plan.alreadySaving > 0 ? fill(t('save.heroSubMonthly'), { saved: short(d.plan.alreadySaving) }) : t('save.heroSubMonthlyNone');
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</div>
      <div className="figures" data-testid="plan-hero-amount" style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-.035em', color: 'var(--positive-text)', marginTop: desktop ? 0 : 4 }}>
        {formatMoney(d.plan.total)}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: desktop ? 4 : 6 }}>{sub}</div>
    </div>
  );
}

function Warn({ d }: { d: PlanDraftState }) {
  const { t } = useLanguage();
  return (
    <div role="note" style={{
      display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 12, marginBottom: 12, fontSize: 13,
      background: 'color-mix(in srgb, var(--q25) 12%, transparent)', color: 'var(--q25-text, var(--q25))',
    }}>
      <span aria-hidden>!</span><span>{fill(t('save.warnOver'), { max: formatMoney(d.plan.maxCut) })}</span>
    </div>
  );
}

function Distribution({ d, desktop = false }: { d: PlanDraftState; desktop?: boolean }) {
  const { t } = useLanguage();
  const p = d.plan;
  const parts = [
    { key: 'fixed', label: t('save.distFixed'), value: p.fixedTotal, color: 'var(--cat-hogar)' },
    { key: 'daily', label: t('save.distDaily'), value: p.dailyTotal, color: 'var(--q10)' },
    { key: 'saving', label: t('save.distSaving'), value: p.alreadySaving, color: 'var(--cat-ahorro)' },
    { key: 'plan', label: t('save.distPlan'), value: p.total, color: 'var(--positive)' },
    { key: 'free', label: t('save.distFree'), value: p.free, color: 'var(--line-strong)' },
  ].filter((x) => x.value > 0);
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: desktop ? 15 : 16 }}>{t('save.howMoney')}</div>
      <div aria-hidden style={{ display: 'flex', gap: 3, height: 12, margin: desktop ? '12px 0' : '14px 0 12px' }}>
        {parts.map((x) => <span key={x.key} style={{ flex: x.value, background: x.color, borderRadius: 6, minWidth: 4 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: desktop ? '6px 14px' : '8px 12px' }}>
        {parts.map((x) => (
          <div key={x.key} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: x.color, flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.label}</span>
            <span className="figures" style={{ fontSize: 12, fontWeight: 700 }}>{short(x.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fromTo(t: T, c: CategoryPlan, weekly: boolean): string {
  const limit = c.avg - c.cut;
  return weekly
    ? fill(t('save.fromToWeekly'), { avg: short(c.avg), limit: short(limit), week: short((limit * 12) / 52) })
    : fill(t('save.fromTo'), { avg: short(c.avg), limit: short(limit) });
}

function CutRow({ c, d, first }: { c: CategoryPlan; d: PlanDraftState; first: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const cat = catOf(d, c.categoryId);
  return (
    <div role="listitem" style={{ borderTop: first ? 'none' : '1px solid var(--line)' }}>
      <button
        type="button"
        data-testid={`cut-${c.categoryId}`}
        aria-expanded={open}
        aria-label={`${cat.name}: − ${short(c.cut)}`}
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', gap: 12, padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', alignItems: 'flex-start', color: 'var(--text)' }}
      >
        <CategoryAvatar icon={cat.icon} color={cat.color} size={36} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{cat.name}</span>
            <span className="figures" style={{ fontSize: 13, fontWeight: 700, color: 'var(--positive-text)' }}>− {short(c.cut)}</span>
          </span>
          <span className="figures" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{fromTo(t, c, d.weekly)}</span>
          {open && c.reason && (
            <span style={{ display: 'block', fontSize: 13, color: 'var(--text)', marginTop: 8, lineHeight: 1.45, padding: '9px 11px', borderRadius: 10, background: 'var(--paper)' }}>
              {reasonText(t, c.reason)}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

function CutRowDesktop({ c, d }: { c: CategoryPlan; d: PlanDraftState }) {
  const { t } = useLanguage();
  const cat = catOf(d, c.categoryId);
  return (
    <div data-testid={`cut-${c.categoryId}`} style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,220px) minmax(0,1fr) 100px', gap: 14, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
      <CategoryAvatar icon={cat.icon} color={cat.color} size={36} />
      <span>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{cat.name}</span>
        <span className="figures" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{fromTo(t, c, d.weekly)}</span>
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.45 }}>{c.reason ? reasonText(t, c.reason) : ''}</span>
      <span className="figures" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--positive-text)' }}>− {short(c.cut)}</span>
    </div>
  );
}

function NotTouched({ d, style }: { d: PlanDraftState; style?: CSSProperties }) {
  const { t } = useLanguage();
  const names = d.plan.categories.filter((c) => c.fixed || c.locked).map((c) => {
    const name = catOf(d, c.categoryId).name;
    return c.fixed ? fill(t('save.fixedSuffix'), { name }) : name;
  });
  if (names.length === 0) return null;
  return (
    <div style={{ fontSize: 12, color: 'var(--text-faint)', margin: '10px 4px 0', lineHeight: 1.45, ...style }}>
      {fill(t('save.notTouched'), { list: names.join(', ') })}
    </div>
  );
}

function Cta({ d, onClick, style }: { d: PlanDraftState; onClick: () => void; style: CSSProperties }) {
  const { t } = useLanguage();
  const on = d.plan.total > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!on}
      style={{
        borderRadius: 16, border: 'none', fontWeight: 700, cursor: on ? 'pointer' : 'default',
        background: on ? 'var(--positive)' : 'var(--surface-sunken)', color: on ? 'var(--paper)' : 'var(--text-faint)', ...style,
      }}
    >
      {t(d.active ? 'save.update' : 'save.create')}
    </button>
  );
}

/** A segmented row on --paper, the prototype's `segx`. */
function Seg<V extends string>({ label, options, value, onChange, small = false }: {
  label: string; options: Array<[V, string]>; value: V | null; onChange: (v: V) => void; small?: boolean;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '1fr', background: 'var(--paper)', borderRadius: 12, padding: 3 }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            style={{
              height: 34, border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: small ? 11.5 : 13, padding: '0 2px',
              whiteSpace: 'nowrap', letterSpacing: small ? '-.01em' : undefined, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
              background: on ? 'var(--line-strong)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-faint)',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function MiniStepper({ label, text, onDec, onInc, dec = '−', inc = '+', width = 74 }: {
  label: string; text: string; onDec: () => void; onInc: () => void; dec?: string; inc?: string; width?: number;
}) {
  const { t } = useLanguage();
  const btn: CSSProperties = { width: 32, height: 32, border: 'none', borderRadius: 9, background: 'var(--surface-sunken)', cursor: 'pointer', fontSize: 18, color: 'var(--text)' };
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--paper)', borderRadius: 12, padding: 3, flex: 'none' }}>
      <button type="button" aria-label={fill(t('set.stepLess'), { label })} onClick={onDec} style={btn}>{dec}</button>
      <span aria-live="polite" aria-label={label} className="figures" style={{ minWidth: width, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{text}</span>
      <button type="button" aria-label={fill(t('set.stepMore'), { label })} onClick={onInc} style={btn}>{inc}</button>
    </span>
  );
}

function Group({ title, compact, children, hint }: { title: string; compact: boolean; children: ReactNode; hint?: string }) {
  if (compact) {
    return (
      <section aria-label={title}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-faint)', margin: '18px 0 8px' }}>{title}</div>
        {children}
      </section>
    );
  }
  return (
    <section aria-label={title}>
      <div style={sectionLabel}>{title}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-2px 4px 8px' }}>{hint}</div>}
      {children}
    </section>
  );
}

/** Personalizar: Objetivo, ¿Cuándo empieza?, Intensidad, Duración, Categorías. */
function Customize({ d, compact = false }: { d: PlanDraftState; compact?: boolean }) {
  const { t, language } = useLanguage();
  const box: CSSProperties = compact ? {} : { ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 };
  const unitNames: Record<SavingsPlanUnit, string> = { days: t('save.days'), weeks: t('save.weeks'), months: t('save.months'), year: t('save.year') };
  const startNote = d.start === 'this'
    ? fill(t('save.startNoteThis'), { date: fullDate(d.startDate, language) })
    : d.start === 'period'
      ? fill(t('save.startNotePeriod'), { date: fullDate(d.startDate, language) })
      : fill(t('save.startNoteLater'), { date: fullDate(d.startDate, language) });
  const intensityNote: Record<SavingsIntensity, TextKey> = { gentle: 'save.gentleNote', balanced: 'save.balancedNote', intense: 'save.intenseNote' };
  const goalMonths = d.plan.goalMonths;

  const objective = (
    <Group title={t('save.goalSection')} compact={compact}>
      <div style={box}>
        <Seg label={t('save.goalSection')} value={d.mode} onChange={d.setMode}
          options={[['monthly', t('save.modeMonthly')], ['goal', t('save.modeGoal')]]} />
        {d.mode === 'monthly' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: compact ? 12 : 0 }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14 }}>{t('save.wantMonthly')}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{fill(t('save.maxSensible'), { max: formatMoney(d.plan.maxCut) })}</span>
            </span>
            <MiniStepper label={t('save.wantMonthly')} text={short(d.target)} width={compact ? 84 : 74}
              onDec={() => d.setTarget(d.target - d.unitStep)} onInc={() => d.setTarget(d.target + d.unitStep)} />
          </div>
        ) : (
          <div style={{ marginTop: compact ? 12 : 0 }}>
            <div style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? 10 : 12 }}>
              <input
                value={d.goalName}
                onChange={(e) => d.setGoalName(e.target.value)}
                placeholder={t('save.goalName')}
                aria-label={t('save.goalName')}
                maxLength={80}
                style={{
                  flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box', height: 44, borderRadius: 12, border: '1px solid var(--line-strong)',
                  background: 'var(--paper)', color: 'var(--text)', fontSize: compact ? 14 : 15, padding: '0 12px', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {!compact && <span style={{ flex: 1, fontSize: 14 }}>{t('save.goalHowMuch')}</span>}
                <MiniStepper label={t('save.goalHowMuch')} text={short(d.goalAmount)} width={compact ? 84 : 74}
                  onDec={() => d.setGoalAmount(d.goalAmount - d.goalStep)} onInc={() => d.setGoalAmount(d.goalAmount + d.goalStep)} />
              </div>
            </div>
            {d.plan.total > 0 && goalMonths != null && (
              <div style={{ fontSize: compact ? 12 : 13, color: 'var(--positive-text)', marginTop: compact ? 8 : 10 }}>
                {fill(t(goalMonths === 1 ? 'save.goalEta1' : 'save.goalEta'), { amount: formatMoney(d.plan.total), n: goalMonths })}
              </div>
            )}
          </div>
        )}
      </div>
    </Group>
  );

  const startOptions: Array<[StartOption, string]> = [
    ['this', t('save.startThis')], ['period', t('save.startPeriod')], ['next', t('save.startNext')], ['other', t('save.startOther')],
  ];
  const whenStarts = (
    <Group title={t('save.whenStarts')} compact={compact}>
      <div style={box}>
        <Seg label={t('save.whenStarts')} value={d.start === 'keep' ? null : d.start} onChange={d.setStart} options={startOptions} small />
        {d.start === 'other' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: compact ? 10 : 0 }}>
            <span style={{ fontSize: 14 }}>{t('save.startMonth')}</span>
            <MiniStepper label={t('save.startMonth')} text={monthYear(d.startDate, language)} dec="‹" inc="›" width={84}
              onDec={() => d.setStartOffset(d.startOffset - 1)} onInc={() => d.setStartOffset(d.startOffset + 1)} />
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginTop: compact ? 8 : 0 }}>{startNote}</div>
      </div>
    </Group>
  );

  const intensity = (
    <Group title={t('save.intensity')} compact={compact}>
      <div style={compact ? {} : { ...card, padding: 14 }}>
        <Seg label={t('save.intensity')} value={d.intensity} onChange={d.setIntensity}
          options={[['gentle', t('save.gentle')], ['balanced', t('save.balanced')], ['intense', t('save.intense')]]} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: compact ? 8 : 10, lineHeight: 1.45 }}>{t(intensityNote[d.intensity])}</div>
      </div>
    </Group>
  );

  const duration = (
    <Group title={t('save.duration')} compact={compact}>
      <div style={box}>
        {d.mode === 'goal' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: compact ? 10 : 0 }}>
            <span style={{ flex: 1, fontSize: 14 }}>{t('save.untilGoal')}</span>
            <Switch on={d.untilGoal} onChange={d.setUntilGoal} label={t('save.untilGoal')} />
          </div>
        )}
        {!d.byGoal && (
          <div style={compact ? { display: 'flex', gap: 10, alignItems: 'center' } : {}}>
            <div style={{ flex: 1 }}>
              <Seg label={t('save.duration')} value={d.unit} onChange={d.setUnit} small={compact}
                options={(['days', 'weeks', 'months', 'year'] as const).map((u) => [u, unitNames[u]])} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: compact ? 0 : 12 }}>
              {!compact && <span style={{ flex: 1, fontSize: 14 }}>{t('save.howMany')}</span>}
              <MiniStepper label={t('save.howMany')} text={durationText(t, d.unit, d.n)} width={compact ? 84 : 74}
                onDec={() => d.setN(d.n - 1)} onInc={() => d.setN(d.n + 1)} />
            </div>
          </div>
        )}
        <div style={{ fontSize: compact ? 12 : 13, color: 'var(--text-muted)', marginTop: compact ? 8 : 0 }}>
          {fill(t('save.startsAndEnds'), { start: fullDate(d.startDate, language), end: fullDate(d.endDate, language) })}
          {d.weekly ? t('save.weeklyNote') : ''}
        </div>
      </div>
    </Group>
  );

  const cats = d.plan.categories;
  const state = (c: CategoryPlan) => (c.fixed ? t('save.fixed') : c.locked ? t('save.dontTouch') : t('save.adjustable'));
  const categories = (
    <Group title={t('save.categories')} compact={compact} hint={t('save.categoriesHint')}>
      {compact ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {cats.map((c) => {
            const cat = catOf(d, c.categoryId);
            const off = c.fixed || c.locked;
            return (
              <button
                key={c.categoryId}
                type="button"
                aria-pressed={!off}
                disabled={c.fixed}
                title={subOf(t, c)}
                aria-label={fill(t('save.catToggle'), { name: cat.name, state: state(c) })}
                onClick={() => d.toggleLocked(c.categoryId)}
                style={{
                  height: 32, padding: '0 11px 0 8px', borderRadius: 16, border: '1px solid var(--line-strong)', cursor: c.fixed ? 'default' : 'pointer',
                  background: off ? 'var(--surface-sunken)' : 'color-mix(in srgb, var(--positive) 14%, transparent)',
                  color: off ? 'var(--text-muted)' : 'var(--positive-text)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                }}
              >
                <span aria-hidden style={{ display: 'flex', color: cat.color }}><CategoryIcon icon={cat.icon} size={14} /></span>
                {cat.name} · {state(c)}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {cats.map((c, i) => {
            const cat = catOf(d, c.categoryId);
            const off = c.fixed || c.locked;
            return (
              <button
                key={c.categoryId}
                type="button"
                disabled={c.fixed}
                aria-pressed={!off}
                aria-label={fill(t('save.catToggle'), { name: cat.name, state: state(c) })}
                onClick={() => d.toggleLocked(c.categoryId)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', background: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid var(--line)', cursor: c.fixed ? 'default' : 'pointer', textAlign: 'left', color: 'var(--text)',
                }}
              >
                <CategoryAvatar icon={cat.icon} color={cat.color} size={36} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{cat.name}</span>
                  <span className="figures" style={{ display: 'block', fontSize: 12, color: c.fixed ? 'var(--text-faint)' : 'var(--text-muted)' }}>{subOf(t, c)}</span>
                </span>
                <span style={{
                  display: 'flex', alignItems: 'center', height: 30, padding: '0 11px', borderRadius: 15, fontSize: 12, fontWeight: 700, flex: 'none',
                  background: off ? 'var(--surface-sunken)' : 'color-mix(in srgb, var(--positive) 14%, transparent)',
                  color: off ? 'var(--text-muted)' : 'var(--positive-text)',
                }}>
                  {state(c)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Group>
  );

  // Desktop panel order (3a): Objetivo, ¿Cuándo empieza?, Intensidad, Duración, Categorías.
  // Phone (1a): Objetivo, Intensidad, ¿Cuándo empieza?, Duración, Categorías.
  return compact
    ? <>{objective}{whenStarts}{intensity}{duration}{categories}</>
    : <>{objective}{intensity}{whenStarts}{duration}{categories}</>;
}

function subOf(t: T, c: CategoryPlan): string {
  if (c.fixed) return t('save.catFixedSub');
  if (c.locked || c.cap <= 0) return fill(t('save.catAvg'), { avg: short(c.avg) });
  return fill(t('save.catCanDrop'), { avg: short(c.avg), cap: short(c.cap) });
}

/** Paso 3: what was created. */
function Done({ plan, d }: { plan: SavingsPlan; d: PlanDraftState }) {
  const { t, language } = useLanguage();
  const end = fullDate(plan.endDate, language);
  const months = Math.max(1, d.plan.goalMonths ?? 1);
  const sub = plan.mode === 'goal'
    ? fill(t('save.doneSubGoal'), { goal: plan.goalName || t('save.yourGoal'), amount: formatMoney(plan.goalAmount ?? 0), end })
    : fill(t('save.doneSubMonthly'), {
      amount: formatMoney(plan.monthlyTarget),
      period: plan.untilGoal ? fill(t('save.untilGoalMonths'), { n: months }) : durationText(t, plan.unit, plan.n),
      end,
    });
  const goalCat = plan.goalCategoryId ? catOf(d, plan.goalCategoryId) : null;
  const rows = [
    ...plan.cuts.map((c) => ({ ...catOf(d, c.categoryId), kind: 'limit' as const, amount: c.limit, id: c.categoryId })),
    ...(goalCat ? [{ ...goalCat, name: plan.mode === 'goal' && plan.goalName ? plan.goalName : goalCat.name, kind: 'goal' as const, amount: plan.mode === 'goal' && plan.goalAmount ? plan.goalAmount : plan.goalMonthly, id: 'goal' }] : []),
  ];
  return (
    <div>
      <div style={{ textAlign: 'center', padding: '30px 0 8px' }}>
        <span style={{
          width: 64, height: 64, borderRadius: 32, display: 'inline-grid', placeItems: 'center',
          background: 'color-mix(in srgb, var(--positive) 16%, transparent)', color: 'var(--positive-text)',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5l10 -10" /></svg>
        </span>
        <h1 style={{ margin: '14px 0 4px', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>{t('save.doneTitle')}</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{sub}</p>
      </div>
      <div style={{ ...card, overflow: 'hidden', marginTop: 18 }}>
        {rows.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
            <CategoryAvatar icon={r.icon} color={r.color} size={36} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{r.name}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
              background: r.kind === 'goal' ? 'color-mix(in srgb, var(--positive) 16%, transparent)' : 'var(--surface-sunken)',
              color: r.kind === 'goal' ? 'var(--positive-text)' : 'var(--text)',
            }}>
              {t(r.kind === 'goal' ? 'budgets.goal' : 'budgets.limit')}
            </span>
            <span className="figures" style={{ fontWeight: 700, fontSize: 14, width: 70, textAlign: 'right' }}>{short(r.amount)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', margin: '10px 4px 0', lineHeight: 1.45 }}>{t('save.doneNote')}</div>
    </div>
  );
}

export function DeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useLanguage();
  const ref = useDialogo(onCancel);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t('save.deleteQuestion')}
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'color-mix(in srgb, black 55%, transparent)', display: 'grid', placeItems: 'center', padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 22, padding: 22, textAlign: 'center' }}>
        <span style={{ width: 52, height: 52, borderRadius: 26, display: 'inline-grid', placeItems: 'center', background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger-text)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 7l16 0 M10 11l0 6 M14 11l0 6 M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12 M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
          </svg>
        </span>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: '10px 0 0' }}>{t('save.deleteQuestion')}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.45 }}>{t('save.deleteBody')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onCancel} style={{ height: 46, borderRadius: 14, border: '1px solid var(--line-strong)', background: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: 'var(--text)' }}>
            {t('action.cancel')}
          </button>
          <button type="button" onClick={onConfirm} style={{ height: 46, borderRadius: 14, border: 'none', background: 'var(--danger)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {t('save.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
