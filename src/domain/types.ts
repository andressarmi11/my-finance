/**
 * Domain types. This folder does NOT import React or Supabase.
 *
 * Hard rules:
 *  - Money is always an integer (pesos). Never a float.
 *  - Business dates are 'YYYY-MM-DD' strings, never a Date with a time.
 *    This stops a purchase made at 11pm on the 15th from landing in the
 *    wrong cycle because of timezone (Colombia = UTC-5).
 */

export type ISODate = string; // 'YYYY-MM-DD'
export type Id = string;

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending' | 'scheduled' | 'cancelled';
export type PaymentMethodType = 'debit' | 'credit' | 'cash' | 'transfer';
export type Frequency = 'monthly' | 'biweekly' | 'weekly' | 'yearly' | 'custom';

/** E.g.: '2026-09-Q1' (the 10th-of-the-month payday) | '2026-09-Q2' (the 25th) */
export type PeriodKey = string;

/**
 * When to remind about a transaction. Either N days before at a fixed time,
 * or the same day: some hours/minutes before its time, or at an exact time.
 * Same shape for the general setting and for a single transaction's override.
 */
export interface ReminderRule {
  mode: 'days' | 'sameDay';
  /** mode 'days': how many days before (1-7). */
  days: number;
  /** mode 'days': at what time, 'HH:MM'. */
  time: string;
  /** mode 'sameDay'. `value` is a number of hours/minutes, or 'HH:MM' for 'at'. */
  sameDay: { kind: 'hours' | 'minutes' | 'at'; value: number | string };
}

/**
 * Where a converted amount came from. `amount` stays the integer in the main
 * currency (Math.round(originalAmount * fxRate)), so no calculation changes;
 * these only remember the original to show it and to edit it.
 * All three together, or none (= main currency).
 */
export interface ForeignAmount {
  /** ISO 4217, e.g. 'USD'. */
  currency?: string;
  /** In whole units of `currency`. */
  originalAmount?: number;
  /** Units of the main currency per unit of `currency`. */
  fxRate?: number;
}

export interface Settings {
  id: 'singleton';
  /** What they want to be called. Empty = not asked yet. */
  displayName: string;
  currency: string; // 'COP'
  locale: string; // 'es-CO'
  /**
   * The days of the month money comes in.
   *
   * THE NUMBER OF DAYS IS THE MODE: one = paid once a month, two =
   * fortnightly. There is no separate field saying "monthly" or
   * "fortnightly" that could contradict this list.
   *
   * Used to be a fixed tuple of two (quincenaStartDays), which is exactly
   * what ruled out monthly mode. See domain/period/period.ts.
   */
  payDays: number[];
  defaultPaymentMethodId: Id | null;
  reminderDefaultDaysBefore: number;
  /**
   * The general reminder (redesign §9f, migration 0015). Missing = derived
   * from reminderDefaultDaysBefore: that many days before at 09:00 (see
   * generalReminderRule in domain/reminders/schedule.ts).
   */
  reminder?: ReminderRule;
  theme: 'system' | 'light' | 'dark';
  /**
   * The currencies offered as chips in the new-transaction sheet (max 3).
   * Missing = ['COP', 'USD', 'EUR']. The rest live behind "Más".
   */
  quickCurrencies?: string[];
  /** ISO datetime of when onboarding finished. null = show it. */
  onboardedAt: string | null;
  /**
   * When this was last saved. Sync needs this: without it, pulling from
   * the cloud blindly overwrote local data and wiped out onboarding just
   * completed on every login.
   */
  updatedAt: string;
}

export interface Category {
  id: Id;
  name: string;
  icon: string;
  color: string;
  kind: 'expense' | 'income' | 'both';
  isArchived: boolean;
  sortOrder: number;
  /**
   * When this was last saved. Sync needs this: without it, pulling from
   * the cloud blindly overwrote local data and every edit undid itself
   * on the next cycle (which always starts by pulling).
   * Empty = never saved, and loses against any real date.
   */
  updatedAt: string;
}

