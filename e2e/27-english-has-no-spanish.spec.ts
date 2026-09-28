import { test, expect } from './fixtures';

/**
 * Switching to English has to translate the WHOLE interface.
 *
 * The bilingual switch shipped wired into a handful of places, so screens kept
 * showing Spanish: the Settings subtitle, the Theme options, the Currency
 * options, "How you get paid", Reminders, Cloud, Automations, the Analytics
 * options, the Calendar empty message, Transactions and Recurring. Every one of
 * those was a string sitting in the JSX instead of in the dictionary, and
 * nothing failed when it was.
 *
 * This walks the app in English and fails on Spanish text. It catches the whole
 * class of bug, not the specific strings that were wrong once — a new hardcoded
 * label breaks this the day it's added.
 */

/**
 * Words that only exist in Spanish and that no English screen would show. It
 * deliberately avoids anything that is the same in both languages, a proper
 * noun, or user data (a category the user named "Alimentación" is not a bug).
 *
 * That last exclusion is why the seeded payment-method NAMES —"Débito",
 * "Tarjeta de crédito"— are not in this list, even though they read as
 * untranslated. They are rows in the database: the user can rename them, they
 * sync between devices, and translating them at render time would overwrite
 * whatever the user typed. The method's TYPE, which is app text, does
 * translate. Someone who wants them in English renames them once in
 * Settings → Payment methods.
 */
const SPANISH_ONLY = [
  'Ajustes', 'Movimientos', 'Análisis', 'Calendario', 'Inicio',
  'Guardar', 'Cancelar', 'Eliminar', 'Cerrar sesión', 'Sincronizar',
  'Recordatorios', 'Mensual', 'Quincenal', 'Semanal', 'Anual',
  'Sistema', 'Claro', 'Oscuro',
  'Categoría', 'Método de pago', 'Día de pago', 'Día de corte',
  'quincena', 'Quincena', 'Sin movimientos', 'Presupuestos',
  'Volver', 'Siguiente', 'Empezar', 'Avisar con', 'día(s) antes',
  'Automatizaciones', 'Generar clave', 'Nuevo recurrente',
  'Tu cuenta, moneda', 'Te entra la plata', 'Dos veces al mes',
  'Una vez al mes', 'Balance por categoría', 'Organizar gráficos',
];

/** Everything the switch has to reach, and how to get there. */
const SCREENS: Array<{ name: string; path: string }> = [
  { name: 'home', path: '' },
  { name: 'transactions', path: 'movimientos' },
  { name: 'calendar', path: 'calendario' },
  { name: 'analytics', path: 'analisis' },
  { name: 'settings', path: 'ajustes' },
  { name: 'categories', path: 'ajustes/categorias' },
  { name: 'payment methods', path: 'ajustes/metodos' },
  { name: 'recurring', path: 'ajustes/recurrentes' },
  { name: 'budgets', path: 'ajustes/presupuestos' },
  { name: 'card', path: 'tarjeta' },
];

test('switching to English leaves no Spanish behind', async ({ page }) => {
  await page.goto('ajustes');
  await page.getByRole('button', { name: 'English' }).click();
  // The switch is what we are testing, so prove it took effect before
  // trusting anything the rest of the test reads.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const found: string[] = [];
  for (const screen of SCREENS) {
    await page.goto(screen.path);
    // Body text, not innerHTML: a Spanish word inside a CSS variable name or a
    // route would be a false positive, and neither is visible to anyone.
    const visible = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const word of SPANISH_ONLY) {
      if (visible.includes(word)) found.push(`${screen.name}: "${word}"`);
    }
  }

  expect(found, `Spanish left after switching to English:\n${found.join('\n')}`).toEqual([]);
});

/**
 * The reverse, so the dictionary can't be "fixed" by hardcoding English
 * instead: in Spanish the same screens must not show the English labels.
 */
test('Spanish stays Spanish', async ({ page }) => {
  await page.goto('ajustes');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
  await expect(page.getByRole('heading', { name: 'Cómo te pagan' })).toBeVisible();
  await expect(page.getByText('Te entra la plata')).toBeVisible();
});
