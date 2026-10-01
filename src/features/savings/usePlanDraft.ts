import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { DEFAULT_SETTINGS, localRepository } from '@/data/local/localRepository';
import { useActivePlan, type PlanDraft } from '@/data/local/savingsPlans';
import { isSavingsCategory } from '@/domain/budget/kind';
import { addDays, parseISO, shiftMonth, toISO } from '@/domain/dates';
import { calculatePeriod } from '@/domain/period/period';
import { buildPlan, roundingUnit } from '@/domain/savings/plan';
import { goalEndDate, planEndDate } from '@/domain/savings/progress';
import type { SavingsIntensity, SavingsPlanMode, SavingsPlanUnit } from '@/domain/types';
import { EMPTY } from '@/lib/empty';
import { todayISO } from '@/lib/todayISO';

export type StartOption = 'this' | 'period' | 'next' | 'other' | 'keep';

/** Duration defaults and limits per unit (prototype 1a). */
export const UNIT_DEFAULT: Record<SavingsPlanUnit, number> = { days: 15, weeks: 4, months: 3, year: 1 };
export const UNIT_MAX: Record<SavingsPlanUnit, number> = { days: 90, weeks: 52, months: 24, year: 5 };
/** "Otro": up to 14 months ahead. */
export const START_MAX_OFFSET = 14;
/** Salud comes as "No tocar" by default (PRESUPUESTOS-Y-AHORRO.md). */
const DEFAULT_LOCKED = ['cat-salud'];

function firstOfMonth(today: string, offset: number): string {
  const { y, m } = parseISO(today);
  const s = shiftMonth(y, m, offset);
  return toISO({ y: s.y, m: s.m, d: 1 });
}

/**
 * Everything "Ayúdame a ahorrar" shows and saves: the user's choices (mode,
 * intensity, locks, target, start, duration), the engine's plan over their
 * real data, and the draft to save. Re-opening with an active plan preloads
 * its configuration. Phone and desktop draw the same hook.
 */
export function usePlanDraft() {
  const today = todayISO();
  const active = useActivePlan();
  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const rules = useLiveQuery(() => db.recurringRules.toArray(), []) ?? EMPTY;
  const currency = settings.currency;
  const unitStep = roundingUnit(currency) * 5; // 50.000 COP / 50 USD
  const goalStep = unitStep * 10; // 500.000 COP / 500 USD

  const [mode, setMode] = useState<SavingsPlanMode>('monthly');
  const [intensity, setIntensityRaw] = useState<SavingsIntensity>('balanced');
  const [locked, setLocked] = useState<string[]>(DEFAULT_LOCKED);
  const [target, setTarget] = useState<number | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState(goalStep * 6);
  const [start, setStart] = useState<StartOption>('this');
  const [startOffset, setStartOffset] = useState(2);
  const [keptStart, setKeptStart] = useState<string | null>(null);
  const [unit, setUnitRaw] = useState<SavingsPlanUnit>('months');
  const [n, setN] = useState(UNIT_DEFAULT.months);
  const [untilGoal, setUntilGoal] = useState(true);
  const [preloaded, setPreloaded] = useState(false);

  // Re-opening with a plan: its configuration, once.
  useEffect(() => {
    if (preloaded || active === undefined) return;
    setPreloaded(true);
    if (!active) return;
    setMode(active.mode);
    setIntensityRaw(active.intensity);
    setLocked(active.locked);
    setTarget(active.requestedMonthly);
    setGoalName(active.goalName ?? '');
    if (active.goalAmount) setGoalAmount(active.goalAmount);
    setUnitRaw(active.unit);
    setN(active.n);
    setUntilGoal(active.untilGoal);
    setStart('keep');
    setKeptStart(active.startDate);
  }, [active, preloaded]);

  const plan = useMemo(() => buildPlan({
    today, transactions: transactions ?? [], categories, recurringRules: rules, currency,
    intensity, locked, mode, monthlyTarget: mode === 'monthly' ? target : null,
    goalAmount: mode === 'goal' ? goalAmount : undefined,
  }), [today, transactions, categories, rules, currency, intensity, locked, mode, target, goalAmount]);

  const nextPeriodStart = toISO(addDays(parseISO(calculatePeriod(today, settings.payDays).end), 1));
  const startDate = start === 'keep' && keptStart ? keptStart
    : start === 'period' ? nextPeriodStart
    : start === 'next' ? firstOfMonth(today, 1)
    : start === 'other' ? firstOfMonth(today, startOffset)
    : firstOfMonth(today, 0);
  const byGoal = mode === 'goal' && untilGoal;
  const endDate = byGoal
    ? goalEndDate(startDate, Math.max(1, plan.goalMonths ?? 1))
    : planEndDate(startDate, unit, n);
  const weekly = !byGoal && (unit === 'days' || unit === 'weeks');

  const goalCategory = categories.find((c) => !c.isArchived && isSavingsCategory(c)) ?? null;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const draft: PlanDraft = {
    mode, intensity, locked, unit, n, untilGoal: mode === 'goal' && untilGoal, startDate, endDate,
    monthlyTarget: plan.total,
    requestedMonthly: mode === 'monthly' ? target : null,
    goalName: mode === 'goal' && goalName.trim() ? goalName.trim().slice(0, 80) : undefined,
    goalAmount: mode === 'goal' ? goalAmount : undefined,
    cuts: plan.categories.filter((c) => c.cut > 0).map((c) => ({ categoryId: c.categoryId, avg: c.avg, cut: c.cut, limit: c.avg - c.cut })),
    goalCategoryId: goalCategory?.id ?? null,
    goalMonthly: plan.alreadySaving + plan.total,
  };

  return {
    loading: transactions === undefined || active === undefined,
    today, active: active ?? null, currency, payDays: settings.payDays, plan, categoryById, draft,
    mode, setMode: (m: SavingsPlanMode) => setMode(m),
    intensity, setIntensity: (i: SavingsIntensity) => { setIntensityRaw(i); setTarget(null); },
    locked, toggleLocked: (id: string) => { setLocked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); setTarget(null); },
    target: target ?? plan.maxCut, unitStep,
    setTarget: (v: number) => setTarget(Math.max(unitStep, v)),
    goalName, setGoalName, goalAmount, goalStep, setGoalAmount: (v: number) => setGoalAmount(Math.max(goalStep, v)),
    start, setStart: (s: StartOption) => setStart(s), startOffset,
    setStartOffset: (o: number) => setStartOffset(Math.min(START_MAX_OFFSET, Math.max(1, o))),
    startDate, endDate, nextPeriodStart, weekly,
    unit, setUnit: (u: SavingsPlanUnit) => { setUnitRaw(u); setN(UNIT_DEFAULT[u]); },
    n, setN: (v: number) => setN(Math.min(UNIT_MAX[unit], Math.max(1, v))),
    untilGoal, setUntilGoal, byGoal,
  };
}

export type PlanDraftState = ReturnType<typeof usePlanDraft>;
