import { test, expect } from './fixtures';

/**
 * A modal has to trap the keyboard.
 *
 * None of the eleven sheets did: with Tab the focus went to the buttons
 * BEHIND the modal, which are still there and still clickable. For anyone
 * navigating by keyboard or screen reader, the modal didn't exist: they
 * typed inside a window and the focus showed up on the screen underneath.
 */

/** Is the focus still inside the dialog? */
function focoDentro(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const activeRecognizer = document.activeElement;
    if (!activeRecognizer || activeRecognizer === document.body) return false;
    return Boolean(activeRecognizer.closest('[role="dialog"]'));
  });
}

test('focus does not escape the modal with Tab', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await expect(page.getByRole('dialog', { name: 'Acción rápida' })).toBeVisible();

  // Many more passes than the dialog has controls: if it escapes anywhere,
  // 30 tabs will find it.
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    expect(await focoDentro(page), `se escapó en el Tab n.º ${i + 1}`).toBe(true);
  }

  // And backwards, which is where it escaped first.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await focoDentro(page), `se escapó con Shift+Tab n.º ${i + 1}`).toBe(true);
  }
});

test('Escape closes the modal and focus returns to the button that opened it', async ({ page }) => {
  await page.goto('');
  const abridor = page.getByRole('button', { name: 'Agregar movimiento' });
  // Opened with the keyboard, not the mouse, because that's who this is
  // about: in Safari a click doesn't focus the button (an iOS convention),
  // so on close there'd be no previous focus to return to — nothing to fix
  // there. Someone navigating by keyboard does arrive focused, and that's
  // the person who lost their focus to the top of the page.
  await abridor.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Acción rápida' });
  await expect(sheet).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // Without this the focus was lost to the top of the page and you had to
  // tab from scratch to get back where you were.
  await expect(abridor).toBeFocused();
});

test('a long form also traps the keyboard and closes with Escape', async ({ page }) => {
  await page.goto('ajustes/categorias');
  await page.getByRole('button', { name: /Nueva categoría|\+ Nueva/ }).first().click();

  const dialogo = page.getByRole('dialog', { name: 'Nueva categoría' });
  await expect(dialogo).toBeVisible();

  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(await focoDentro(page), `se escapó en el Tab n.º ${i + 1}`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
});

/**
 * The app's main button had its action on onPointerUp, which means it only
 * responded to finger and mouse. With the keyboard it did nothing — and
 * VoiceOver activates by sending a click, so anyone using a screen reader
 * couldn't add a transaction.
 */
test('a transaction can be added without touching the screen', async ({ page }) => {
  await page.goto('');
  const fab = page.getByRole('button', { name: 'Agregar movimiento' });
  await fab.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Acción rápida' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Acción rápida' })).toBeHidden();

  // And with the space bar, which is the other way to activate a button.
  await fab.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog', { name: 'Acción rápida' })).toBeVisible();
});
