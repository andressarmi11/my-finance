# Deployment — de tu computador a tu iPhone

Guía paso a paso, de cero, para llevar Step up de este código a una app
instalada en tu teléfono. Nada de esto es obligatorio en orden estricto,
pero sí en dependencia: no puedes instalar en el iPhone sin haber
desplegado, no puedes desplegar sin haber subido a GitHub.

## 0. Lo que necesitas antes de empezar

- Una cuenta de [GitHub](https://github.com) (gratis).
- [Node.js](https://nodejs.org) 20 o superior instalado en tu computador.
- Git instalado.
- **Opcional:** una cuenta de [Supabase](https://supabase.com) (gratis) —
  solo si quieres respaldo en la nube y notificaciones push. Sin esto, la
  app funciona igual de completa, 100% local en tu teléfono.

---

## 1. Correr el proyecto en tu computador

```bash
git clone https://github.com/<tu-usuario>/step-up.git
cd step-up
npm install
npm run dev
```

Abre `http://localhost:5173/step-up/`. Deberías ver el dashboard vacío.
Toca "Cargar datos de ejemplo" para probar que todo funciona.

```bash
npm run test        # 123 tests, todos deben pasar
npm run typecheck   # sin errores
npm run build        # genera dist/
```

Si algo de esto falla, revisa la sección de **Solución de problemas** al
final antes de seguir.

---

## 2. Subir el código a GitHub

Si el proyecto no está en un repositorio todavía:

```bash
git init
git add .
git commit -m "Step up — versión inicial"
```

Crea un repositorio nuevo en GitHub llamado **exactamente** `step-up`
(en minúsculas) — el nombre debe coincidir con `base: '/step-up/'` en
`vite.config.ts`, o la app no encontrará sus propios archivos una vez
publicada. Si prefieres otro nombre, cambia ese `base` primero.

**Importante:** el repositorio debe ser **público**. GitHub Pages gratis
en una cuenta personal no publica sitios desde repos privados.

```bash
git remote add origin https://github.com/<tu-usuario>/step-up.git
git branch -M main
git push -u origin main
```

---

## 3. Activar GitHub Pages

1. En GitHub, ve a tu repositorio → **Settings** → **Pages**.
2. En "Build and deployment" → "Source", elige **GitHub Actions** (no
   "Deploy from a branch" — el workflow ya incluido en
   `.github/workflows/deploy.yml` se encarga de todo).
3. Ve a la pestaña **Actions** de tu repo. Deberías ver un workflow
   "Deploy to GitHub Pages" corriendo (se dispara solo con el push del
   paso anterior). Espera a que termine en verde — toma 1-2 minutos.
4. Tu app ya está en: `https://<tu-usuario>.github.io/step-up/`

Cada vez que hagas `git push` a `main`, este workflow se vuelve a correr
y actualiza el sitio automáticamente.

---

## 4. (Opcional) Configurar Supabase — respaldo en la nube y notificaciones

Sin este paso, la app funciona 100% completa, solo que tus datos viven
únicamente en el navegador de tu teléfono (con export/import manual desde
Ajustes como respaldo). Este paso agrega sincronización real y
notificaciones push.

### 4.1 Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Elige una contraseña de base de datos (guárdala; la necesitarás solo si
   te conectas por `psql`, no para el día a día).
3. Espera 1-2 minutos a que el proyecto termine de crearse.

### 4.2 Aplicar el esquema

En el panel de Supabase → **SQL Editor** → **New query**, pega y ejecuta,
**en este orden**, el contenido de:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_push_subscriptions.sql`

(El tercero, `0003_reminder_cron.sql`, se aplica más adelante, en el paso
4.5 — necesita datos que todavía no tienes.)

### 4.3 Habilitar el login por correo

Panel → **Authentication** → **Providers** → confirma que **Email** esté
habilitado, con "Confirm email" y "Magic Link" activos (vienen así por
defecto). No necesitas configurar OAuth de terceros — la app solo usa
enlace mágico por correo.

### 4.4 Conectar la app a tu proyecto

Panel → **Project Settings** → **API**. Copia:

- **Project URL**
- **anon public** key (la `anon`, **nunca** la `service_role`)

Crea un archivo `.env.local` en la raíz del proyecto (nunca lo subas a
git — ya está en `.gitignore`):

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

Para que el sitio **desplegado** en GitHub Pages también las use, agrega
las mismas dos variables como **Secrets** del repositorio: Settings →
**Secrets and variables** → **Actions** → **New repository secret**. Y
edita `.github/workflows/deploy.yml` para pasarlas al paso de build:

```yaml
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}
```

Vuelve a hacer `npm run dev` — ahora la app te pedirá iniciar sesión con
tu correo antes de mostrar cualquier pantalla. Esto es intencional: el
repo es público, así que la `anon key` queda visible en el código
descargado por cualquiera — sin login (protegido por Row Level Security
en cada tabla), esa key por sí sola no le da acceso a nadie a tus datos.

### 4.5 Notificaciones push (opcional dentro de lo opcional)

Ver **[docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)** — tiene su propia
guía completa (generar llaves VAPID, desplegar la Edge Function,
programar el cron). Es la parte más avanzada de todo el proyecto; sáltala
si por ahora solo quieres el respaldo en la nube.

---

## 5. Instalar en tu iPhone

1. Abre `https://<tu-usuario>.github.io/step-up/` en **Safari** (tiene
   que ser Safari — Chrome en iOS no puede instalar PWAs).
2. Toca el botón de **Compartir** (el cuadrado con la flecha hacia
   arriba).
3. Baja hasta **"Agregar a inicio"** (o "Add to Home Screen").
4. Confirma el nombre y toca **Agregar**.

Ya tienes el ícono de Step up en tu pantalla de inicio, y se abre como
una app — sin la barra de Safari.

Si configuraste notificaciones (paso 4.5), ahora sí puedes activarlas
desde Ajustes: **solo funcionan si abres la app desde este ícono**, nunca
desde una pestaña normal de Safari — así es como Apple lo diseñó.

---

## 6. Actualizar la app después de cambios

```bash
git add .
git commit -m "lo que cambiaste"
git push
```

El workflow de Pages se dispara solo. El ícono en tu iPhone se actualiza
solo la próxima vez que abras la app con internet (el service worker
revisa si hay una versión nueva).

---

## Solución de problemas comunes

| Problema | Causa probable |
|---|---|
| La app se ve en blanco en GitHub Pages, pero funciona en `npm run dev` | El nombre del repo no coincide con `base` en `vite.config.ts` |
| "404" al recargar una pantalla que no sea el inicio | El workflow de deploy no copió `404.html` — revisa que el paso `cp dist/index.html dist/404.html` siga en `deploy.yml` |
| No aparece el botón de "Agregar a inicio" en iOS | Tienes que estar en Safari, no en Chrome ni en el navegador dentro de otra app |
| Las notificaciones no llegan | Revisa `docs/NOTIFICATIONS.md` — hay varios pasos manuales (VAPID, Edge Function, cron) que no se hacen solos |
| `npm install` falla o se cuelga | Verifica tu versión de Node (`node -v`, debe ser 20+); prueba borrar `node_modules` y `package-lock.json` y repetir |
| Cambié `cutoffDay`/`paymentDay` de la tarjeta y las compras viejas cambiaron de fecha de pago | No debería pasar — cada compra guarda su propia fecha calculada (`cyclePaymentDate`) al momento de crearse. Si ves esto, es un bug: abre un issue |
