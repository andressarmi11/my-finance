import { test, expect, type Page } from '@playwright/test';
import { fakeBackend, inbox, signIn, signInDesktop, type Entry } from './cloudFake';

/**
 * BANDEJA-WEB.md: moving between what arrived on its own without recording
 * or discarding. Phone: ‹ ›, a swipe on the card, the progress segments.
 * Desktop: the side panel's queue, ↑/↓ and Esc. What was typed in one
 * entry is still there after moving away and back.
 */

function three(): Entry[] {
  return [
    ...inbox(),
    { id: 'e-juan', texto: 'Nequi: Recibiste $120.000 de JUAN PEREZ.', origen: 'atajo', created_at: new Date(Date.now() - 6 * 60_000).toISOString(), status: 'pending' },
  ];
}

/** A horizontal mouse drag across the card (the swipe also answers the mouse). */
async function swipe(page: Page, dx: number) {
  const box = (await page.getByTestId('inbox-card').boundingBox())!;
  const y = box.y + 14;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y);
  await page.mouse.move(x + dx, y + 4);
  await page.mouse.up();
}

test('phone: › and a swipe move without deciding, and typed values survive', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 390, height: 844 } });
  const { patches } = await fakeBackend(context, three());
  const page = await context.newPage();
  await signIn(page);

  await page.getByRole('button', { name: 'Abrir movimientos por revisar: 3' }).click();
  const sheet = page.getByRole('dialog', { name: 'Por revisar' });
  const concept = sheet.getByLabel('Concepto');
  await expect(sheet).toContainText('1 de 3');
  await expect(concept).toHaveValue(/Restaurante/i);
  await expect(sheet.getByRole('button', { name: 'Anterior' })).toBeDisabled();

  await sheet.getByRole('button', { name: 'Siguiente' }).click();
  await expect(sheet).toContainText('2 de 3');
  await expect(concept).toHaveValue(/Juan/i);

  // Swipe left: the next one (Uber, without an amount). Type it.
  await swipe(page, -160);
  await expect(sheet).toContainText('3 de 3');
  await expect(concept).toHaveValue('Uber');
  await expect(sheet.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  await sheet.getByLabel('Monto').fill('18000');

  // Swipe right, then back with a tap on the last segment: still 18.000.
  await swipe(page, 160);
  await expect(sheet).toContainText('2 de 3');
  await sheet.getByRole('group', { name: 'Progreso de la revisión' }).getByRole('button', { name: '3 de 3' }).click();
  await expect(concept).toHaveValue('Uber');
  await expect(sheet.getByLabel('Monto')).toHaveValue('18.000');

  // Nothing was decided on the way.
  expect(patches).toEqual([]);
  await context.close();
});

test('desktop: the panel lists the queue; ↓, a click on it and Esc', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 1440, height: 900 } });
  await fakeBackend(context, three());
  const page = await context.newPage();
  await signInDesktop(page);

  // From the sidebar, on any screen.
  await page.goto('analisis');
  const nav = page.getByRole('complementary', { name: 'Barra lateral' });
  await nav.getByRole('button', { name: 'Abrir movimientos por revisar: 3' }).click();
  const panel = page.getByRole('dialog', { name: 'Por revisar' });
  const concept = panel.getByLabel('Concepto');
  await expect(panel).toContainText('1 de 3');
  // The whole queue, and the original message always open.
  const queue = panel.getByRole('list', { name: 'Por revisar' });
  await expect(queue.getByRole('listitem')).toHaveCount(3);
  await expect(queue).toContainText('Sin monto');
  await expect(panel).toContainText('Mensaje original');
  await expect(panel).toContainText('Bancolombia: Compraste');

  await page.keyboard.press('ArrowDown');
  await expect(panel).toContainText('2 de 3');
  await expect(concept).toHaveValue(/Juan/i);

  await queue.getByRole('listitem').filter({ hasText: 'Uber' }).click();
  await expect(panel).toContainText('3 de 3');
  await expect(concept).toHaveValue('Uber');
  await expect(queue.locator('[aria-current="true"]')).toContainText('Uber');

  // ↑ while typing in a field still moves; ← doesn't (it moves the caret).
  await concept.click();
  await page.keyboard.press('ArrowLeft');
  await expect(panel).toContainText('3 de 3');
  await page.keyboard.press('ArrowUp');
  await expect(panel).toContainText('2 de 3');

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await context.close();
});
