/**
 * Rasteriza la marca (src/components/ui/Logo.tsx) a los PNG que el manifest
 * y iOS exigen — ninguno de los dos acepta SVG para el ícono de inicio.
 *
 * Usa el Chromium de Playwright, que ya está instalado para los e2e, en vez
 * de sumar sharp/resvg solo para esto. Se corre a mano cuando cambia la
 * marca: `node scripts/generar-iconos.mjs`.
 *
 * El SVG está duplicado acá a propósito. Importar el .tsx obligaría a montar
 * React y un bundler dentro de un script de build; son veinte líneas de
 * geometría que cambian una vez cada nunca. Si tocas Logo.tsx, tocá esto.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

/** `maskable` deja el margen que Android se puede comer al recortar en círculo. */
function svg({ maskable = false } = {}) {
  // Android recorta hasta el 20% de cada borde: el glifo se achica y el
  // fondo azul se estira a todo el lienzo, sin esquinas redondeadas.
  const escala = maskable ? 1.15 : 1.6;
  const off = (64 - 24 * escala) / 2;
  const rx = maskable ? 0 : 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0A84FF"/><stop offset="1" stop-color="#0051D5"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="${rx}" fill="url(#g)"/>
  <g transform="translate(${off} ${off}) scale(${escala})">
    <rect x="2"  y="13" width="6" height="8"  rx="2" fill="#FFFFFF"/>
    <rect x="9"  y="8"  width="6" height="13" rx="2" fill="#FFFFFF"/>
    <rect x="16" y="3"  width="6" height="18" rx="2" fill="#FFB340"/>
  </g>
</svg>`;
}

const salidas = [
  { archivo: 'public/icons/favicon-64.png', px: 64 },
  { archivo: 'public/icons/icon-192.png', px: 192 },
  { archivo: 'public/icons/icon-512.png', px: 512 },
  { archivo: 'public/icons/icon-maskable-512.png', px: 512, maskable: true },
  // iOS ignora el redondeo del PNG y recorta él mismo, pero el suyo es un
  // squircle más cerrado: si el PNG ya viene redondeado quedan orejas.
  { archivo: 'public/apple-touch-icon.png', px: 180, maskable: true },
];

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await mkdir(new URL('public/icons/', new URL(raiz, 'file:')), { recursive: true }).catch(() => {});

for (const { archivo, px, maskable } of salidas) {
  await pagina.setViewportSize({ width: px, height: px });
  await pagina.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${px}px;height:${px}px}</style>${svg({ maskable })}`,
  );
  const png = await pagina.locator('svg').screenshot({ omitBackground: true });
  await writeFile(new URL(archivo, new URL(raiz, 'file:')), png);
  console.log('✓', archivo, `${px}×${px}`);
}

await navegador.close();
