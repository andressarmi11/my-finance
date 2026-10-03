import { test, expect, type Page } from '@playwright/test';
import { fakeBackend, inbox, signIn, signInDesktop } from './cloudFake';

/**
 * Bandeja v2 (BANDEJA.md): what arrives on its own is reviewed one at a
 * time. A missing amount keeps "Anotar" off until it's typed; recording
 * leaves a 5 s "Deshacer" that puts the entry back and removes what was
 * recorded. And a notification's /?revisar=<id> opens the review on it.
 *
 * Runs in the cloud-sync project (see playwright.config.ts): a build pointed
 * at a fake Supabase that this spec answers, inbox included.
 */

/** Transactions saved in the app's IndexedDB, read without going through the app. */
function saved(page: Page) {
  return page.evaluate(() => new Promise<Array<{ concept: string; amount: number; source?: string; sourceLabel?: string }>>((resolve, reject) => {
    const open = indexedDB.open('myfinance_v1');
    open.onsuccess = () => {
      const req = open.result.transaction('transactions').objectStore('transactions').getAll();
      req.onsuccess = () => { open.result.close(); resolve(req.result); };
      req.onerror = () => reject(req.error);
    };
    open.onerror = () => reject(open.error);
  }));
}

test('review one by one: type the missing amount, record, undo', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 390, height: 844 } });
  const { patches } = await fakeBackend(context, inbox());
  const page = await context.newPage();
  await signIn(page);

  // No banner: the header button with its count, and the card on Inicio.
  await expect(page.getByRole('button', { name: 'Abrir movimientos por revisar: 2' })).toBeVisible();
  const card = page.getByRole('region', { name: 'Por revisar' });
  await expect(card.getByRole('heading', { name: '2 por revisar' })).toBeVisible();
  await expect(card).toContainText('Falta el monto');

  // Straight to Uber, the one without an amount.
  await card.getByRole('button', { name: /Uber/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Por revisar' });
  await expect(sheet).toContainText('2 de 2');
  await expect(sheet).toContainText('No pude leer el monto');
  const record = sheet.getByRole('button', { name: 'Anotar', exact: true });
  await expect(record).toBeDisabled();

  await sheet.getByLabel('Monto').fill('18000');
  await expect(sheet).toContainText('Monto escrito por ti');
  await expect(record).toBeEnabled();
  await record.click();

  const toast = page.getByRole('status').filter({ hasText: 'Anotado · Uber' });
  await expect(toast).toBeVisible();
  await expect.poll(() => patches).toContainEqual({ id: 'e-uber', status: 'done' });
  await expect.poll(async () => (await saved(page)).find((t) => t.concept === 'Uber'))
    .toMatchObject({ amount: 18_000, source: 'sms', sourceLabel: 'Bancolombia' });
  // It moved on to the next one.
  await expect(sheet.getByLabel('Concepto')).toHaveValue(/Restaurante/i);
  // The undo toast doesn't cover the next one's buttons: the sheet makes room.
  await expect.poll(async () => {
    const button = (await record.boundingBox())!;
    const bar = (await toast.boundingBox())!;
    return button.y + button.height <= bar.y;
  }).toBe(true);

  // The concept takes spaces between words, as typed.
  const concept = sheet.getByLabel('Concepto');
  await concept.fill('');
  await concept.pressSequentially('Pago de arriendo');
  await expect(concept).toHaveValue('Pago de arriendo');

  await toast.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(() => patches).toContainEqual({ id: 'e-uber', status: 'pending' });
  await expect.poll(async () => (await saved(page)).some((t) => t.concept === 'Uber')).toBe(false);
  // Back on Uber, pending again, keeping what was typed (as the prototype does).
  await expect(sheet.getByLabel('Concepto')).toHaveValue('Uber');
  await expect(sheet.getByLabel('Monto')).toHaveValue('18.000');

  // Record it for real and find its trace in Movimientos.
  await record.click();
  await expect(page.getByRole('status').filter({ hasText: 'Anotado · Uber' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(sheet).toBeHidden();

  await page.goto('movimientos');
  const row = page.getByRole('button', { name: /^Uber/ }).first();
  await expect(row.getByRole('img', { name: 'Llegó solo' })).toBeVisible();
  await row.click();
  await expect(page.getByText('Origen: SMS Bancolombia')).toBeVisible();
  await context.close();
});

test("a notification's ?revisar=<id> opens the review on that entry", async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 390, height: 844 } });
  await fakeBackend(context, inbox());
  const page = await context.newPage();
  await signIn(page);

  await page.goto('?revisar=e-uber');
  const sheet = page.getByRole('dialog', { name: 'Por revisar' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Concepto')).toHaveValue('Uber');
  await expect(page).not.toHaveURL(/revisar=/);
  await context.close();
});

test('desktop: the side panel, where ⌫ discards and ⏎ records', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 1440, height: 900 } });
  const { patches } = await fakeBackend(context, inbox());
  const page = await context.newPage();
  await signInDesktop(page);

  await page.getByRole('button', { name: 'Abrir movimientos por revisar: 2' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Por revisar' });
  // Measured once the entry animation has settled.
  await expect.poll(async () => Math.round((await page.getByTestId('inbox-panel').boundingBox())!.width)).toBe(480);

  // The newest first: Restaurante, complete. ⌫ discards it, no questions asked.
  await expect(dialog.getByLabel('Concepto')).toHaveValue(/Restaurante/i);
  await expect(dialog.getByRole('button', { name: /^Anotar/ })).toBeFocused();
  await page.keyboard.press('Backspace');
  await expect(page.getByRole('status').filter({ hasText: 'Descartado · Restaurante' })).toBeVisible();
  await expect.poll(() => patches).toContainEqual({ id: 'e-cielo', status: 'discarded' });

  // Uber: the amount field takes the focus; type it and ⏎ records.
  await expect(dialog.getByLabel('Monto')).toBeFocused();
  await page.keyboard.type('18000');
  await page.keyboard.press('Enter');
  await expect.poll(() => patches).toContainEqual({ id: 'e-uber', status: 'done' });
  await expect(dialog).toContainText('Todo revisado');
  await expect(dialog).toContainText('1 anotados · 1 descartados');
  await context.close();
});
