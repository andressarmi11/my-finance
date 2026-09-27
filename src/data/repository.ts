import type {
  Budget, Category, Id, PaymentMethod, RecurringRule, Reminder, Settings, Transaction,
} from '@/domain/types';

/**
 * A single interface. Phases 1-12 implement it with IndexedDB
 * (LocalRepository). Phase 13 implements it with Supabase. The UI never
 * knows which one it's using.
 */
export interface Repository {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  listCategories(): Promise<Category[]>;
  saveCategory(category: Category): Promise<void>;
  deleteCategory(id: Id): Promise<void>;

  listPaymentMethods(): Promise<PaymentMethod[]>;
  savePaymentMethod(method: PaymentMethod): Promise<void>;
  deletePaymentMethod(id: Id): Promise<void>;

  listTransactions(range?: { from: string; to: string }): Promise<Transaction[]>;
  saveTransaction(tx: Transaction): Promise<void>;
  deleteTransaction(id: Id): Promise<void>;

  listRecurringRules(): Promise<RecurringRule[]>;
  saveRecurringRule(rule: RecurringRule): Promise<void>;
  deleteRecurringRule(id: Id): Promise<void>;

  listBudgets(year: number, month: number): Promise<Budget[]>;
  saveBudget(budget: Budget): Promise<void>;

  listReminders(): Promise<Reminder[]>;
  saveReminder(reminder: Reminder): Promise<void>;

  exportAll(): Promise<unknown>;
  importAll(data: unknown): Promise<void>;
}
