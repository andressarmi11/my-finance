/**
 * Conversion between the domain model (camelCase) and Postgres rows
 * (snake_case). Pure functions — without this we couldn't test any of the
 * mapping without spinning up a real database.
 */
import { cleanInterval, cleanMonths } from '@/domain/recurring/expansion';
import type {
  Budget, Category, ForeignAmount, PaymentMethod, RecurringRule, Reminder, ReminderRule, Settings, Transaction,
} from '@/domain/types';

/**
 * Foreign-currency columns (migration 0013). All three or none: a row with
 * only some of them is treated as main currency rather than half-converted.
 */
interface ForeignAmountRow {
  currency?: string | null; original_amount?: number | null; fx_rate?: number | string | null;
}
function foreignFromRow(row: ForeignAmountRow): ForeignAmount {
  if (!row.currency || row.original_amount == null || row.fx_rate == null) return {};
  // numeric comes back from PostgREST as a string when it has many digits.
  const fxRate = Number(row.fx_rate);
  if (!Number.isFinite(fxRate) || fxRate <= 0) return {};
  return { currency: row.currency, originalAmount: row.original_amount, fxRate };
}
function foreignToRow(f: ForeignAmount): { currency: string | null; original_amount: number | null; fx_rate: number | null } {
  const complete = f.currency && f.originalAmount != null && f.fxRate != null;
  return {
    currency: complete ? f.currency! : null,
    original_amount: complete ? f.originalAmount! : null,
    fx_rate: complete ? f.fxRate! : null,
  };
}

/** Migration 0014: 'none', a rule object, or null (= the general reminder). */
function reminderFromJson(value: unknown): Transaction['reminder'] {
  if (value === 'none') return 'none';
  if (value && typeof value === 'object') return value as ReminderRule;
  return undefined;
}

/** Migration 0015: the general reminder. Only an object counts; anything else = derived. */
function settingsReminderFromJson(value: unknown): ReminderRule | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ReminderRule : undefined;
}

export interface SettingsRow {
  user_id: string; display_name: string | null; onboarded_at: string | null;
  currency: string; locale: string; quincena_start_days: number[];
  default_payment_method_id: string | null; reminder_default_days_before: number; theme: string;
  /** Migration 0013. null = the default trio. */
  quick_currencies?: string[] | null;
  /** Migration 0015. null = derived from reminder_default_days_before. */
  reminder?: unknown;
  updated_at: string;
}
export function settingsFromRow(row: SettingsRow): Settings {
  return {
    id: 'singleton',
    displayName: row.display_name ?? '',
    onboardedAt: row.onboarded_at,
    currency: row.currency,
    locale: row.locale,
    // Taken as-is, without forcing two: the column is a variable-length
    // smallint[], and that length IS the mode. This used to always trim
    // it to two elements, so pulling down from the cloud would silently
    // turn monthly mode into biweekly.
    payDays: row.quincena_start_days.length > 0 ? [...row.quincena_start_days] : [10, 25],
    defaultPaymentMethodId: row.default_payment_method_id,
    reminderDefaultDaysBefore: row.reminder_default_days_before,
    theme: row.theme as Settings['theme'],
    ...(row.quick_currencies?.length ? { quickCurrencies: [...row.quick_currencies] } : {}),
    ...(settingsReminderFromJson(row.reminder) ? { reminder: settingsReminderFromJson(row.reminder) } : {}),
    updatedAt: row.updated_at,
  };
}
export function settingsToRow(userId: string, s: Settings): SettingsRow {
  return {
    user_id: userId, display_name: s.displayName, onboarded_at: s.onboardedAt,
    currency: s.currency, locale: s.locale,
    // The column keeps its old name: renaming it would require a
    // migration and wouldn't change anything about what it stores.
    quincena_start_days: [...s.payDays],
    default_payment_method_id: s.defaultPaymentMethodId,
    reminder_default_days_before: s.reminderDefaultDaysBefore,
    theme: s.theme,
    quick_currencies: s.quickCurrencies?.length ? [...s.quickCurrencies] : null,
    // Always sent, null included: an explicit null is what clears it remotely.
    reminder: s.reminder ?? null,
    // Explicit: if it's not sent, Postgres's now() default overwrites the
    // date and the remote row always looks newer than the local one.
    updated_at: s.updatedAt || new Date().toISOString(),
  };
}

