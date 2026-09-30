import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

async function withDemoData(page: Page) {
  await page.goto('');
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  // The button hides before the seed commits; under a loaded machine a
  // navigation right after it aborted the write. Wait for the rows.
  await expect.poll(() => page.evaluate(() => new Promise<number>((resolve) => {
    const open = indexedDB.open('myfinance_v1');
    open.onsuccess = () => {
      const req = open.result.transaction('transactions').objectStore('transactions').count();
      req.onsuccess = () => resolve(req.result);
    };
  }))).toBeGreaterThan(0);
}

test('the analytics navigator sits beside the title, its arrows never move, Today shows up beside them, and loading never sticks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await withDemoData(page);
  await page.getByRole('link', { name: 'Análisis' }).click();

  const prev = page.getByRole('button', { name: 'Período anterior' });
  const next = page.getByRole('button', { name: 'Período siguiente' });
  const today = page.getByRole('button', { name: 'Volver al período actual' });
  // Settled = nothing on screen is still loading the period.
  const settled = () => expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 10_000 });
  // Busy ends on its own.
  await settled();
  await expect(prev).toBeEnabled();

  // Redesign (prototype 1a): on the title's row, at its right edge.
  const title = (await page.getByRole('heading', { level: 1, name: 'Análisis' }).boundingBox())!;
  const edge = async () => { const n = (await next.boundingBox())!; return n.x + n.width; };
  const start = await edge();
  expect(start).toBeGreaterThan(390 - 40);
  expect(Math.abs((await next.boundingBox())!.y - title.y)).toBeLessThan(title.height);
  await expect(today).toHaveCount(0);

  await prev.click();
  await settled();
  await expect(today).toBeVisible();
  expect((await today.boundingBox())!.x).toBeLessThan((await prev.boundingBox())!.x); // on the inside
  expect(await edge()).toBeCloseTo(start, 0); // the arrows didn't move

  await today.click();
  await settled();
  await next.click();
  await settled();
  await expect(today).toBeVisible();
  expect(await edge()).toBeCloseTo(start, 0);

  // A year ahead generates a year of recurring payments: still finishes.
  await page.getByRole('button', { name: /^año$/i }).click();
  await next.click();
  await settled();
  await expect(next).toBeEnabled();
});

test('the day list in the calendar has separators between rows, none after the last', async ({ page }) => {
  // Two movements today, so the day has two rows to separate.
  for (const [concept, amount] of [['Primero de hoy', '12000'], ['Segundo de hoy', '8000']] as const) {
    await page.goto('movimientos?nuevo=1');
    const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
    await dialog.getByPlaceholder('¿En qué fue? ej. Almuerzo').fill(concept);
    await dialog.getByLabel('Valor', { exact: true }).fill(amount);
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog).toBeHidden();
  }

  // The calendar is a view of Movimientos now, behind Lista | Calendario.
  await page.getByRole('button', { name: 'Calendario' }).click();
  await expect(page).toHaveURL(/vista=calendario/);
  const rows = page.locator('.divided > *');
  await expect(rows).toHaveCount(2);
  const borders = await rows.evaluateAll((els) =>
    els.map((r) => ({ top: getComputedStyle(r).borderTopWidth, bottom: getComputedStyle(r).borderBottomWidth })));
  expect(borders).toEqual([
    { top: '0px', bottom: '0px' }, // nothing above the first
    { top: '1px', bottom: '0px' }, // one line between them, nothing trailing
  ]);
});
