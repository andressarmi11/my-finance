import type { Page } from '@playwright/test';

/**
 * Three complete months of history (the three before the current one), as
 * "Ayúdame a ahorrar" reads it: rent (fixed), groceries plus deliveries,
 * rides, entertainment, subscriptions, shopping, health, savings and a
 * salary. Written straight into IndexedDB, then the page reloads.
 */
export async function seedThreeMonths(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const now = new Date();
    const rows: Array<Record<string, unknown>> = [];
    let n = 0;
    const add = (y: number, m: number, d: number, type: string, categoryId: string | null, concept: string, amount: number) => {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      rows.push({
        id: `seed-${++n}`, type, concept, amount, date, categoryId, paymentMethodId: 'pm-debito', status: 'paid',
        quincenaKey: null, createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`,
      });
    };
    for (let back = 3; back >= 1; back--) {
      const t = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const y = t.getFullYear(); const m = t.getMonth() + 1;
      add(y, m, 1, 'income', null, 'Salario', 8_000_000);
      add(y, m, 2, 'expense', 'cat-hogar', 'Arriendo', 2_500_000);
      add(y, m, 3, 'expense', 'cat-alimentacion', 'Mercado', 600_000);
      for (let i = 0; i < 5; i++) add(y, m, 5 + i * 4, 'expense', 'cat-alimentacion', 'Rappi', 60_000);
      for (let i = 0; i < 8; i++) add(y, m, 4 + i * 3, 'expense', 'cat-transporte', 'Uber', 25_000);
      add(y, m, 6, 'expense', 'cat-transporte', 'Bus', 100_000);
      add(y, m, 10, 'expense', 'cat-entretenimiento', 'Cine', 120_000);
      add(y, m, 18, 'expense', 'cat-entretenimiento', 'Concierto', back === 1 ? 400_000 : 250_000);
      add(y, m, 7, 'expense', 'cat-suscripciones', 'Netflix', 45_000);
      add(y, m, 7, 'expense', 'cat-suscripciones', 'Spotify', 17_000);
      add(y, m, 12, 'expense', 'cat-compras', 'Ropa', 200_000);
      add(y, m, 22, 'expense', 'cat-compras', 'Zapatos', 180_000);
      add(y, m, 15, 'expense', 'cat-salud', 'Farmacia', 120_000);
      add(y, m, 28, 'expense', 'cat-ahorro', 'Ahorro', 1_000_000);
    }
    const open = indexedDB.open('myfinance_v1');
    open.onsuccess = () => {
      const tx = open.result.transaction('transactions', 'readwrite');
      for (const r of rows) tx.objectStore('transactions').put(r);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
}