export interface CategoryRow {
  id: string; user_id: string; name: string; icon: string; color: string;
  kind: string; is_archived: boolean; sort_order: number; updated_at: string;
}
export function categoryFromRow(row: CategoryRow): Category {
  return {
    id: row.id, name: row.name, icon: row.icon, color: row.color,
    kind: row.kind as Category['kind'], isArchived: row.is_archived, sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}
export function categoryToRow(userId: string, c: Category): CategoryRow {
  return {
    id: c.id, user_id: userId, name: c.name, icon: c.icon, color: c.color,
    kind: c.kind, is_archived: c.isArchived, sort_order: c.sortOrder,
    // Explicit: if it's not sent, Postgres's now() default overwrites the
    // date and the remote row always looks newer than the local one.
    updated_at: c.updatedAt || new Date().toISOString(),
  };
}

export interface PaymentMethodRow {
  id: string; user_id: string; type: string; name: string; is_default: boolean;
  cutoff_day: number | null; payment_day: number | null; credit_limit: number | null;
  updated_at: string;
}
export function paymentMethodFromRow(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id, type: row.type as PaymentMethod['type'], name: row.name, isDefault: row.is_default,
    cutoffDay: row.cutoff_day ?? undefined, paymentDay: row.payment_day ?? undefined,
    creditLimit: row.credit_limit ?? undefined,
    updatedAt: row.updated_at,
  };
}
export function paymentMethodToRow(userId: string, m: PaymentMethod): PaymentMethodRow {
  return {
    id: m.id, user_id: userId, type: m.type, name: m.name, is_default: m.isDefault,
    cutoff_day: m.cutoffDay ?? null, payment_day: m.paymentDay ?? null,
    credit_limit: m.creditLimit ?? null,
    updated_at: m.updatedAt || new Date().toISOString(),
  };
}

