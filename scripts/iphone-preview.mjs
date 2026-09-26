/**
 * Previsualiza la app en un iPhone simulado (Playwright + WebKit) sin
 * necesitar Xcode: mismo motor que Safari iOS, viewport, user-agent y
 * safe-area de iPhone.
 *
 *   npm run preview:iphone            -> abre la ventana y te la deja para tocar
 *   npm run preview:iphone -- --shots -> solo capturas en preview-shots/
 *
 * Levanta el dev server solo si no hay uno escuchando ya, y lo baja al
 * salir. No hace falta abrir dos terminales.
 */
import { webkit, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = Number(process.env.PREVIEW_PORT ?? 5199);
const BASE = process.env.PREVIEW_URL ?? `http://localhost:${PORT}/step-up/`;
const SHOTS_ONLY = process.argv.includes('--shots');
const OUT = 'preview-shots';

const PAGES = [
  ['inicio', ''],
  ['movimientos', 'movimientos'],
  ['analisis', 'analisis'],
  ['calendario', 'calendario'],
  ['ajustes', 'ajustes'],
];

async function responde(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return r.status < 500;
  } catch {
    return false;
  }
}

/** Arranca vite si el puerto está libre. Devuelve el proceso, o null si ya había uno. */
async function arrancarServidor() {
  if (await responde(BASE)) {
    console.log(`Usando el servidor que ya está en ${BASE}`);
    return null;
  }

  console.log(`Levantando el dev server en el puerto ${PORT}…`);
  // El binario directo, no `npm run dev`: así matar este pid mata vite de
  // verdad, sin dejar el puerto ocupado para la próxima corrida.
  const proc = spawn('node_modules/.bin/vite', ['--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  proc.on('error', (e) => {
    console.error('No se pudo arrancar vite:', e.message);
    process.exit(1);
  });

  const limite = Date.now() + 30_000;
  while (!(await responde(BASE))) {
    if (proc.exitCode !== null) {
      throw new Error(`vite se cerró con código ${proc.exitCode}. ¿El puerto ${PORT} está ocupado?`);
    }
    if (Date.now() > limite) {
      proc.kill();
      throw new Error(`El dev server no respondió en 30s (${BASE}).`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return proc;
}

const server = await arrancarServidor();
const bajarServidor = () => server?.kill();
process.on('SIGINT', () => { bajarServidor(); process.exit(130); });
process.on('SIGTERM', () => { bajarServidor(); process.exit(143); });

const browser = await webkit.launch({ headless: SHOTS_ONLY });
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], locale: 'es-CO' });
const page = await ctx.newPage();

const errores = [];
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
page.on('pageerror', (e) => errores.push(String(e)));

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Configuración inicial: se captura y luego se completa, para que el
  // resto de las pantallas se vean con datos.
  const nombre = page.getByLabel('Tu nombre');
  if (await nombre.isVisible({ timeout: 8000 }).catch(() => false)) {
    if (SHOTS_ONLY) {
      mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: `${OUT}/configuracion-inicial.png` });
    }
    await nombre.fill('Andrés');
    for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await page.waitForTimeout(600);
  }

  // Si la base está vacía, cargar los datos de ejemplo para que se vea algo.
  const demo = page.getByRole('button', { name: /datos de ejemplo/i });
  if (await demo.count()) {
    await demo.first().click();
    await page.waitForTimeout(1500);
  }

  if (SHOTS_ONLY) {
    mkdirSync(OUT, { recursive: true });
    for (const [nombre, ruta] of PAGES) {
      await page.goto(BASE + ruta, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${nombre}.png` });
    }

    // Chequeo del tab bar: tiene que tocar el borde inferior del viewport.
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const nav = await page.locator('nav[aria-label="Navegación principal"]').boundingBox();
    const vp = page.viewportSize();
    const hueco = Math.round(vp.height - (nav.y + nav.height));
    console.log(`tab bar: alto ${Math.round(nav.height)}px, hueco debajo ${hueco}px (debe ser 0)`);
    console.log('errores de consola:', errores.length ? errores : 'ninguno');
    console.log(`capturas en ${OUT}/`);
  } else {
    console.log('iPhone 14 Pro abierto. Cerrá la ventana para terminar.');
    await page.waitForEvent('close', { timeout: 0 });
  }
} finally {
  await browser.close().catch(() => {});
  bajarServidor();
}
