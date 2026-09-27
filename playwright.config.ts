import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE = `http://localhost:${PORT}/step-up/`;

// El test de aislamiento entre cuentas importa modulos FUENTE para llamar
// directo al guardia de datos locales; el preview sirve un bundle donde no
// son alcanzables. Por eso corre contra el dev server, en su propio puerto.
const PORT_DEV = 5173;
const BASE_DEV = `http://localhost:${PORT_DEV}/step-up/`;
// Estos importan modulos FUENTE, asi que van contra el dev server.
const SOLO_AISLAMIENTO = /aislamiento-de-cuentas|sync-ocurrencias-duplicadas/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // Fuerza modo 100% local para E2E — sin AuthGate delante del dashboard.
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
    { name: 'chromium', testIgnore: SOLO_AISLAMIENTO, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', testIgnore: SOLO_AISLAMIENTO, use: { ...devices['iPhone 13'] } },
    {
      name: 'aislamiento',
      testMatch: SOLO_AISLAMIENTO,
      use: { ...devices['Desktop Chrome'], baseURL: BASE_DEV },
    },
  ],
});
