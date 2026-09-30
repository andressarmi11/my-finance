# Auditoría de seguridad — Step up

Fecha: 2026-09-30 · Alcance: código (`src/`), Supabase (migraciones y RLS, Edge Functions, `config.toml`), CI/CD (`.github/workflows`), dependencias (`npm audit`), CSP y configuración del build (`vite.config.ts`), secretos en el repo y en su historial.

## Resumen

**No hay hallazgos críticos ni altos.** El proyecto ya tiene una base sólida:

- **RLS en todas las tablas**, con políticas "solo tus filas". La función de limpieza `security definer` tiene revocado el acceso de `anon` y `authenticated`.
- **Sin secretos en el repo ni en su historial.** Solo aparece la anon key, que es pública por diseño. Los secretos de servidor (service role, VAPID, CRON_SECRET, Turnstile) viven en Supabase.
- **Edge Functions autenticadas:**
  - `send-reminders` exige `CRON_SECRET` y lo compara en tiempo constante.
  - `ingest` usa un token de un solo propósito guardado con hash SHA-256, con límite por minuto, tope de pendientes y tope de largo (y, desde esta auditoría, de tamaño de cuerpo).
- **Validación de entradas:**
  - La importación de backups pasa por `zod`.
  - Las expresiones regulares del parser de texto tienen cuantificadores acotados (ya se corrigió un ReDoS).
  - React escapa todo: no hay `dangerouslySetInnerHTML`, `eval` ni `innerHTML`.
- **CSP** con `script-src 'self'`, `object-src 'none'`, `base-uri` y `form-action` restringidos, y `connect-src` limitado a Supabase y a la API de tasas.
- **Auth:** confirmación de correo obligatoria, contraseña de mínimo 8 caracteres también en el servidor, y captcha (Turnstile). El cambio de contraseña reautentica antes.
- **CI/CD:** las actions están fijadas por SHA, los permisos son mínimos (`contents: read`) y hay `concurrency`.

## Hallazgos

| # | Severidad | Dónde | Vulnerabilidad | Impacto |
|---|---|---|---|---|
| S1 | **Media** | `package.json:25` (`react-router-dom ^6.28.0` → instalada 6.30.6) | `npm audit`: GHSA-wrjc-x8rr-h8h6 (open redirect con barra invertida en `<Link>`/`useNavigate`) y GHSA-337j-9hxr-rhxg (este solo aplica a SSR, que la app no usa). | Un enlace armado con `\\` podría navegar fuera del sitio. La app no navega a rutas que vengan del usuario, así que la explotación es poco probable. Igual es una dependencia vulnerable. |
| S2 | **Media** | `supabase/functions/ingest/index.ts:70` | El token del Atajo viaja en la **query string** (GET). Queda en el historial del Atajo, en logs de proxies y en los logs de invocación. | Si el token se filtra, alguien puede **agregar** textos a la bandeja del usuario, hasta 20/min y 300 pendientes. No puede leer ni borrar. |
| S3 | Baja | Hosting en GitHub Pages; CSP por `<meta>` en `vite.config.ts:57-71` | GitHub Pages no permite cabeceras propias y `frame-ancestors` **no funciona dentro de `<meta>`**. Sin eso, la app se puede embeber en un iframe ajeno (clickjacking). | Un sitio malicioso podría superponer la app e inducir toques (por ejemplo "Eliminar"). Requiere que el usuario abra ese sitio con la sesión activa. |
| S4 | Baja | `src/lib/fxRates.ts` (`tableFromApi`) | La tasa de un tercero se acepta si es positiva, sin ningún control de rango. | Si la API se equivoca o es comprometida, un gasto en USD se guardaría con un monto absurdo. La tasa se ve en la hoja antes de guardar, lo que mitiga. |
| S5 | Baja | Repo (commit "chore(repo): sin Dependabot") | No hay alertas automáticas de dependencias vulnerables. | Una CVE nueva (como S1) pasa desapercibida hasta la próxima auditoría. |
| S6 | Info | Supabase Auth | La protección contra contraseñas filtradas (HaveIBeenPwned) y la MFA no están activas. La primera requiere el plan Pro. | Contraseñas débiles o reutilizadas, protegidas solo por el mínimo de 8 caracteres y el captcha. |
| S7 | Info | `supabase/manual/0003_reminder_cron.sql:32` | La plantilla manual tiene `'Bearer REEMPLAZAR_CON_TU_CRON_SECRET'` en texto plano. La migración 0010, que es la usada, lee el secreto de Vault. | Si alguien copia la plantilla y pega el secreto real, queda en texto plano en `cron.job`. |
| S8 | Info | `vite.config.ts:62` | `style-src 'unsafe-inline'`, necesario por los estilos en línea de React. | Solo permite inyectar CSS, no scripts. Aceptable. |

