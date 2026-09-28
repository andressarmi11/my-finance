import { db } from '../db';
import { localRepository } from '../local/localRepository';
import { BackupSchema, type Backup } from './schema';
import { translate } from '@/i18n/language';

/** BlobPart, not string: the xlsx is bytes, not text. */
function download(filename: string, content: BlobPart, mime: string) {
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

/**
 * Everything to Excel: one sheet per entity.
 *
 * This is NOT re-importable, and that's on purpose: putting names where
 * the model has ids is exactly what makes it readable and exactly what
 * makes it irreversible. For restoring there's the JSON (importBackup),
 * which does keep the ids.
 *
 * The library is loaded with a dynamic import() INSIDE the function, same
 * as @supabase/supabase-js in data/supabase/client.ts. It's ~1.8 MB for
 * an action used once a month: it can't ride in the initial bundle of a
 * PWA that gets installed on the phone.
 */
export async function exportBackupXLSX(): Promise<void> {
  const [{ default: writeXlsxFile }, { SHEETS }] = await Promise.all([
    // '/browser', not the root: the package has no root export, it
    // separates node from browser.
    import('write-excel-file/browser'),
    import('./xlsxRows'),
  ]);
  const backup = (await localRepository.exportAll()) as unknown as Backup;
  const stamp = new Date().toISOString().slice(0, 10);

  // One entry per sheet: {data, sheet}. The first row is the header and
  // stays fixed when scrolling.
  const { toBlob } = await writeXlsxFile(
    SHEETS.map((h) => ({
      data: h.rows(backup),
      sheet: h.name,
      stickyRowsCount: 1,
    })),
  );

  // toBlob, not toFile: this way all three exports flow through the same
  // download(), instead of each having its own way to create the link.
  download(
    `step-up-${stamp}.xlsx`,
    await toBlob(),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
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
  download(`step-up-txs-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
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
    return { success: false, error: translate('backup.notJson') };
  }
  const result = BackupSchema.safeParse(json);
  if (!result.success) {
    return { success: false, error: translate('backup.notAStepUpBackup') };
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

/** Replaces EVERYTHING in the local database with what's in the backup. Only called after explicit user confirmation. */
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
