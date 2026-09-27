/**
 * Esquema de validacion del backup. Nunca escribimos nada a la base de
 * datos sin pasar por aqui primero — un JSON corrupto o de otra app no
 * debe poder romper IndexedDB.
 */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida');

const SettingsBase = z.object({
  id: z.literal('singleton'),
  // Opcionales con default: un backup exportado antes de que existieran
  // estos campos tiene que seguir importandose sin error.
  displayName: z.string().default(''),
  onboardedAt: z.string().nullable().default(null),
  updatedAt: z.string().default(''),
  currency: z.string().min(1),
  locale: z.string().min(1),
  // Lista, no tupla: uno = te pagan una vez al mes, dos = quincenal.
  diasDePago: z.array(z.number().int().min(1).max(31)).min(1).max(4).default([10, 25]),
  defaultPaymentMethodId: z.string().nullable(),
  reminderDefaultDaysBefore: z.number().int().min(0),
  theme: z.enum(['system', 'light', 'dark']),
});

/**
 * Un respaldo hecho antes de este cambio guarda los dias con el nombre
 * viejo, `quincenaStartDays`. Sin traducirlo, el default de arriba se
 * activaria y quien tuviera quincenas en, digamos, el 5 y el 20 las
 * recuperaria como 10 y 25 sin enterarse: sus movimientos se reagruparian
 * solos al restaurar.
 */
export const SettingsSchema = z.preprocess((valor) => {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const obj = valor as Record<string, unknown>;
    if (obj.diasDePago === undefined && Array.isArray(obj.quincenaStartDays)) {
      const { quincenaStartDays, ...resto } = obj;
      return { ...resto, diasDePago: quincenaStartDays };
    }
  }
  return valor;
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
  // Opcional: los backups hechos antes del cupo siguen importando.
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
  // Diferidos. Opcionales: los backups anteriores siguen importando.
  installmentGroupId: z.string().min(1).optional(),
  installmentNumber: z.number().int().min(1).optional(),
  installmentCount: z.number().int().min(1).optional(),
  purchaseDate: isoDate.optional(),
  quincenaKey: z.string().nullable(),
  recurringRuleId: z.string().optional(),
  periodKey: z.string().optional(),
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
  frequency: z.enum(['monthly', 'weekly', 'biweekly', 'yearly']),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startDate: isoDate,
  endDate: isoDate.optional(),
  isActive: z.boolean(),
  updatedAt: z.string().default(''),
});

export const BudgetSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  amount: z.number(),
  // default(''): un respaldo hecho antes de que los presupuestos se
  // sincronizaran no trae este campo, y tiene que seguir restaurandose.
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
