import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base debe coincidir con el nombre del repo en GitHub Pages:
// https://<usuario>.github.io/step-up/
export default defineConfig({
  base: '/step-up/',
  plugins: [
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
        // theme_color/background_color en claro; el modo oscuro real lo
        // define la app en runtime via prefers-color-scheme (ver index.html)
        background_color: '#F2F2F7',
        theme_color: '#007AFF', // SystemBlue, igual que --q10 en tokens.css
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
      },
      devOptions: { enabled: false },
    }),
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
