import { test as base, expect } from '@playwright/test';

/**
 * Uses Playwright's raw test, not the fixture: what's under test here is
 * precisely the screen the fixture skips.
 */
base('the initial setup asks for name, currency, pay periods and categories', async ({ page }) => {
  await page.goto('');

  // 1. Name — it won't let you continue empty.
  await expect(page.getByText('¿Cómo quieres que te llamemos?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  await page.getByLabel('Tu nombre').fill('Andrés');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // 2. Currency.
  await expect(page.getByText('¿En qué moneda manejas tu plata?')).toBeVisible();
  await page.getByRole('button', { name: /Dólar/ }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // 3. How often you get paid. Biweekly by default.
  await expect(page.getByText('¿Cada cuánto te entra la plata?')).toBeVisible();
  await expect(page.getByRole('button', { name: /Dos veces al mes/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Primer pago').fill('5');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // 4. Categories — remove one and finish.
  await expect(page.getByText('¿Cuáles categorías usas?')).toBeVisible();
  await page.getByRole('button', { name: /Viajes/ }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();

  // It's in the app, greets by name and already uses the chosen currency.
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Te queda en');
  await expect(page.getByText('$2,', { exact: false }).first()).toBeVisible();

  // The chosen pay period wins (Home names only today's period now, so the
  // list is where both show), and the removed category is nowhere to be seen.
  await page.goto('movimientos');
  await expect(page.getByText('Quincena del 5')).toBeVisible();
  await page.goto('movimientos?nuevo=1');
  await expect(page.getByRole('button', { name: /Viajes/ })).toBeHidden();
});

base('it does not ask again once configured', async ({ page }) => {
  await page.goto('');
  await page.getByLabel('Tu nombre').fill('Andrés');
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('¿Cómo quieres que te llamemos?')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();
});

/**
 * The monthly alternative. The app was born organizing money into
 * half-month pay periods and that was hard-wired everywhere: the days were
 * a fixed tuple of two, the screen always asked for the Q1 and Q2 keys, and
 * Home drew two boxes. For someone paid once a month that was useless.
 */
base('you can choose to be paid once a month', async ({ page }) => {
  await page.goto('');
  await page.getByLabel('Tu nombre').fill('Andrés');
  await page.getByRole('button', { name: 'Siguiente' }).click(); // currency
  await page.getByRole('button', { name: 'Siguiente' }).click(); // how often

  await page.getByRole('button', { name: /Una vez al mes/ }).click();
  await expect(page.getByRole('button', { name: /Una vez al mes/ })).toHaveAttribute('aria-pressed', 'true');

  // A single day field, not two.
  await expect(page.getByLabel('Día de pago')).toBeVisible();
  await expect(page.getByLabel('Primer pago')).toBeHidden();
  await expect(page.getByText(/Tu mes va del 1 al último día/)).toBeVisible();

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();

  // Home shows ONE period, named after the month, not two pay periods.
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Te queda en');
  await expect(page.getByText(/Quincena del/)).toBeHidden();
  // Count the boxes, not just check they don't say "quincena": the real
  // bug was that TWO came out, both called "Septiembre" and the second at
  // zero, because the month balance wasn't given the pay days.
  await expect(page.getByText('Septiembre', { exact: true })).toHaveCount(1);

  // And the list groups by month, without mentioning pay periods.
  await page.goto('movimientos');
  await expect(page.getByText(/Quincena del/)).toBeHidden();
});

/**
 * Changing your mind later has to work just the same: it's a setting, not
 * an irreversible day-one decision.
 */
base('you can switch to monthly later, from Settings', async ({ page }) => {
  await page.goto('');
  await page.getByLabel('Tu nombre').fill('Andrés');
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Andrés' })).toBeVisible();

  // Settings is a grouped list now (redesign §7): "Cómo te pagan" is its own screen.
  await page.goto('ajustes');
  await page.getByRole('link', { name: /^Cómo te pagan/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cómo te pagan' })).toBeVisible();
  await page.getByRole('button', { name: 'Una vez al mes' }).click();

  await expect(page.getByText('Tu mes empieza el día')).toBeVisible();
  await expect(page.getByText('Segundo pago, día')).toBeHidden();

  await page.goto('');
  await expect(page.getByText(/Quincena del/)).toBeHidden();
});