export interface TransactionRow {
  id: string; user_id: string; type: string; concept: string; amount: number; date: string;
  category_id: string | null; payment_method_id: string | null; status: string; notes: string | null;
  cycle_cutoff_date: string | null; cycle_payment_date: string | null; quincena_key: string | null;
  recurring_rule_id: string | null; period_key: string | null;
  installment_group_id: string | null; installment_number: number | null;
  installment_count: number | null; purchase_date: string | null;
  /** Migration 0013. */
  currency?: string | null; original_amount?: number | null; fx_rate?: number | string | null;
  /** Migration 0014. */
  reminder?: unknown; time?: string | null;
  created_at: string; updated_at: string;
}
export function transactionFromRow(row: TransactionRow): Transaction {
  return {
    id: row.id, type: row.type as Transaction['type'], concept: row.concept, amount: row.amount, date: row.date,
    categoryId: row.category_id, paymentMethodId: row.payment_method_id, status: row.status as Transaction['status'],
    notes: row.notes ?? undefined, cycleCutoffDate: row.cycle_cutoff_date ?? undefined,
    installmentGroupId: row.installment_group_id ?? undefined,
    installmentNumber: row.installment_number ?? undefined,
    installmentCount: row.installment_count ?? undefined,
    purchaseDate: row.purchase_date ?? undefined,
    cyclePaymentDate: row.cycle_payment_date ?? undefined, quincenaKey: row.quincena_key,
    recurringRuleId: row.recurring_rule_id ?? undefined, periodKey: row.period_key ?? undefined,
    ...foreignFromRow(row),
    ...(row.time ? { time: row.time } : {}),
    ...(reminderFromJson(row.reminder) !== undefined ? { reminder: reminderFromJson(row.reminder) } : {}),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
export function transactionToRow(userId: string, t: Transaction): TransactionRow {
  return {
    id: t.id, user_id: userId, type: t.type, concept: t.concept, amount: t.amount, date: t.date,
    category_id: t.categoryId, payment_method_id: t.paymentMethodId, status: t.status,
    notes: t.notes ?? null, cycle_cutoff_date: t.cycleCutoffDate ?? null, cycle_payment_date: t.cyclePaymentDate ?? null,
    installment_group_id: t.installmentGroupId ?? null,
    installment_number: t.installmentNumber ?? null,
    installment_count: t.installmentCount ?? null,
    purchase_date: t.purchaseDate ?? null,
    quincena_key: t.quincenaKey, recurring_rule_id: t.recurringRuleId ?? null, period_key: t.periodKey ?? null,
    ...foreignToRow(t),
    reminder: t.reminder ?? null,
    time: t.time ?? null,
    created_at: t.createdAt, updated_at: t.updatedAt,
  };
}

export interface RecurringRuleRow {
  id: string; user_id: string; name: string; type: string; amount: number;
  category_id: string | null; payment_method_id: string | null; frequency: string;
  day_of_month: number | null; day_of_week: number | null; start_date: string; end_date: string | null; is_active: boolean; updated_at: string;
  interval_every: number | null; interval_unit: string | null; months: number[] | null;
  /** Migration 0013. */
  currency?: string | null; original_amount?: number | null; fx_rate?: number | string | null;
}
export function recurringRuleFromRow(row: RecurringRuleRow): RecurringRule {
  return {
    id: row.id, name: row.name, type: row.type as RecurringRule['type'], amount: row.amount,
    categoryId: row.category_id, paymentMethodId: row.payment_method_id, frequency: row.frequency as RecurringRule['frequency'],
    dayOfMonth: row.day_of_month ?? undefined, dayOfWeek: row.day_of_week ?? undefined,
    // Rows saved before 0012 come back without these columns (undefined).
    // Sanitized: a bad server row must not reach Dexie and loop the expansion.
    interval: cleanInterval({ every: row.interval_every, unit: row.interval_unit }),
    months: cleanMonths(row.months),
    startDate: row.start_date, endDate: row.end_date ?? undefined, isActive: row.is_active,
    ...foreignFromRow(row),
    updatedAt: row.updated_at,
  };
}
export function recurringRuleToRow(userId: string, r: RecurringRule): RecurringRuleRow {
  return {
    id: r.id, user_id: userId, name: r.name, type: r.type, amount: r.amount,
    category_id: r.categoryId, payment_method_id: r.paymentMethodId, frequency: r.frequency,
    day_of_month: r.dayOfMonth ?? null, day_of_week: r.dayOfWeek ?? null,
    interval_every: r.interval?.every ?? null, interval_unit: r.interval?.unit ?? null,
    months: r.months?.length ? r.months : null,
    start_date: r.startDate, end_date: r.endDate ?? null, is_active: r.isActive,
    ...foreignToRow(r),
    updated_at: r.updatedAt || new Date().toISOString(),
  };
}

export interface BudgetRow {
  id: string; user_id: string; category_id: string; year: number; month: number; amount: number;
  updated_at: string;
}
export function budgetFromRow(row: BudgetRow): Budget {
  return {
    id: row.id, categoryId: row.category_id, year: row.year, month: row.month,
    amount: row.amount, updatedAt: row.updated_at,
  };
}
export function budgetToRow(userId: string, b: Budget): BudgetRow {
  return {
    id: b.id, user_id: userId, category_id: b.categoryId, year: b.year, month: b.month,
    amount: b.amount,
    updated_at: b.updatedAt || new Date().toISOString(),
  };
}

export interface ReminderRow {
  id: string; user_id: string; transaction_id: string; remind_at: string; status: string; sent_at: string | null;
  updated_at: string;
}
export function reminderFromRow(row: ReminderRow): Reminder {
  return {
    id: row.id, transactionId: row.transaction_id, remindAt: row.remind_at,
    status: row.status as Reminder['status'], sentAt: row.sent_at ?? undefined,
    updatedAt: row.updated_at,
  };
}
export function reminderToRow(userId: string, r: Reminder): ReminderRow {
  return {
    id: r.id, user_id: userId, transaction_id: r.transactionId, remind_at: r.remindAt,
    status: r.status, sent_at: r.sentAt ?? null,
    updated_at: r.updatedAt || new Date().toISOString(),
  };
}