## Plan de acción y diffs

### S1 — Actualizar react-router (requiere confirmación: es un salto de versión mayor)

La versión corregida es 7.18.4 o superior. La API que usa la app (`createBrowserRouter`, `Link`, `NavLink`, `useNavigate`, `useSearchParams`, `Navigate`) existe igual en v7.

```diff
--- a/package.json
+++ b/package.json
@@
-    "react-router-dom": "^6.28.0",
+    "react-router-dom": "^7.18.4",
```

Luego `npm install` y correr todos los e2e. En v7 cambian algunos valores por defecto que en v6 eran *future flags* (`v7_startTransition`, `v7_relativeSplatPath`); hay que revisar que la navegación y el scroll no cambien.

### S2 — Token del Atajo por cabecera (requiere confirmación: cambia cómo se arma el Atajo)

Aceptar `Authorization: Bearer <token>` (POST) y mantener el GET un tiempo, marcado como obsoleto:

```diff
--- a/supabase/functions/ingest/index.ts
+++ b/supabase/functions/ingest/index.ts
@@
-  const token = (datos.token ?? '').trim();
+  // Header first: it doesn't end up in URLs, histories or proxy logs.
+  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
+  const token = (bearer || datos.token || '').trim();
```

Y actualizar `docs/ATAJOS_IOS.md` para que el Atajo use "Obtener contenido de la URL" con método POST y la cabecera `Authorization`. Cuando todos migren, quitar la rama GET.

### S3 — Evitar el embebido en iframes

Opción A, sin cambiar de hosting: un *frame-buster* al arrancar.

```diff
--- a/src/main.tsx
+++ b/src/main.tsx
@@
+// GitHub Pages can't send `frame-ancestors`/`X-Frame-Options`: refuse to run
+// inside someone else's frame (clickjacking).
+if (window.top !== window.self) {
+  window.top!.location.href = window.self.location.href;
+  throw new Error('Framed');
+}
```

Opción B, recomendada si se cambia de hosting (por ejemplo a Cloudflare Pages), con un archivo `_headers`:

```
/*
  Content-Security-Policy: frame-ancestors 'none'
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), geolocation=(), microphone=(self)
```

### S4 — Control de rango de la tasa

```diff
--- a/src/lib/fxRates.ts
+++ b/src/lib/fxRates.ts
@@ export function tableFromApi(base: string, fetchedOn: string, json: unknown): RateTable | null {
+  // A rate that moved more than 30 % since the last table is not trusted:
+  // the cached one stays and the sheet says "tasa del {fecha}".
```

La implementación compara con la tabla en caché y descarta las monedas cuyo valor se aleja más de ±30 %. Se hace si confirmas, porque cambia qué tasa se usa en un caso límite.

### S5 — Alertas de dependencias (manual, sin código)

GitHub → Settings → Code security → activar **Dependabot alerts**. Solo las alertas, sin PRs automáticos, así respeta la decisión de "sin Dependabot" para las actualizaciones.

### S6 — Endurecer Auth (manual)

- Supabase → Authentication → Policies → activar **Leaked password protection**, disponible en el plan Pro.
- Opcional: MFA por TOTP para quien la quiera activar.

### S7 — Plantilla manual del cron

```diff
--- a/supabase/manual/0003_reminder_cron.sql
+++ b/supabase/manual/0003_reminder_cron.sql
@@
-      'Authorization', 'Bearer REEMPLAZAR_CON_TU_CRON_SECRET'
+      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
```

**Aplicado**: es solo documentación, sin riesgo, porque la migración 0010 ya usa Vault.

## Qué apliqué en esta auditoría

- `supabase/functions/ingest/index.ts`: rechazo 413 de cuerpos de más de 16 KB antes de leerlos (cierra un vector de abuso de CPU con un token filtrado).
- `supabase/functions/send-reminders/index.ts`: los logs ya no guardan el objeto de error del push, que incluía el *endpoint* del dispositivo (una URL-capacidad). Solo se registra el código de estado.
- `src/lib/fxRates.ts`: timeout de 8 s en la consulta de tasas.
- `supabase/manual/0003_reminder_cron.sql`: la plantilla ya lee el secreto de Vault (S7).

Lo demás (S1–S4) espera tu confirmación. S5 y S6 son configuración de paneles.
