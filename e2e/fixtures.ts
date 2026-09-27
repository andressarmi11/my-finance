import { test as base, expect, type Page } from '@playwright/test';

/**
 * Every Playwright test already runs in its own isolated browser context
 * (separate storage/IndexedDB), so there's no need to clear the database by
 * hand between tests — each one starts from scratch.
 *
 * But "from scratch" now includes the initial setup, which shows up the
 * first time. This fixture completes it with default values so each test
 * still starts on the screen it cares about. The flow itself is tested
 * separately, in 10-initial-setup.spec.ts.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  // waitFor, not isVisible(): isVisible() asks at that instant, and on
  // WebKit the app takes longer to mount than goto() takes to resolve, so
  // it returned false and the fixture skipped the whole setup.
  const name = page.getByLabel('Tu nombre');
  await name.waitFor({ state: 'visible', timeout: 15_000 });

  await name.fill('Tester');

  // Advance UNTIL "Empezar" appears, instead of firing three blind clicks
  // in a row. That was a race: between one click and the next React can
  // re-render the step, and the click landed on a button that was no longer
  // mounted. With few tests it almost never showed; with a file of ten, in
  // parallel, it failed ~1 in 8.
  //
  // It also stops depending on the steps being exactly four.
  const startButton = page.getByRole('button', { name: 'Empezar' });
  for (let i = 0; i < 8 && !(await startButton.isVisible().catch(() => false)); i++) {
    await page.getByRole('button', { name: 'Siguiente' }).click();
  }
  await startButton.click();
  await expect(name).toBeHidden();
}

export const test = base.extend<object>({
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page);
    let firstNavigation = true;
    page.goto = async (url, options) => {
      const response = await originalGoto(url, options);
      if (firstNavigation) {
        firstNavigation = false;
        await completeOnboarding(page);
      }
      return response;
    };
    await use(page);
  },
});

export { expect };
