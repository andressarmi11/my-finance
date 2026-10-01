/**
 * The savings engine's shapes (PRESUPUESTOS-Y-AHORRO.md, part B).
 * plan.ts builds a PlanResult; progress.ts reads an active plan against a
 * period. Both are pure: no Dexie, no clock, no language. The "why" of
 * each cut is data (a Reason); the screens turn it into ES/EN text.
 */
import type { Category, ISODate, RecurringRule, SavingsIntensity, SavingsPlanMode, Transaction } from '../types';

export const INTENSITY_RATE: Record<SavingsIntensity, number> = { gentle: 0.1, balanced: 0.2, intense: 0.3 };

export interface PlanInput {
  /** The reference day (the screens pass today). */
  today: ISODate;
  transactions: readonly Transaction[];
  categories: readonly Category[];
  recurringRules: readonly RecurringRule[];
  /** Main currency: COP rounds to 10.000, anything else to 10. */
  currency: string;
  intensity: SavingsIntensity;
  /** Category ids marked "No tocar". */
  locked: readonly string[];
  mode: SavingsPlanMode;
  /** Monthly mode: what the user asks for; null = the most that's sensible (Σcap). */
  monthlyTarget: number | null;
  /** Goal mode. */
  goalAmount?: number;
}

/** Why a category is cut, backed by the user's own data. */
export type Reason =
  | { kind: 'deliveries'; perMonth: number; amountPerMonth: number }
  | { kind: 'rides'; perMonth: number; amountPerMonth: number }
  | { kind: 'aboveAverage'; pct: number; month: number }
  | { kind: 'oneOff'; concept: string; amount: number }
  | { kind: 'topSubscription'; concept: string; amountPerMonth: number; count: number }
  | { kind: 'topConcepts'; concepts: string[] };

export interface CategoryPlan {
  categoryId: string;
  /** Monthly average over the window, without outliers. */
  avg: number;
  /** The least it can sensibly go down to. */
  floor: number;
  /** Flexibility weight w (0 = never cut). */
  weight: number;
  /** Rent, loans, stable recurring: never cut. */
  fixed: boolean;
  /** "No tocar" (by the user). */
  locked: boolean;
  /** The most it can lose a month: min(avg − floor, round(avg × rate × w)); 0 if fixed/locked/no reason. */
  cap: number;
  /** What the plan takes from it a month (≤ cap). */
  cut: number;
  /** Null = no data backs a cut, so the category isn't suggested. */
  reason: Reason | null;
  /** Expenses left out of the average (> 2.5 × the category's median). */
  outliers: Array<{ concept: string; amount: number; date: ISODate }>;
}

export interface PlanResult {
  /** Complete months of history used (0–3). Under 1 → not enough history. */
  historyMonths: number;
  enoughHistory: boolean;
  /** Every expense category with spending in the window, biggest avg first. */
  categories: CategoryPlan[];
  /** Σcap: "Lo máximo sensato hoy". */
  maxCut: number;
  /** Σcut: what the plan saves a month. */
  total: number;
  /** What was asked (monthly mode) or maxCut. */
  want: number;
  /** Asked for more than maxCut: limited, and the screen warns. */
  over: boolean;
  /** Goal mode: months to reach it (ceil(goal / total)); null without a goal or total 0. */
  goalMonths: number | null;
  /** Σcut is 0: nothing left to cut, ask to free a category. */
  needsUnlock: boolean;
  /** For "Cómo quedaría tu plata" (monthly averages). */
  income: number;
  /** Savings categories (the savings icon). */
  alreadySaving: number;
  fixedTotal: number;
  /** Non-fixed expenses minus the plan's cuts. */
  dailyTotal: number;
  /** income − fixed − daily − saving − plan, at least 0. */
  free: number;
}

export interface ProgressInput {
  plan: {
    startDate: ISODate;
    endDate: ISODate;
    monthlyTarget: number;
    cuts: ReadonlyArray<{ categoryId: string; avg: number; cut: number; limit: number }>;
  };
  /** The period on screen, inclusive. */
  from: ISODate;
  to: ISODate;
  /** Quincena: a pay period counts as half a month at most. */
  isPayPeriod: boolean;
  today: ISODate;
  transactions: readonly Transaction[];
}

export type ProgressResult =
  | { covers: false; reason: 'notStarted' | 'ended' }
  | {
      covers: true;
      /** Plan months inside the period (0.5 for a pay period). */
      planMonths: number;
      /** Plan months inside the period that have already gone by. */
      elapsedMonths: number;
      /** monthlyTarget × planMonths, rounded to 1.000. */
      goal: number;
      /** Σ over cut categories of max(0, avg × elapsed − spent so far). */
      saved: number;
      /** Fraction of the period's plan time already gone (the white pace line), 0–1. */
      pace: number;
      started: boolean;
      rows: Array<{
        categoryId: string;
        /** Spent in the elapsed part of the overlap. */
        spent: number;
        /** limit × planMonths. */
        top: number;
        /** Over the pace line (spent / top > pace + 3 %). */
        ahead: boolean;
        /** Over the whole period's top already. */
        exceeded: boolean;
      }>;
      /** Plan months from start to the end of the year (for "Proyección a diciembre"). */
      monthsToDecember: number;
      /** monthlyTarget × monthsToDecember. */
      projection: number;
    };