export interface PaymentMethod {
  id: Id;
  type: PaymentMethodType;
  name: string;
  /**
   * LEGACY — do not write to this. The source of truth for the default
   * method is Settings.defaultPaymentMethodId; this field only survives
   * as the last link in the ?? chain for anyone who never touched that
   * setting (see TransactionsScreen:
   * settings.defaultPaymentMethodId ?? find(isDefault)).
   * Having two places where "the default" lived already made a checkbox
   * that wrote here look like it did nothing.
   */
  isDefault: boolean;
  /** Only if type === 'credit'. Configurable, never hardcoded. */
  cutoffDay?: number; // 15
  paymentDay?: number; // 2
  /** Total limit in whole pesos. Only if type === 'credit'. */
  creditLimit?: number;
  /**
   * When this was last saved. Sync needs this: without it, pulling from
   * the cloud blindly overwrote local data and every edit undid itself
   * on the next cycle (which always starts by pulling).
   * Empty = never saved, and loses against any real date.
   */
  updatedAt: string;
}

export type TransactionSource = 'sms' | 'atajo' | 'dictation';

export interface Transaction extends ForeignAmount {
  id: Id;
  type: TransactionType;
  concept: string;
  amount: number; // whole pesos
  date: ISODate; // date of the purchase / of the income
  categoryId: Id | null;
  paymentMethodId: Id | null;
  status: TransactionStatus;
  notes?: string;

  /** Derived from the card, persisted so that changing the cutoff doesn't rewrite history. */
  cycleCutoffDate?: ISODate;
  cyclePaymentDate?: ISODate;

  /**
   * Instalment purchase. The N instalments are N transactions sharing a
   * group; each one's id is `${installmentGroupId}:cuota-${n}`,
   * deterministic, so the delete tombstone knows which one died (same
   * reasoning as occurrenceId in data/local/materialize.ts).
   */
  installmentGroupId?: Id;
  /** 1..N */
  installmentNumber?: number;
  /** N */
  installmentCount?: number;
  /**
   * When the PURCHASE was made. Differs from `date` from instalment 2
   * onward. Exists for the credit limit: an instalment purchase locks
   * the whole limit on the day of the purchase, not instalment by
   * instalment (see credit-card/availableCredit.ts).
   */
  purchaseDate?: ISODate;

  /** null = computed from the date. A value means the user moved it by hand. */
  quincenaKey: PeriodKey | null;

  /** Optional time of day, 'HH:MM'. Same-day reminders count from it (or 09:00). */
  time?: string;
  /** This transaction's reminder: its own rule, 'none', or null/absent = the general one. */
  reminder?: ReminderRule | 'none' | null;

  /**
   * It arrived on its own (inbox, BANDEJA.md): from a bank SMS, a Shortcut or
   * dictation. Absent for everything typed in the app. `sourceLabel` is who
   * sent it when the text says so ("Bancolombia").
   */
  source?: TransactionSource;
  sourceLabel?: string;

  /** Recurrence traceability. UNIQUE(recurringRuleId, periodKey) in the DB. */
  recurringRuleId?: Id;
  periodKey?: string; // '2026-09'

  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule extends ForeignAmount {
  id: Id;
  name: string;
  type: TransactionType;
  amount: number;
  categoryId: Id | null;
  paymentMethodId: Id | null;
  frequency: Frequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  /**
   * Only for frequency 'custom' (exactly one of interval | months).
   * interval: every N months (1-12) or weeks (1-26), anchored to startDate.
   */
  interval?: { every: number; unit: 'months' | 'weeks' };
  /** Only for 'custom': specific months (1-12, sorted, unique), on dayOfMonth. */
  months?: number[];
  startDate: ISODate;
  endDate?: ISODate;
  isActive: boolean;
  /**
   * When this was last saved. Sync needs this: without it, pulling from
   * the cloud blindly overwrote local data and every edit undid itself
   * on the next cycle (which always starts by pulling).
   * Empty = never saved, and loses against any real date.
   */
  updatedAt: string;
}

export interface Budget {
  id: Id;
  categoryId: Id;
  year: number;
  month: number; // 1-12
  amount: number;
  /**
   * Stamped by the repository on save. Without this there was no way
   * to sync them: last-write-wins needs to know which of the two
   * copies is the recent one. Empty = never saved, and loses.
   */
  updatedAt: string;
}

export interface Reminder {
  id: Id;
  transactionId: Id;
  remindAt: string; // ISO datetime
  status: 'scheduled' | 'sent' | 'dismissed' | 'failed';
  sentAt?: string;
  /**
   * Same as Budget: without this they can't be synced. It's needed
   * because the server marks them 'sent' and that change has to be
   * able to beat the local copy without the local one overwriting it
   * back.
   */
  updatedAt: string;
}
