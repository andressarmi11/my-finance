import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Redesign §9g — desktop (≥1100px): a sidebar instead of the tab bar, Inicio
 * in two columns with Movimientos embedded as a table, ⌘K / Ctrl+K for the
 * search, "Nuevo movimiento" as a 780px dialog with the calendar always
 * visible, and Ajustes as a list beside its panel.
 */
test.use({ viewport: { width: 1440, height: 900 } });

async function withSampleData(page: Page) {
  await page.goto('');
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  // Wait for the rows, not the region (it's there empty too): the seed
  // commits after the button hides, and a goto() before that aborts it.
  const table = page.getByRole('region', { name: 'Movimientos' });
  await expect(table.getByTestId('tx-table-row').filter({ hasText: 'Mercado' }).first()).toBeVisible();
}

test('a sidebar with the three tabs, the pay period and the account; no tab bar', async ({ page }) => {
  await page.goto('');
  const sidebar = page.getByRole('complementary', { name: 'Barra lateral' });
  await expect(sidebar).toBeVisible();
  const nav = sidebar.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Análisis', 'Ajustes']);

  // The pay period you're in, with how far along it is.
  const period = sidebar.getByRole('region', { name: 'Período actual' });
  await expect(period).toContainText(/Quincena del (10|25)/);
  await expect(period).toContainText(/día \d+ de \d+/);
  await expect(period.getByRole('progressbar')).toBeVisible();

  // The account, local here: no cloud in this build.
  await expect(sidebar).toContainText('Tester');
  await expect(sidebar).toContainText('Solo en este dispositivo');

  // The phone's + isn't there: desktop has "Nuevo movimiento" in the header.
  await expect(page.getByRole('button', { name: 'Agregar movimiento' })).toHaveCount(0);

  const box = (await sidebar.boundingBox())!;
  expect(Math.round(box.width)).toBe(248);

  await nav.getByRole('link', { name: 'Análisis' }).click();
  await expect(page).toHaveURL(/\/analisis$/);
});

test('Inicio in two columns, Movimientos as a table; /movimientos lands on Inicio', async ({ page }) => {
  await withSampleData(page);

  const columns = page.getByTestId('home-columns');
  const left = columns.locator('> div').first();
  expect(Math.round((await left.boundingBox())!.width)).toBe(410);

  const table = page.getByRole('region', { name: 'Movimientos' });
  // Header row and one row per transaction, in the table's columns.
  await expect(table.getByText('Concepto', { exact: true })).toBeVisible();
  await expect(table.getByText('Método', { exact: true })).toBeVisible();
  const row = table.getByTestId('tx-table-row').filter({ hasText: 'Mercado' }).first();
  await expect(row).toBeVisible();
  const cols = await row.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(6);

  // Folding a period group keeps working on desktop.
  const group = table.getByRole('button', { name: /Plegar o desplegar Quincena del/ }).first();
  await group.click();
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  await group.click();
  await expect(group).toHaveAttribute('aria-expanded', 'true');

  // The calendar replaces the table with the whole month.
  await table.getByRole('button', { name: 'Calendario' }).click();
  await expect(page).toHaveURL(/vista=calendario/);
  const cell = table.getByRole('button', { name: /\d+ de \w+/ }).first();
  expect((await cell.boundingBox())!.height).toBeGreaterThanOrEqual(88);

  // Movimientos is already on screen: its old path lands here.
  await page.goto('movimientos');
  await expect(page).toHaveURL(/\/step-up\/$/);
  await expect(page.getByRole('region', { name: 'Movimientos' })).toBeVisible();
});

