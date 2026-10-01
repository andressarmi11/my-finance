/**
 * Backup validation schema. We never write anything to the database
 * without going through here first — a corrupt JSON, or one from another
 * app, must not be able to break IndexedDB.
 */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora invalida');

// Migration 0013: where a converted amount came from. Optional, so backups
// made before per-transaction currencies existed still import.
const foreignAmount = {
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  originalAmount: z.number().min(0).optional(),
  fxRate: z.number().positive().optional(),
};

// Migration 0014: a transaction's own reminder, or 'none'.
const ReminderRuleSchema = z.object({
  mode: z.enum(['days', 'sameDay']),
  days: z.number().int().min(0).max(7),
  time: hhmm,
  sameDay: z.object({
    kind: z.enum(['hours', 'minutes', 'at']),
    value: z.union([z.number().int().min(0), hhmm]),
  }),
});

const SettingsBase = z.object({
  id: z.literal('singleton'),
  // Optional with a default: a backup exported before these fields
  // existed still has to import without error.
  displayName: z.string().default(''),
  onboardedAt: z.string().nullable().default(null),
  updatedAt: z.string().default(''),
  currency: z.string().min(1),
  locale: z.string().min(1),
  // List, not a tuple: one = you get paid once a month, two = biweekly.
  payDays: z.array(z.number().int().min(1).max(31)).min(1).max(4).default([10, 25]),
  defaultPaymentMethodId: z.string().nullable(),
  reminderDefaultDaysBefore: z.number().int().min(0),
  theme: z.enum(['system', 'light', 'dark']),
  quickCurrencies: z.array(z.string().regex(/^[A-Z]{3}$/)).max(3).optional(),
  // Migration 0015: the general reminder. Optional: absent = derived from
  // reminderDefaultDaysBefore, which is what every older backup means.
  reminder: ReminderRuleSchema.optional(),
});

/**
 * Older backups store the days under an older name: `quincenaStartDays`
 * first, then `diasDePago`. Without translating them, the default above
 * would kick in and anyone with pay dates on, say, the 5th and the 20th
 * would get them back as 10 and 25 without noticing: their transactions
 * would silently regroup themselves on restore.
 */
export const SettingsSchema = z.preprocess((value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (obj.payDays === undefined) {
      const { quincenaStartDays, diasDePago, ...rest } = obj;
      const old = diasDePago ?? quincenaStartDays;
      if (Array.isArray(old)) return { ...rest, payDays: old };
    }
  }
  return value;
}, SettingsBase);

export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  kind: z.enum(['expense', 'income', 'both']),
  updatedAt: z.string().default(''),
  isArchived: z.boolean(),
  sortOrder: z.number(),
});

export const PaymentMethodSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['debit', 'credit', 'cash', 'transfer']),
  name: z.string().min(1),
  isDefault: z.boolean(),
  updatedAt: z.string().default(''),
  cutoffDay: z.number().int().min(1).max(31).optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
  // Optional: backups made before the credit limit field existed still import.
  creditLimit: z.number().int().min(0).optional(),
});

export const TransactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['income', 'expense']),
  concept: z.string().min(1),
  amount: z.number(),
  date: isoDate,
  categoryId: z.string().nullable(),
  paymentMethodId: z.string().nullable(),
  status: z.enum(['paid', 'pending', 'scheduled', 'cancelled']),
  notes: z.string().optional(),
  cycleCutoffDate: isoDate.optional(),
  cyclePaymentDate: isoDate.optional(),
  // Installments. Optional: older backups still import.
  installmentGroupId: z.string().min(1).optional(),
  installmentNumber: z.number().int().min(1).optional(),
  installmentCount: z.number().int().min(1).optional(),
  purchaseDate: isoDate.optional(),
  quincenaKey: z.string().nullable(),
  recurringRuleId: z.string().optional(),
  periodKey: z.string().optional(),
  ...foreignAmount,
  time: hhmm.optional(),
  reminder: z.union([ReminderRuleSchema, z.literal('none')]).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RecurringRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  amount: z.number(),
  categoryId: z.string().nullable(),
  paymentMethodId: z.string().nullable(),
  frequency: z.enum(['monthly', 'weekly', 'biweekly', 'yearly', 'custom']),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  // Mirrors the CHECKs of migration 0012.
  interval: z.discriminatedUnion('unit', [
    z.object({ every: z.number().int().min(1).max(12), unit: z.literal('months') }),
    z.object({ every: z.number().int().min(1).max(26), unit: z.literal('weeks') }),
  ]).optional(),
  months: z.array(z.number().int().min(1).max(12)).min(1).max(12).optional(),
  startDate: isoDate,
  endDate: isoDate.optional(),
  isActive: z.boolean(),
  ...foreignAmount,
  updatedAt: z.string().default(''),
}).superRefine((r, ctx) => {
  // custom <=> exactly one pattern; any other frequency carries none.
  const patterns = (r.interval ? 1 : 0) + (r.months ? 1 : 0);
  if (patterns !== (r.frequency === 'custom' ? 1 : 0)) {
    ctx.addIssue({ code: 'custom', message: 'custom recurrence needs exactly one of interval | months' });
  }
});

export const BudgetSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  amount: z.number(),
  // Tope/Meta and the savings plan's marks: absent in older backups.
  kind: z.enum(['limit', 'goal']).optional(),
  planId: z.string().optional(),
  goalName: z.string().optional(),
  goalAmount: z.number().optional(),
  // default(''): a backup made before budgets were synced doesn't carry
  // this field, and it still has to restore.
  updatedAt: z.string().default(''),
});

export const ReminderSchema = z.object({
  updatedAt: z.string().default(''),
  id: z.string().min(1),
  transactionId: z.string().min(1),
  remindAt: z.string(),
  status: z.enum(['scheduled', 'sent', 'dismissed', 'failed']),
  sentAt: z.string().optional(),
});

export const BackupSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string(),
  settings: z.array(SettingsSchema),
  categories: z.array(CategorySchema),
  paymentMethods: z.array(PaymentMethodSchema),
  transactions: z.array(TransactionSchema),
  recurringRules: z.array(RecurringRuleSchema),
  budgets: z.array(BudgetSchema),
  reminders: z.array(ReminderSchema),
});

export type Backup = z.infer<typeof BackupSchema>;
