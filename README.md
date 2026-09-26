# Step up

Aplicación personal de finanzas, pensada en **quincenas** y en pesos
colombianos. Responde tres preguntas en tres segundos: cuánto me queda en
la quincena del 10, cuánto en la del 25, y cuánto en el mes.

Funciona completa sin ninguna cuenta ni configuración — todo vive en tu
dispositivo. Instalable como PWA en iPhone. Respaldo en la nube y
notificaciones push son opcionales (ver abajo).

## Empezar

```bash
git clone https://github.com/<tu-usuario>/step-up.git
cd step-up
npm install
npm run dev
```

Abre `http://localhost:5173/step-up/` y toca "Cargar datos de
ejemplo" para ver la app funcionando de una vez.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run test` | 209 tests unitarios (Vitest) |
| `npm run test:e2e` | 17 flujos end-to-end (Playwright), en Chromium y Safari móvil |
| `npm run preview:iphone` | Abre la app en un iPhone simulado (WebKit); levanta el dev server solo. `-- --shots` deja capturas en `preview-shots/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, sin emitir (incluye `typecheck:e2e` por separado para `e2e/`) |

## Documentación

| Archivo | Para qué |
|---|---|
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | Cómo usar cada pantalla |
| [docs/CUENTA.md](docs/CUENTA.md) | Cuenta, sincronización entre dispositivos y setup de Supabase |
| [docs/ATAJOS_IOS.md](docs/ATAJOS_IOS.md) | Dictar gastos, y automatizar desde el SMS del banco con Atajos |
| [mobile/README.md](mobile/README.md) | App nativa en Flutter: estado del port y cómo correrla |
| [docs/APP_NATIVA.md](docs/APP_NATIVA.md) | Por qué PWA primero, y el orden del port a Flutter |
| [DEPLOYMENT.md](DEPLOYMENT.md) | De este código a tu iPhone, paso a paso |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Cómo está armado por dentro |
| [docs/FINANCIAL_LOGIC.md](docs/FINANCIAL_LOGIC.md) | Cómo se calcula cada número |
| [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) | Cómo funcionan los recordatorios push |
| [docs/TESTING.md](docs/TESTING.md) | Qué está probado y cómo correrlo |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guía de estilo del código |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios por fase |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Memoria de decisiones entre sesiones de desarrollo |

## Stack

React 18 + TypeScript estricto + Vite · Dexie (IndexedDB) · Supabase
(Postgres + Auth + Edge Functions, opcional) · Recharts · Vitest +
Playwright · vite-plugin-pwa.

## Estado

Las 17 fases del roadmap original están completas. Ver `CHANGELOG.md`
para el detalle de cada una y `TODO.md` para las mejoras opcionales que
quedan abiertas (multi-dispositivo en tiempo real, más filtros en la
lista de movimientos, metas de ahorro).
