import { copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base debe coincidir con el nombre del repo en GitHub Pages:
// https://<usuario>.github.io/step-up/
/**
 * GitHub Pages sirve archivos estaticos: /step-up/legal no es un archivo y
 * devolvia 404 en visita fria. Afectaba a TODAS las rutas, no solo a
 * legal — compartir un enlace a cualquier pantalla fallaba. La PWA lo
 * tapaba una vez instalada, via el navigateFallback de Workbox, asi que
 * solo lo veia quien llegaba por primera vez o por un enlace compartido.
 *
 * Pages usa 404.html para cualquier ruta desconocida. Siendo una copia de
 * index.html, la app arranca igual y el router resuelve la URL.
 *
 * (El status sigue siendo 404 para los rastreadores. Para una app privada
 * de finanzas eso da igual; si algun dia importa el SEO, la alternativa es
 * el redirect de spa-github-pages.)
 */
function copiarIndexA404() {
  return {
    name: 'copiar-index-a-404',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist/', import.meta.url));
      copyFileSync(`${dist}index.html`, `${dist}404.html`);
    },
  };
}

/**
 * Content-Security-Policy, build only. GitHub Pages can't send headers, so
 * it goes in a <meta>. The app has no inline scripts and talks to exactly
 * one origin, its Supabase; this is the second wall if an XSS ever slips
 * in — the session lives in localStorage, and without a CSP an injected
 * script could send it anywhere.
 *
 * Not in dev: Vite injects inline scripts there (React refresh) that this
 * would block. frame-ancestors is ignored in a <meta>, so it isn't listed.
 */
function contentSecurityPolicy(): Plugin {
  let supabase = '';
  // Cloudflare Turnstile (sign-in captcha) loads a script and an iframe from
  // here. Only allowed when the build actually has a captcha key.
  let captcha = '';
  return {
    name: 'content-security-policy',
    apply: 'build',
    configResolved(config) {
      supabase = config.env.VITE_SUPABASE_URL ?? '';
      captcha = config.env.VITE_TURNSTILE_SITE_KEY ? ' https://challenges.cloudflare.com' : '';
    },
    transformIndexHtml() {
      const policy = [
        "default-src 'self'",
        `script-src 'self'${captcha}`,
        `frame-src 'self'${captcha}`,
        // React sets style attributes and the charts inline theirs.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        // open.er-api.com: today's exchange rates (src/lib/fxRates.ts).
        `connect-src 'self' https://open.er-api.com${supabase ? ` ${new URL(supabase).origin}` : ''}`,
        "worker-src 'self'",
        "manifest-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; ');
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
    },
  };
}

// Shown in the footer: the version baked into the code that is RUNNING,
// so after a deploy it's plain whether the phone already has it.
// Bumped by hand in package.json on every change: patch = small fix,
// minor = new feature, major = big overhaul.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: '/step-up/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  plugins: [
    contentSecurityPolicy(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icons/favicon-64.png'],
      manifest: {
        id: '/step-up/',
        name: 'Step up',
        short_name: 'Step up',
        description: 'Finanzas personales por quincenas, para Colombia.',
        lang: 'es-CO',
        start_url: '/step-up/',
        scope: '/step-up/',
        display: 'standalone',
        // El splash usa el --paper oscuro, igual que el tile del ícono 1c.
        // El color real de cada tema lo define la app en runtime via
        // prefers-color-scheme (ver index.html).
        background_color: '#0B0D12',
        theme_color: '#0B0D12',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + assets con cache-first (via el precache de Workbox).
        // No hay llamadas de red propias que cachear todavia (todo es
        // IndexedDB local); esto se revisa de nuevo en la Fase 13.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/step-up/index.html',
        // Sin esto quedan cachés de despliegues viejos apuntando a
        // archivos con hash que ya no existen: el import de Análisis
        // fallaba y la pantalla quedaba en blanco.
        cleanupOutdatedCaches: true,
        // Push lives in its own file (public/push-sw.js): Workbox generates
        // this worker and has no notion of push, so without it every
        // reminder reached the phone and nothing displayed it.
        importScripts: ['push-sw.js'],
      },
      devOptions: { enabled: false },
    }),
    // Despues de VitePWA: necesita el index.html ya procesado.
    copiarIndexA404(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
