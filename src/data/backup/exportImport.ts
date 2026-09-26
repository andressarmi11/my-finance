import { db } from '../db';
import { localRepository } from '../local/localRepository';
import { BackupSchema, type Backup } from './schema';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportBackupJSON(): Promise<void> {
  const data = await localRepository.exportAll();
  const stamp = new Date().toISOString().slice(0, 10);
  download(`step-up-backup-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function exportTransactionsCSV(): Promise<void> {
  const [transactions, categories, methods] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.paymentMethods.toArray(),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const methodById = new Map(methods.map((m) => [m.id, m.name]));

  const header = ['Fecha', 'Tipo', 'Concepto', 'Categoria', 'Metodo', 'Estado', 'Valor'];
  const rows = transactions.map((t) => [
    t.date,
    t.type === 'income' ? 'Ingreso' : 'Gasto',
    t.concept,
    t.categoryId ? (categoryById.get(t.categoryId) ?? '') : '',
    t.paymentMethodId ? (methodById.get(t.paymentMethodId) ?? '') : '',
    t.status,
    String(t.amount),
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const stamp = new Date().toISOString().slice(0, 10);
  download(`step-up-movimientos-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
}

export interface BackupPreview {
  categories: number;
  paymentMethods: number;
  transactions: number;
  recurringRules: number;
  budgets: number;
  exportedAt: string;
}

export type ParseResult =
  | { success: true; backup: Backup; preview: BackupPreview }
  | { success: false; error: string };

export function parseBackupFile(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { success: false, error: 'El archivo no es un JSON válido.' };
  }
  const result = BackupSchema.safeParse(json);
  if (!result.success) {
    return { success: false, error: 'El archivo no tiene el formato de un backup de Step up.' };
  }
  const backup = result.data;
  return {
    success: true,
    backup,
    preview: {
      categories: backup.categories.length,
      paymentMethods: backup.paymentMethods.length,
      transactions: backup.transactions.length,
      recurringRules: backup.recurringRules.length,
      budgets: backup.budgets.length,
      exportedAt: backup.exportedAt,
    },
  };
}

/** Reemplaza TODO lo que hay en la base local por lo del backup. Se llama solo tras confirmacion explicita del usuario. */
export async function importBackup(backup: Backup): Promise<void> {
  await db.transaction(
    'rw',
    [db.settings, db.categories, db.paymentMethods, db.transactions, db.recurringRules, db.budgets, db.reminders],
    async () => {
      await Promise.all([
        db.settings.clear(), db.categories.clear(), db.paymentMethods.clear(),
        db.transactions.clear(), db.recurringRules.clear(), db.budgets.clear(), db.reminders.clear(),
      ]);
      await Promise.all([
        db.settings.bulkPut(backup.settings),
        db.categories.bulkPut(backup.categories),
        db.paymentMethods.bulkPut(backup.paymentMethods),
        db.transactions.bulkPut(backup.transactions),
        db.recurringRules.bulkPut(backup.recurringRules),
        db.budgets.bulkPut(backup.budgets),
        db.reminders.bulkPut(backup.reminders),
      ]);
    },
  );
}
