import Dexie, { type EntityTable } from 'dexie';
import type {
  Budget, Category, PaymentMethod, RecurringRule, Reminder, SavingsPlan, Settings, Transaction,
} from '@/domain/types';
import type { ConceptIndexEntry } from '@/domain/inference/conceptInference';
import type { Tombstone } from './sync/tombstones';
import type { RowMeta } from './sync/owner';

/**
 * Name with its own prefix: on GitHub Pages all projects under
 * <user>.github.io share an origin, so the DB can't be called something
 * generic or it would collide with another project.
 */
export const DB_NAME = 'myfinance_v1';

export class MyFinanceDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  paymentMethods!: EntityTable<PaymentMethod, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  recurringRules!: EntityTable<RecurringRule, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  reminders!: EntityTable<Reminder, 'id'>;
  savingsPlans!: EntityTable<SavingsPlan, 'id'>;
  conceptIndex!: EntityTable<ConceptIndexEntry, 'id'>;
  deletions!: EntityTable<Tombstone, 'id'>;
  /** Device-local data, never synced. See sync/owner.ts. */
  meta!: EntityTable<RowMeta, 'id'>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      settings: 'id',
      categories: 'id, sortOrder',
      paymentMethods: 'id, type',
      // The composite index [recurringRuleId+periodKey] is UNIQUE: that's
      // what makes it impossible to duplicate "Rent, September 2026".
      transactions:
        'id, date, type, status, categoryId, paymentMethodId, quincenaKey, cyclePaymentDate, &[recurringRuleId+periodKey]',
      recurringRules: 'id, frequency',
      budgets: 'id, [year+month], categoryId',
      reminders: 'id, remindAt, status, transactionId',
    });
    // v2: conceptIndex — memory for the expense/income form's autofill.
    // Every tx save upserts here, and the form queries it on open.
    this.version(2).stores({
      conceptIndex: 'id, lastUsedAt, count',
    });
    // v3: deletion tombstones. Without them, syncing resurrects what was
    // deleted (see data/sync/tombstones.ts).
    this.version(3).stores({
      deletions: 'id, entity, deletedAt',
    });
    // v4: who this data belongs to. Without this, signing out and signing
    // in with another account on the same browser would upload the first
    // person's transactions to the second person's account (see sync/owner.ts).
    this.version(4).stores({
      meta: 'id',
    });
    // v5: "Ayúdame a ahorrar" (PRESUPUESTOS-Y-AHORRO.md). One active plan
    // at most; deleted ones stay as rows (deletedAt) so the deletion syncs.
    this.version(5).stores({
      savingsPlans: 'id, updatedAt',
    });
  }
}

export const db = new MyFinanceDB();
