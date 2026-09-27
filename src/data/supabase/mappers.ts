/**
 * Conversion entre el modelo de dominio (camelCase) y las filas de
 * Postgres (snake_case). Funciones puras — sin esto no podriamos probar
 * nada del mapeo sin levantar una base de datos real.
 */
import type {
  Budget, Category, PaymentMethod, RecurringRule, Reminder, Settings, Transaction,
} from '@/domain/types';

export interface SettingsRow {
  user_id: string; display_name: string | null; onboarded_at: string | null;
  currency: string; locale: string; quincena_start_days: number[];
  default_payment_method_id: string | null; reminder_default_days_before: number; theme: string;
  updated_at: string;
}
export function settingsFromRow(row: SettingsRow): Settings {
  return {
    id: 'singleton',
    displayName: row.display_name ?? '',
    onboardedAt: row.onboarded_at,
    currency: row.currency,
    locale: row.locale,
    // Tal cual viene, sin forzar dos: la columna es smallint[] de largo
    // variable, y ese largo ES el modo. Antes esto lo recortaba siempre a
    // dos elementos, asi que al bajar de la nube el modo mensual se
    // convertia en quincenal solo.
    diasDePago: row.quincena_start_days.length > 0 ? [...row.quincena_start_days] : [10, 25],
    defaultPaymentMethodId: row.default_payment_method_id,
    reminderDefaultDaysBefore: row.reminder_default_days_before,
    theme: row.theme as Settings['theme'],
    updatedAt: row.updated_at,
  };
}
export function settingsToRow(userId: string, s: Settings): SettingsRow {
  return {
    user_id: userId, display_name: s.displayName, onboarded_at: s.onboardedAt,
    currency: s.currency, locale: s.locale,
    // La columna conserva su nombre viejo: renombrarla pediria una
    // migracion y no cambiaria nada de lo que guarda.
    quincena_start_days: [...s.diasDePago],
    default_payment_method_id: s.defaultPaymentMethodId,
    reminder_default_days_before: s.reminderDefaultDaysBefore,
    theme: s.theme,
    // Explicito: si no se manda, el default now() de Postgres pisa la
    // fecha y lo remoto siempre parece mas nuevo que lo local.
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
    // Explicito: si no se manda, el default now() de Postgres pisa la
    // fecha y lo remoto siempre parece mas nuevo que lo local.
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
  recurring_rule_id: string | null; period_key: string | null; created_at: string; updated_at: string;
}
export function transactionFromRow(row: TransactionRow): Transaction {
  return {
    id: row.id, type: row.type as Transaction['type'], concept: row.concept, amount: row.amount, date: row.date,
    categoryId: row.category_id, paymentMethodId: row.payment_method_id, status: row.status as Transaction['status'],
    notes: row.notes ?? undefined, cycleCutoffDate: row.cycle_cutoff_date ?? undefined,
    cyclePaymentDate: row.cycle_payment_date ?? undefined, quincenaKey: row.quincena_key,
    recurringRuleId: row.recurring_rule_id ?? undefined, periodKey: row.period_key ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
export function transactionToRow(userId: string, t: Transaction): TransactionRow {
  return {
    id: t.id, user_id: userId, type: t.type, concept: t.concept, amount: t.amount, date: t.date,
    category_id: t.categoryId, payment_method_id: t.paymentMethodId, status: t.status,
    notes: t.notes ?? null, cycle_cutoff_date: t.cycleCutoffDate ?? null, cycle_payment_date: t.cyclePaymentDate ?? null,
    quincena_key: t.quincenaKey, recurring_rule_id: t.recurringRuleId ?? null, period_key: t.periodKey ?? null,
    created_at: t.createdAt, updated_at: t.updatedAt,
  };
}

export interface RecurringRuleRow {
  id: string; user_id: string; name: string; type: string; amount: number;
  category_id: string | null; payment_method_id: string | null; frequency: string;
  day_of_month: number | null; day_of_week: number | null; start_date: string; end_date: string | null; is_active: boolean; updated_at: string;
}
export function recurringRuleFromRow(row: RecurringRuleRow): RecurringRule {
  return {
    id: row.id, name: row.name, type: row.type as RecurringRule['type'], amount: row.amount,
    categoryId: row.category_id, paymentMethodId: row.payment_method_id, frequency: row.frequency as RecurringRule['frequency'],
    dayOfMonth: row.day_of_month ?? undefined, dayOfWeek: row.day_of_week ?? undefined,
    startDate: row.start_date, endDate: row.end_date ?? undefined, isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}
export function recurringRuleToRow(userId: string, r: RecurringRule): RecurringRuleRow {
  return {
    id: r.id, user_id: userId, name: r.name, type: r.type, amount: r.amount,
    category_id: r.categoryId, payment_method_id: r.paymentMethodId, frequency: r.frequency,
    day_of_month: r.dayOfMonth ?? null, day_of_week: r.dayOfWeek ?? null,
    start_date: r.startDate, end_date: r.endDate ?? null, is_active: r.isActive,
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
