import { test, expect } from './fixtures';

/**
 * BARRA.md: Ajustes → Tema y barra sets how see-through the tab bar is.
 * Choosing Cristal puts a strong blur behind the bar (and the + goes glass),
 * the preview follows, and it survives a reload — it's applied before the
 * first paint from localStorage.
 */
test.use({ viewport: { width: 390, height: 844 } });

test('Cristal: the bar gets its blur, and it survives a reload', async ({ page }) => {
  await page.goto('ajustes/tema');
  const bar = page.getByRole('navigation', { name: 'Navegación principal' });
  const add = page.getByRole('button', { name: 'Agregar movimiento' });
  const filter = () => bar.evaluate((el) => getComputedStyle(el).backdropFilter);

  // Default: Translúcida, 88 %.
  const style = page.getByRole('group', { name: 'Estilo de la barra' });
  await expect(style.getByRole('button', { name: 'Translúcida' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(filter).toContain('blur(20px)');

  await style.getByRole('button', { name: 'Cristal' }).click();
  await expect(page.getByRole('slider', { name: 'Opacidad' })).toHaveValue('40');
  await expect(page.getByRole('switch', { name: 'Botón + también transparente' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Cristal: se ve lo que hay detrás')).toBeVisible();
  await expect.poll(filter).toContain('blur(26px)');
  // The + takes the glass: no longer the solid accent.
  await expect.poll(() => add.evaluate((el) => getComputedStyle(el).backdropFilter)).toContain('blur(26px)');

  await page.reload();
  await expect.poll(filter).toContain('blur(26px)');
  await expect(page.getByRole('group', { name: 'Estilo de la barra' }).getByRole('button', { name: 'Cristal' })).toHaveAttribute('aria-pressed', 'true');

  // Sólida: no filter at all, and the + back to solid.
  await page.getByRole('group', { name: 'Estilo de la barra' }).getByRole('button', { name: 'Sólida' }).click();
  await expect.poll(filter).toBe('none');
  await expect(page.getByRole('switch', { name: 'Botón + también transparente' })).toHaveAttribute('aria-checked', 'false');

  // A slider value between the shortcuts selects none of them.
  await page.getByRole('slider', { name: 'Opacidad' }).fill('63');
  for (const name of ['Sólida', 'Translúcida', 'Cristal']) {
    await expect(page.getByRole('group', { name: 'Estilo de la barra' }).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
  }
  await page.goto('ajustes');
  await expect(page.getByRole('link', { name: /Tema y barra.*63%/ })).toBeVisible();
});
