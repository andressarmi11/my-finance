import { db } from '../db';
import type { Repository } from '../repository';
import type { Settings } from '@/domain/types';
import { importBackup } from '../backup/exportImport';
import { BackupSchema } from '../backup/schema';
import { normalize } from '@/domain/inference/conceptInference';
import { makeTombstone, type DeletableEntity } from '../sync/tombstones';

/**
 * Todo borrado deja lapida. Es lo que permite que el borrado viaje a los
 * otros dispositivos en vez de que ellos lo resuciten en el siguiente
 * sync (ver data/sync/tombstones.ts).
 */
/**
 * Pone la fecha de guardado. Va aca, en el unico lugar por el que pasan
 * todos los guardados, y no en cada pantalla: asi ninguna puede olvidarse
 * y dejar una fila que la sincronizacion no sepa fechar.
 */
function sellar<T extends { updatedAt: string }>(fila: T): T {
  return { ...fila, updatedAt: new Date().toISOString() };
}

async function borrarConLapida(entity: DeletableEntity, id: string): Promise<void> {
  await db.deletions.put(makeTombstone(entity, id, new Date().toISOString()));
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  displayName: '',
  currency: 'COP',
  locale: 'es-CO',
  diasDePago: [10, 25], // dos dias de pago = quincenal
  defaultPaymentMethodId: null,
  reminderDefaultDaysBefore: 1,
  theme: 'system',
  onboardedAt: null,
  // Vacio a proposito: una fila que nunca se guardo no puede ganarle a
  // ninguna de la nube en la comparacion de "cual es mas nueva".
  updatedAt: '',
};

/**
 * Rellena con los defaults los campos que falten. Sin esto, cada campo
 * nuevo de Settings deja `undefined` en la base de quien ya venia usando
 * la app (displayName, onboardedAt...) y la UI se rompe en silencio.
 */
export function withDefaults(stored: Settings | undefined): Settings {
  const base = { ...DEFAULT_SETTINGS, ...(stored ?? {}), id: 'singleton' as const };

  // Puente para quien ya venia usando la app: sus dias vivian en
  // `quincenaStartDays`, que ahora se llama `diasDePago`. Sin esto, el
  // spread de arriba dejaria el valor por defecto y alguien con quincenas
  // en, digamos, el 5 y el 20 volveria al 10 y 25 sin enterarse.
  const viejo = (stored as unknown as { quincenaStartDays?: unknown } | undefined)?.quincenaStartDays;
  if (!Array.isArray(stored?.diasDePago) && Array.isArray(viejo)) {
    return { ...base, diasDePago: [...(viejo as number[])] };
  }
  return base;
}

export const localRepository: Repository = {
  async getSettings() {
    return withDefaults(await db.settings.get('singleton'));
  },
  async saveSettings(settings) {
    // La marca de tiempo se pone aca y no en cada pantalla: es el unico
    // lugar por el que pasan todos los guardados, asi que es imposible
    // olvidarse y dejar un Settings que la sincronizacion no sepa fechar.
    await db.settings.put({ ...settings, updatedAt: new Date().toISOString() });
  },

  listCategories: () => db.categories.orderBy('sortOrder').toArray(),
  saveCategory: async (category) => { await db.categories.put(sellar(category)); },
  deleteCategory: async (id) => { await db.categories.delete(id); await borrarConLapida('categories', id); },

  listPaymentMethods: () => db.paymentMethods.toArray(),
  savePaymentMethod: async (method) => { await db.paymentMethods.put(sellar(method)); },
  deletePaymentMethod: async (id) => {
    // Las referencias se sueltan ANTES de borrar la tarjeta. En Postgres lo
    // hace el ON DELETE SET NULL de las FK; aca hay que hacerlo a mano o
    // quedan transacciones apuntando a una tarjeta que ya no existe hasta
    // que el proximo sync baje la version con null. Mismo caso que
    // deleteTransaction con sus recordatorios.
    //
    // Los movimientos NO se borran: son plata que si se gasto. Quedan sin
    // metodo, y la UI ya tolera paymentMethod undefined.
    await db.transactions.where('paymentMethodId').equals(id).modify({ paymentMethodId: null });
    // filter y no where: recurringRules solo indexa 'id, frequency' (db.ts),
    // asi que where('paymentMethodId') reventaria. Son pocas reglas.
    const reglas = await db.recurringRules.filter((r) => r.paymentMethodId === id).toArray();
    for (const regla of reglas) {
      await db.recurringRules.put(sellar({ ...regla, paymentMethodId: null }));
    }
    await db.paymentMethods.delete(id);
    await borrarConLapida('paymentMethods', id);
  },

  listTransactions: (range) =>
    range
      ? db.transactions.where('date').between(range.from, range.to, true, true).toArray()
      : db.transactions.toArray(),
  saveTransaction: async (tx) => {
    await db.transactions.put(tx);
    // Actualiza el índice de conceptos para el smart-fill del form.
    // Solo entradas manuales del user (no las materializadas por reglas
    // recurrentes) alimentan el índice: si el user vuelve a ese concepto,
    // quiere recuperar la última categoría/método que usó.
    if (!tx.recurringRuleId && tx.concept.trim()) {
      const key = normalize(tx.concept);
      if (key) {
        const prev = await db.conceptIndex.get(key);
        await db.conceptIndex.put({
          id: key,
          displayName: tx.concept.trim(),
          categoryId: tx.categoryId,
          paymentMethodId: tx.paymentMethodId,
          count: (prev?.count ?? 0) + 1,
          lastUsedAt: tx.updatedAt,
        });
      }
    }
  },
  deleteTransaction: async (id) => {
    await db.transactions.delete(id);
    // Su recordatorio se va con el. En Postgres lo hace el ON DELETE
    // CASCADE; aca hay que hacerlo a mano, o quedan huerfanos que ademas
    // el push intentaria subir contra una FK que ya no existe.
    await db.reminders.where('transactionId').equals(id).delete();
    await borrarConLapida('transactions', id);
  },

  listRecurringRules: () => db.recurringRules.toArray(),
  saveRecurringRule: async (rule) => { await db.recurringRules.put(sellar(rule)); },
  deleteRecurringRule: async (id) => { await db.recurringRules.delete(id); await borrarConLapida('recurringRules', id); },

  listBudgets: (year, month) =>
    db.budgets.where('[year+month]').equals([year, month]).toArray(),
  // sellar como el resto: sin updatedAt no hay con que decidir cual copia
  // gana al sincronizar entre dispositivos.
  saveBudget: async (budget) => { await db.budgets.put(sellar(budget)); },

  listReminders: () => db.reminders.toArray(),
  saveReminder: async (reminder) => { await db.reminders.put(sellar(reminder)); },

  async exportAll() {
    const [settings, categories, paymentMethods, transactions, recurringRules, budgets, reminders] =
      await Promise.all([
        db.settings.toArray(), db.categories.toArray(), db.paymentMethods.toArray(),
        db.transactions.toArray(), db.recurringRules.toArray(), db.budgets.toArray(),
        db.reminders.toArray(),
      ]);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings, categories, paymentMethods, transactions, recurringRules, budgets, reminders,
    };
  },

  async importAll(data) {
    const parsed = BackupSchema.parse(data); // el caller (UI) ya debe haber validado con parseBackupFile
    await importBackup(parsed);
  },
};
