import type { Page } from '@playwright/test';
import { test, expect, switchLanguage } from './fixtures';
import { TEXTS } from '../src/i18n/texts';

/**
 * Phase 10 (§11 item 12): English everywhere, phone and desktop, screens AND
 * sheets. Spec 27 checks a hand-written word list; this one derives it from
 * the dictionary itself, so a hardcoded Spanish label that reuses app
 * vocabulary is caught the day it's added:
 *
 *   Spanish-only words = words of the Spanish texts that never appear in the
 *   English texts (5+ letters, so "Total" or "Legal" — same in both — can't
 *   be false positives).
 *
 * User data is excluded: seeded category and method names and the sample
 * transactions are Spanish on purpose (they're the user's data, not UI).
 */
const USER_DATA = [
  'Hogar', 'Alimentación', 'Transporte', 'Entretenimiento', 'Viajes', 'Salud', 'Suscripciones',
  'Compras', 'Educación', 'Servicios', 'Deudas', 'Ahorro', 'Otros', 'Salario', 'Ingresos',
  'Débito', 'Tarjeta de crédito', 'Efectivo',
  'Ingreso de ejemplo', 'Arriendo (ejemplo)', 'Suscripción streaming', 'Mercado', 'Gasolina',
  'Cine', 'Zapatos (ejemplo)', 'Gasto programado (ejemplo)',
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

const esWords = words(Object.values(TEXTS.es as Record<string, string>));
const enWords = words(Object.values(TEXTS.en as Record<string, string>));
const userWords = words(USER_DATA);
const SPANISH_ONLY = [...esWords].filter((w) => !enWords.has(w) && !userWords.has(w));

function spanishIn(text: string): string[] {
  const seen = words([text]);
  return SPANISH_ONLY.filter((w) => seen.has(w));
}

const ROUTES = [
  '', 'movimientos', 'movimientos?vista=calendario', 'analisis', 'ajustes', 'ajustes/cuenta',
  'ajustes/cuenta/contrasena', 'ajustes/moneda', 'ajustes/pagos', 'ajustes/recordatorios',
  'ajustes/categorias', 'ajustes/metodos', 'ajustes/recurrentes', 'ajustes/presupuestos',
  'ajustes/atajos', 'ajustes/datos', 'tarjeta', 'legal', 'legal/terminos',
];

async function visible(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

async function sweep(page: Page, width: number): Promise<string[]> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('');
  await page.getByRole('button', { name: 'Load sample data' }).click();
  await expect(page.getByRole('button', { name: 'Load sample data' })).toBeHidden();

  const found: string[] = [];
  const check = async (where: string) => {
    for (const w of spanishIn(await visible(page))) found.push(`${width}px ${where}: "${w}"`);
  };

  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForTimeout(250);
    await check(`/${route}`);
  }

  // Sheets and dialogs: the + menu, the new-transaction sheet with its
  // advanced options, "tell the app", and the breakdown on Home.
  await page.goto('');
  const add = width >= 1100
    ? page.getByRole('button', { name: 'New transaction' })
    : page.getByRole('button', { name: 'Add transaction' });
  await add.first().click();
  await check('quick actions');
  await page.getByRole('button', { name: /^Tell the app/ }).click();
  await page.getByRole('textbox').first().fill('gasté 20 dólares en efectivo en un taxi');
  await check('tell the app');
  await page.keyboard.press('Escape');

  await page.goto('');
  await page.getByRole('button', { name: /^Still to pay/ }).first().click();
  await page.getByRole('button', { name: 'What do these statuses mean?' }).click().catch(() => {});
  await check('still to pay');
  await page.keyboard.press('Escape');

  await page.goto('movimientos?nuevo=1');
  const more = page.getByRole('button', { name: 'More options' });
  if (await more.isVisible().catch(() => false)) await more.click();
  await check('new transaction');
  await page.keyboard.press('Escape');

  await page.goto('movimientos?nuevo=1&tipo=ingreso');
  await check('new income');
  await page.keyboard.press('Escape');

  await page.goto('ajustes/recurrentes?nuevo=1');
  await page.waitForTimeout(250);
  await check('new recurring');

  return found;
}

test('phone: no Spanish in English, screens and sheets', async ({ page }) => {
  expect(SPANISH_ONLY.length).toBeGreaterThan(100);
  await switchLanguage(page, 'English');
  const found = await sweep(page, 390);
  expect(found, `Spanish left in English:\n${found.join('\n')}`).toEqual([]);
});

test('desktop: no Spanish in English, screens and sheets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await switchLanguage(page, 'English');
  const found = await sweep(page, 1440);
  expect(found, `Spanish left in English:\n${found.join('\n')}`).toEqual([]);
});

test('the detector works: the Spanish interface is flagged', async ({ page }) => {
  await page.goto('ajustes');
  const flagged = spanishIn(await visible(page));
  expect(flagged.length).toBeGreaterThan(5);
});
