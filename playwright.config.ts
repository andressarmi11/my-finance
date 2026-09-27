import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE = `http://localhost:${PORT}/step-up/`;

// The account-isolation test imports SOURCE modules so it can call the
// local-data guard directly; preview serves a bundle where those aren't
// reachable. That's why it runs against the dev server, on its own port.
const PORT_DEV = 5173;
const BASE_DEV = `http://localhost:${PORT_DEV}/step-up/`;
// These import SOURCE modules, so they go against the dev server.
//
// It matches FILE NAMES: renaming one of those specs without touching this
// line silently moves it onto the preview build, where its imports 404 and
// it fails in a way that looks like the app broke.
const SOURCE_IMPORTING = /account-isolation|sync-duplicate-occurrences|xlsx-is-a-zip/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    /**
     * Pinned language. The app picks its language from navigator.language,
     * and Playwright's browser reports en-US, so the whole suite silently
     * flipped to English the day the interface became bilingual: every
     * spec written against Spanish labels waited 30s for a button that now
     * said "Save", and a 50s run turned into 20 minutes.
     *
     * Pinning is the right call regardless of that bug: a suite whose
     * language depends on the machine running it is not deterministic.
     * The one spec that checks auto-detection overrides this with en-US.
     */
    locale: 'es-CO',
  },
  webServer: [
    {
      // Forces fully local mode for E2E — no AuthGate in front of the dashboard.
      command: 'VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run build && npm run preview -- --port 4173',
      url: BASE,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run dev -- --port ${PORT_DEV}`,
      url: BASE_DEV,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'chromium', testIgnore: SOURCE_IMPORTING, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', testIgnore: SOURCE_IMPORTING, use: { ...devices['iPhone 13'] } },
    {
      name: 'isolation',
      testMatch: SOURCE_IMPORTING,
      use: { ...devices['Desktop Chrome'], baseURL: BASE_DEV },
    },
  ],
});
