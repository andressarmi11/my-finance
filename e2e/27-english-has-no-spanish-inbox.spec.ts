import { test, expect } from '@playwright/test';
import { TEXTS } from '../src/i18n/texts';
import { fakeBackend, inbox, signIn, signInDesktop } from './cloudFake';
import { switchLanguage } from './fixtures';

/**
 * Extends 27-english-has-no-spanish to the inbox (BANDEJA-WEB.md): the
 * phone's sheet and the desktop panel, in English, have no Spanish left.
 * It lives apart because the inbox needs a signed-in cloud build (the
 * cloud-sync project); 27 runs on the local-only one.
 *
 * Spanish-only words are derived from the dictionary, as in 48. The
 * entries' own text — a bank's SMS, a merchant — is user data, not UI.
 */
const USER_DATA = [
  ...inbox().map((e) => e.texto), 'Restaurante el cielo', 'Uber',
  'Alimentación', 'Transporte', 'Débito', 'Tarjeta de crédito', 'Efectivo', 'Otros',
];

function words(values: string[]): Set<string> {
  const out = new Set<string>();
  for (const v of values) {
    for (const w of v.replace(/\{[^}]*\}/g, ' ').split(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/)) {
      if (w.length >= 5) out.add(w.toLowerCase());
    }
  }
  return out;
}
const enWords = words(Object.values(TEXTS.en as Record<string, string>));
const userWords = words(USER_DATA);
const SPANISH_ONLY = [...words(Object.values(TEXTS.es as Record<string, string>))].filter((w) => !enWords.has(w) && !userWords.has(w));
const spanishIn = (text: string) => { const seen = words([text]); return SPANISH_ONLY.filter((w) => seen.has(w)); };

test('phone: the inbox card and the review sheet in English', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 390, height: 844 } });
  await fakeBackend(context, inbox());
  const page = await context.newPage();
  await signIn(page);
  await switchLanguage(page, 'English');
  await page.goto('');

  const card = page.getByRole('region', { name: 'To review' });
  await expect(card).toContainText('2 to review');
  expect(spanishIn(await card.innerText())).toEqual([]);

  await page.getByRole('button', { name: 'Open items to review: 2' }).click();
  const sheet = page.getByRole('dialog', { name: 'To review' });
  await expect(sheet).toContainText('1 of 2');
  await sheet.getByRole('button', { name: /See original message/ }).click();
  expect(spanishIn((await sheet.innerText()).replace(/Bancolombia:.*$/m, ''))).toEqual([]);
  await expect(sheet.getByRole('button', { name: 'Next' })).toBeVisible();
  await context.close();
});

test('desktop: the inbox panel in English', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', viewport: { width: 1440, height: 900 } });
  await fakeBackend(context, inbox());
  const page = await context.newPage();
  await signInDesktop(page);
  await switchLanguage(page, 'English');
  await page.goto('');

  await page.getByRole('complementary', { name: 'Sidebar' }).getByRole('button', { name: 'Open items to review: 2' }).click();
  const panel = page.getByRole('dialog', { name: 'To review' });
  await expect(panel).toContainText('Original message');
  await expect(panel).toContainText('No amount');
  const text = (await panel.innerText()).split('\n').filter((l) => !l.startsWith('Bancolombia:')).join('\n');
  expect(spanishIn(text)).toEqual([]);
  await context.close();
});