test('selecting in the table: a bar on top, and deleting asks with the list and the total', async ({ page }) => {
  await withSampleData(page);
  const table = page.getByRole('region', { name: 'Movimientos' });
  await table.getByRole('button', { name: 'Seleccionar', exact: true }).click();
  await table.getByRole('button', { name: /Seleccionar Mercado/ }).click();
  const bar = page.getByRole('toolbar', { name: /selecci/i });
  await expect(bar).toContainText('1 seleccionado');
  await expect(bar.getByRole('button', { name: 'Marcar pagado' })).toBeEnabled();
  await bar.getByRole('button', { name: 'Eliminar' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('Mercado');
  await expect(confirm).toContainText('Suman');
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirm).toBeHidden();
});

test('⌘K / Ctrl+K focuses the search, from any screen, and it filters the table', async ({ page }) => {
  await withSampleData(page);
  await page.goto('analisis');
  // Wait for the app to be mounted (Análisis is lazy): a key pressed before
  // the shortcut's listener exists does nothing.
  await expect(page.getByRole('heading', { level: 1, name: 'Análisis' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page).toHaveURL(/\/step-up\/$/);
  const search = page.getByRole('searchbox', { name: 'Buscar movimientos' });
  await expect(search).toBeFocused();
  await page.keyboard.type('Gasolina');
  const table = page.getByRole('region', { name: 'Movimientos' });
  await expect(table.getByTestId('tx-table-row')).toHaveCount(1);
  await expect(table.getByTestId('tx-table-row')).toContainText('Gasolina');
});

test('"Nuevo movimiento": the menu as a dialog, then a 780px form with the calendar; Esc closes', async ({ page }) => {
  await withSampleData(page);
  await page.getByRole('button', { name: 'Nuevo movimiento' }).click();
  const menu = page.getByRole('dialog', { name: 'Acción rápida' });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: /Nuevo gasto/ }).click();

  const form = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await expect(form).toBeVisible();
  const panel = form.locator('> div').first();
  // offsetWidth: the box scales in for a moment as it opens.
  expect(await panel.evaluate((el) => (el as HTMLElement).offsetWidth)).toBe(780);
  // Gasto | Ingreso | Recurrente on top, the month always visible.
  const type = form.getByRole('group', { name: 'Tipo de movimiento' });
  await expect(type.getByRole('button')).toHaveText(['Gasto', 'Ingreso', 'Recurrente']);
  await expect(form.getByRole('button', { name: 'Mes anterior' })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Hoy', exact: true })).toBeVisible();

  // Typed with the physical keyboard; saves like the phone.
  await expect(form.getByLabel('Valor')).toBeFocused();
  await page.keyboard.type('45000');
  await form.getByLabel('Concepto').fill('Almuerzo de escritorio');
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole('region', { name: 'Movimientos' })).toContainText('Almuerzo de escritorio');

  // Esc closes it.
  await page.getByRole('button', { name: 'Nuevo movimiento' }).click();
  await page.getByRole('dialog', { name: 'Acción rápida' }).getByRole('button', { name: /Nuevo ingreso/ }).click();
  await expect(form).toBeVisible();
  await expect(type.getByRole('button', { name: 'Ingreso' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(form).toBeHidden();
});

test('Ajustes in two panels: the list stays, the screen opens beside it', async ({ page }) => {
  await page.goto('ajustes');
  // Desktop opens on the profile.
  await expect(page).toHaveURL(/\/ajustes\/cuenta$/);
  const list = page.getByRole('navigation', { name: 'Secciones de ajustes' });
  await expect(list).toBeVisible();
  expect(Math.round((await list.boundingBox())!.width)).toBe(250);
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();

  await list.getByRole('link', { name: 'Moneda' }).click();
  await expect(page).toHaveURL(/\/ajustes\/moneda$/);
  await expect(page.getByRole('heading', { name: 'Moneda', level: 1 })).toBeVisible();
  await expect(list).toBeVisible();
  await expect(list.getByRole('link', { name: 'Moneda' })).toHaveAttribute('aria-current', 'page');

  // Idioma and Tema share a screen, and apply at once.
  await list.getByRole('link', { name: 'Idioma y tema' }).click();
  await expect(page.getByRole('region', { name: 'Idioma' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tema' })).toBeVisible();
  await page.getByRole('region', { name: 'Tema' }).getByRole('button', { name: 'Claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Legal: the documents on the left, the one you pick on the right.
  await list.getByRole('link', { name: 'Legal' }).click();
  await expect(page).toHaveURL(/\/ajustes\/legal$/);
  await page.getByRole('button', { name: /Política de privacidad/ }).click();
  await expect(page).toHaveURL(/\/ajustes\/legal\/privacidad$/);
  await expect(page.getByRole('heading', { level: 2, name: /privacidad/i }).first()).toBeVisible();
});
