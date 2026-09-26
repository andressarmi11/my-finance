# Cuenta y sincronización

Con una cuenta, tus datos dejan de vivir solo en el teléfono: entras con
correo y contraseña en cualquier dispositivo y aparece todo.

Esto además resuelve dos cosas que sorprenden en iOS:

- **Instalar la app en la pantalla de inicio "borra" los datos.** No los
  borra: en iOS la app instalada tiene su propio almacenamiento, separado
  del de Safari. Lo que cargaste en la pestaña no cruza. Con cuenta, al
  entrar en la app instalada se baja todo y quedan iguales.
- **Los Atajos abren Safari, no la app instalada.** iOS no sabe meter una
  URL dentro de una web app instalada. Sin cuenta, el gasto que registras
  desde un Atajo se queda en Safari y no lo ves en la app. Con cuenta, los
  dos lados sincronizan contra la misma nube.

---

## Qué hace la app sola

Una vez hay sesión, no hay que tocar ningún botón:

| Cuándo | Qué pasa |
|---|---|
| Al iniciar sesión | Baja todo de la nube antes de mostrar nada |
| Al volver a la app | Sincroniza (máximo una vez por minuto) |
| Al dejar la app | Sube lo que agregaste |
| Al recuperar internet | Reintenta |

Sin internet la app funciona igual; lo pendiente sube en la siguiente
oportunidad. En Ajustes → Tu cuenta hay un **Sincronizar ahora** para
forzarlo.

**Los borrados también viajan.** Cada borrado deja una "lápida"
(`src/data/sync/tombstones.ts`) que se sincroniza como cualquier otro
dato. Sin eso, el dispositivo que todavía tenía la fila la volvería a
subir y lo borrado reaparecería.

---

## Estado actual del setup

| Paso | Estado |
|---|---|
| Migraciones 0001, 0002, 0004, 0005 aplicadas | ✅ hecho |
| `.env.local` con URL y anon key | ✅ hecho |
| Secrets del repo en GitHub Actions | ✅ hecho |
| **Confirm email / Redirect URLs en el dashboard** | ⚠️ falta — pasos 2 abajo |

Lo que falta necesita entrar al dashboard de Supabase: la Management API
está detrás del keychain y el CLI no expone esa configuración.

**Y ojo con la cuenta que ya existe:** `andressarmi11@hotmail.com` se creó
con magic link, así que **no tiene contraseña**. Entrar con correo y
contraseña le va a decir "Correo o contraseña incorrectos". Usa
**¿Olvidaste tu contraseña?** una vez para ponerle una (necesita el paso 2
de Redirect URLs hecho), o crea una cuenta nueva.

## Setup (una sola vez)

### 1. Aplicar las migraciones

En el SQL Editor del proyecto de Supabase, en orden:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_push_subscriptions.sql
supabase/migrations/0004_text_ids_and_profile.sql
supabase/migrations/0005_deletions.sql
```

La **0004 es obligatoria**: sin ella sincronizar falla con
`invalid input syntax for type uuid`. Las categorías que la app siembra
usan ids como `cat-hogar`, y el esquema original las declaraba `uuid`.
También agrega `display_name` y `onboarded_at`.

El cron de recordatorios ya no vive acá: tiene placeholders que hay que
reemplazar a mano, así que está en `supabase/manual/` para que ningún
`db push` lo aplique tal cual. Solo hace falta si vas a usar notificaciones.

### 2. Activar correo + contraseña

Dashboard → **Authentication** → **Sign In / Providers** → **Email**:

- **Enable Email provider**: sí.
- **Confirm email**: hoy está **encendido** (lo comprobé creando y borrando
  una cuenta de prueba: el signup devuelve usuario pero sin sesión).
  Decide tú:
  - **Apagado** — entras apenas creas la cuenta. Más cómodo, y para una
    app personal está bien.
  - **Encendido** — hay que abrir un correo antes de la primera entrada.
    La app lo maneja: muestra "Confirma el correo que te enviamos".

En **URL Configuration**, agrega a *Redirect URLs*:

```
https://<tu-usuario>.github.io/step-up/
http://localhost:5173/step-up/
```

Sin eso, el enlace de "olvidé mi contraseña" no vuelve a la app.

### 3. Las claves, en local y en GitHub

En `.env.local` (no se sube, está en `.gitignore`):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<la anon key del dashboard>
```

Y en GitHub → repo → **Settings** → **Secrets and variables** →
**Actions** → *New repository secret*, los mismos dos nombres. El workflow
de deploy ya los lee.

> La anon key es pública por diseño: va dentro del bundle que descarga el
> navegador. Lo que protege los datos es **RLS** — cada fila lleva
> `user_id` y las políticas solo dejan ver las propias
> (`0001_init.sql`). Por eso la app exige sesión cuando Supabase está
> configurado.

### 4. Comprobar

```bash
npm run dev
```

Debe aparecer la pantalla de **Entrar / Crear cuenta**. Crea la cuenta,
completa la configuración inicial, agrega un gasto. Abre la misma URL en
otro navegador, entra con el mismo correo: tiene que estar ahí.

---

## Si algo falla

| Síntoma | Causa |
|---|---|
| No aparece la pantalla de login | Faltan las env vars; la app corre 100% local |
| `invalid input syntax for type uuid` | Falta aplicar la migración 0004 |
| `relation "public.deletions" does not exist` | Falta la 0005 |
| "Falta confirmar el correo" | *Confirm email* está encendido en Supabase |
| El enlace de contraseña no vuelve a la app | Falta la URL en *Redirect URLs* |
| El enlace de contraseña entra directo sin dejar cambiarla | Era un bug nuestro, arreglado: el enlace abre sesión, y el gate mostraba la app antes de preguntar. Ver `src/features/auth/recovery.ts` |
| Pide nombre y categorías en cada login | Era un bug nuestro, arreglado. Los Settings no tenían `updatedAt`, así que bajar de la nube pisaba lo local a ciegas; y la configuración se completa DESPUÉS del push del login, así que nunca subía. Ver `elegirSettings` en `src/data/sync/syncService.ts` y `pedirSync` en `useCloudSync.ts` |
| Entro en otro dispositivo y no veo nada | Mira Ajustes → Tu cuenta → Sincronizar ahora; si da error, el mensaje dice cuál |
