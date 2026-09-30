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

// Two-browser sync runs against a build whose Supabase is a fake
// `.test` host the spec answers with route() — real login, real sync,
// nothing leaves the machine.
const PORT_SYNC = 5174;
// The sign-in screen spec runs there too (it is the only build that has it),
// and so does the sign-out / change-password flow, which needs a session.
const CLOUD_SYNC = /cloud-sync|login-redesign|logout-clear-local|inbox-review/;

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
    {
      // The production build, not dev: it carries the Content-Security-Policy
      // and the service worker, so a policy that blocked login or sync
      // fails here. Its own outDir so it doesn't race the other build — under
      // node_modules/.cache, which git and ESLint already ignore.
      // Cloudflare's public always-pass test key: the build carries the
      // captcha and its CSP; the spec answers the Turnstile script itself.
      command: `VITE_SUPABASE_URL=http://fake-supabase.test VITE_SUPABASE_ANON_KEY=fake-anon-key VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA npx vite build --outDir node_modules/.cache/dist-sync --emptyOutDir && npx vite preview --outDir node_modules/.cache/dist-sync --port ${PORT_SYNC} --strictPort`,
      url: `http://localhost:${PORT_SYNC}/step-up/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'cloud-sync', testMatch: CLOUD_SYNC, use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PORT_SYNC}/step-up/` } },
    { name: 'chromium', testIgnore: [SOURCE_IMPORTING, CLOUD_SYNC], use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', testIgnore: [SOURCE_IMPORTING, CLOUD_SYNC], use: { ...devices['iPhone 13'] } },
    {
      name: 'isolation',
      testMatch: SOURCE_IMPORTING,
      use: { ...devices['Desktop Chrome'], baseURL: BASE_DEV },
    },
  ],
});
