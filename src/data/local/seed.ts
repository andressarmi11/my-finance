import { db } from '../db';
import { DEFAULT_CATEGORIES } from '@/domain/seed/defaultCategories';
import { DEFAULT_PAYMENT_METHODS } from '@/domain/seed/defaultPaymentMethods';
import { DEFAULT_SETTINGS } from './localRepository';

/**
 * Old colors of the seeded categories, before the generated system. Used
 * to recognize a category the user did NOT customize: if its color is
 * still the old default, it gets updated to the new one; if they changed
 * it by hand, it's respected. Without this, only fresh installs would
 * ever see the new color system.
 */
const LEGACY_COLORS: Record<string, string> = {
  'cat-hogar': '#5B6FE0', 'cat-alimentacion': '#E0A23B', 'cat-transporte': '#3BA3E0',
  'cat-entretenimiento': '#C15BD1', 'cat-viajes': '#3BC1A3', 'cat-salud': '#E05B5B',
  'cat-suscripciones': '#8A5CF6', 'cat-compras': '#D18A5B', 'cat-educacion': '#5B8AD1',
  'cat-servicios': '#B0721A', 'cat-deudas': '#B3261E', 'cat-ahorro': '#1E8E6A',
};

async function migrateCategoryColors(): Promise<void> {
  const fresh = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.color]));
  const existingRows = await db.categories.toArray();
  const toUpdate = existingRows.filter(
    (c) => LEGACY_COLORS[c.id] !== undefined
      && c.color.toUpperCase() === LEGACY_COLORS[c.id]!.toUpperCase()
      && fresh.get(c.id) !== undefined,
  );
  if (toUpdate.length === 0) return;
  await db.categories.bulkPut(toUpdate.map((c) => ({ ...c, color: fresh.get(c.id)! })));
}

/**
 * Runs once when the app opens. Doesn't overwrite anything that already
 * exists: it's safe to call on every start-up.
 */
export async function ensureSeedData(): Promise<void> {
  const [categoryCount, paymentMethodCount, settings, txCount] = await Promise.all([
    db.categories.count(),
    db.paymentMethods.count(),
    db.settings.get('singleton'),
    db.transactions.count(),
  ]);

  if (categoryCount === 0) await db.categories.bulkPut(DEFAULT_CATEGORIES);
  else await migrateCategoryColors();
  if (paymentMethodCount === 0) await db.paymentMethods.bulkPut(DEFAULT_PAYMENT_METHODS);

  if (!settings) {
    await db.settings.put(DEFAULT_SETTINGS);
    return;
  }

  // Anyone who was already using the app doesn't have `onboardedAt` (the
  // field didn't exist). If there are already transactions, it's clearly
  // not their first time: it's marked as onboarded so the initial
  // questionnaire doesn't get thrown at them on top of their data.
  if (settings.onboardedAt === undefined || settings.onboardedAt === null) {
    if (txCount > 0) {
      await db.settings.put({ ...settings, onboardedAt: new Date().toISOString() });
    }
  }
}
