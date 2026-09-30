# Auditoría de costos — Step up

Fecha: 2026-09-30 · Alcance: `src/`, `supabase/` (migraciones, funciones, cron), `.github/workflows/`, `vite.config.ts`, `package.json`, `.env.example`.

## Resumen

- **No hay llamadas a IA/LLM** en el proyecto: ni el dictado ni el parser (`src/domain/nlp`) usan un modelo, todo es local y determinista. No hay agentes ni loops de reintento contra APIs pagas.
- **No hay listeners en tiempo real** (Supabase Realtime), ni polling con `setInterval`, ni subida de archivos a Storage.
- Las dos Edge Functions ya tienen autenticación, topes y timeouts. La sincronización tiene un intervalo mínimo de 60 s y se agrupa con debounce.
- **El mayor riesgo de costo es el egress de la sincronización**: cada ciclo descarga listas completas (hallazgo C1). No importa con 100 usuarios, pero es lo primero que pasa del plan gratuito.

## Hallazgos

| # | Severidad | Dónde | Qué pasa y por qué cuesta | Peor escenario | Optimización |
|---|---|---|---|---|---|
| C1 | **Alta** | `src/data/sync/syncService.ts:322` (`listTransactionVersions()`), `:191-196` y `:324-334` | Cada ciclo de sync (al abrir la app, al volver a ella y ~1,5 s después de cada cambio, con un mínimo de 60 s) hace dos cosas. Baja **id + updated_at de todos los movimientos** del usuario (crece con el historial). Y pide **dos veces** —en el pull y en el push— categorías, métodos, recurrentes, settings, **todos** los presupuestos y **todos** los recordatorios vigentes. | 100.000 usuarios × ~8 ciclos/día × ~160 KB ≈ **1,5 TB/mes de egress**, 6× lo que incluye el plan Pro. | **(requiere confirmación)** (a) Reusar en el push las listas remotas que ya bajó el pull. (b) Un cursor local de push: subir solo lo que cambió desde el último push exitoso, en vez de comparar contra todas las versiones remotas. (c) Presupuestos solo del rango de meses visible. Estimado: 5–10× menos egress. |
| C2 | Media | `supabase/migrations/0001_init.sql:136` (y las políticas de 0002/0005/0006) | Las políticas RLS usan `auth.uid() = user_id`: Postgres evalúa `auth.uid()` **fila por fila**. Con tablas grandes sube el CPU de cada consulta del sync. | Con cientos de miles de filas, consultas más lentas y más cómputo; podría forzar un add-on de cómputo antes de tiempo. | **(requiere confirmación, es una migración)** Reescribir las políticas con `(select auth.uid()) = user_id`, que Postgres evalúa una sola vez por consulta (recomendación oficial de Supabase). |
| C3 | Media | `src/lib/fxRates.ts:17` | La tasa del día sale de open.er-api.com, gratis y sin clave. Cada dispositivo la pide **una vez al día** y solo si usa otra moneda. El plan gratuito tiene límites que no publican en detalle **(supuesto)**. | A escala, la API podría responder 429: sin tasa no se puede guardar un gasto en otra moneda. Es un riesgo de disponibilidad más que de gasto. | **Aplicado:** timeout de 8 s y respaldo con la última tabla guardada. **Propuesto (requiere confirmación):** una Edge Function que pida la tasa **una vez al día para todos** y la guarde en una tabla; los clientes leen de ahí (1 request/día en total). |
| C4 | Media | `supabase/config.toml:38` (`enable_confirmations = true`) | El SMTP incluido en Supabase manda solo un puñado de correos por hora (confirmación y recuperación de contraseña). | Con más de ~10 registros por hora, los correos fallan con "email rate limit exceeded". No es gasto, pero bloquea el crecimiento. | Configurar SMTP propio (Resend, SendGrid, Postmark) en el panel. Tiene costo: ver la tabla de abajo. |
| C5 | Baja | `vite.config.ts:121` (`globPatterns`) | El service worker precarga **todos** los JS en cada deploy, así que cada dispositivo activo vuelve a bajar ~340 KB comprimidos por deploy. GitHub Pages tiene un límite **blando** de 100 GB/mes. | 100.000 usuarios × 4 deploys/mes × 0,34 MB ≈ **136 GB/mes**: por encima del límite blando. GitHub puede pedir mover el sitio. | **Aplicado:** se quitó `recharts` (ya no se usaba) y `zod` + backup se cargan solo al exportar o importar. **Propuesto:** a escala, publicar en Cloudflare Pages (ancho de banda sin tope en el plan gratuito) o agrupar deploys. |
| C6 | Baja | `supabase/functions/ingest/index.ts` | La función del Atajo de iOS ya tenía token con hash, 20/min por usuario, máximo 300 pendientes y 2.000 caracteres. Pero leía el JSON **completo** antes de validar su tamaño. | Alguien con un token filtrado manda cuerpos de varios MB: CPU facturado por invocación. | **Aplicado:** se rechaza con 413 cualquier cuerpo de más de 16 KB **antes** de leerlo. |
| C7 | Baja | `supabase/functions/send-reminders/index.ts` + `0015_reminder_v2.sql` | El cron corre cada 10 min: 4.320 invocaciones/mes fijas. En la Fase 7 ya quedaron los topes: 500 por corrida, 10 s por push, 60 s por corrida, sin auto-invocación y sin doble envío. | Acotado por diseño. | **Aplicado:** no se envía el aviso de un movimiento ya pagado o cancelado (Fase 7). En los logs de error queda solo el código de estado, no el objeto completo con la URL del dispositivo. |
| C8 | Baja | `.github/workflows/ci.yml` | Los e2e ahora corren 3 proyectos (~5 min por push a un PR). `cancel-in-progress` y `timeout-minutes: 25` ya estaban. | Repo privado: 2.000 min/mes gratis; después se cobra por minuto **(precio: supuesto, ver el panel de GitHub)**. | Poner el **spending limit de Actions en $0** en GitHub, así un exceso se bloquea en lugar de cobrarse. |
| C9 | Info | `supabase/migrations/0009_incremental_sync_and_cleanup.sql:84-86` | Limpieza diaria: bandeja y recordatorios a los 15 días, tombstones a los 180. Los movimientos crecen sin límite, pero son datos del usuario. | ~0,5 KB por movimiento: 100.000 usuarios × 600 movimientos ≈ 30 GB de base de datos. | Nada que aplicar: la limpieza ya existe. Vigilar el tamaño de la base en el panel. |

## Estimación de costo mensual

**Supuestos** (explícitos; ajústalos a tus datos reales):

- 40 % de usuarios activos al día y ~8 ciclos de sync por usuario activo al día.
- Un usuario con un año de uso tiene ~600 movimientos, ~150 presupuestos, ~20 recurrentes y ~30 recordatorios vigentes.
- ~160 KB por ciclo de sync **sin comprimir** (PostgREST puede servir gzip, lo que lo baja 3–4×; no lo asumo).
- 10 % de usuarios usan el Atajo de iOS, ~2 envíos por día.
- **Precios de Supabase** (tomados de su página de precios; **verifícalos**, porque cambian):
  - Free: 5 GB de egress, 500 MB de base de datos, 500.000 invocaciones de funciones, 50.000 MAU.
  - Pro: USD 25/mes, que incluye 250 GB de egress, 8 GB de base de datos, 2 M invocaciones y 100.000 MAU.
  - Excedentes: ~USD 0,09/GB de egress y ~USD 0,125/GB de base de datos.
- **Otros proveedores:**
  - SMTP: el precio depende del proveedor (**supuesto**, p. ej. Resend tiene un plan gratuito de 3.000 correos/mes y planes pagos desde ~USD 20).
  - Web Push, Turnstile y open.er-api.com: gratis.
  - GitHub Pages: gratis, con el límite blando ya mencionado.
- **Sin IA:** 0 tokens.

| Usuarios | Egress sync/mes | Base de datos | Invocaciones/mes | Plan Supabase | SMTP | **Total estimado/mes** |
|---|---|---|---|---|---|---|
| 100 | ~1,5 GB | < 50 MB | ~11.000 | Free | Incluido (poco volumen) | **USD 0** |
| 1.000 | ~15 GB | ~0,3 GB | ~65.000 | **Pro** (supera los 5 GB de egress) | Recomendado propio (supuesto: USD 0–20) | **~USD 25–45** |
| 10.000 | ~150 GB | ~3 GB | ~600.000 | Pro (dentro de lo incluido) | USD ~20 (supuesto) | **~USD 45–60** |
| 100.000 | ~1.500 GB | ~30 GB | ~6 M | Pro + excedentes (egress ~1.250 GB × 0,09 ≈ 112; base de datos ~22 GB × 0,125 ≈ 3; invocaciones ~4 M extra, precio supuesto ~USD 2/M ≈ 8) + probable add-on de cómputo (**supuesto**, USD 50–100) | USD 20–90 (supuesto) | **~USD 220–340** |

Con la optimización C1 (egress 5–10× menor), la fila de 100.000 usuarios bajaría a **~USD 110–200/mes**, y la de 1.000 volvería a caber en el plan gratuito.

## Qué cambié (optimizaciones seguras, sin cambios visibles)

1. `src/lib/fxRates.ts`: timeout de 8 s al pedir la tasa (antes podía quedarse esperando indefinidamente).
2. `supabase/functions/ingest/index.ts`: rechazo 413 de cuerpos de más de 16 KB antes de leerlos.
3. `supabase/functions/send-reminders/index.ts`: el log de error guarda solo el código de estado.
4. `package.json`: se quitó `recharts`, que no se usa desde la Fase 5.
5. `src/features/settings/DataScreen.tsx` y `src/data/local/localRepository.ts`: el código de backup (con `zod`) se carga solo al exportar o importar: 27 KB comprimidos menos en la primera carga.

## Lo que queda por configurar a mano

- **Supabase → Organization → Billing:** confirmar que el **Spend Cap** esté activo. Viene activo por defecto en Pro y hace que el proyecto se limite en vez de cobrar excedentes. Activar además las **alertas de uso** por correo.
- **Supabase → Authentication → SMTP Settings:** configurar un SMTP propio antes de abrir registros a más gente (C4).
- **GitHub → Settings → Billing → Spending limits:** Actions y Codespaces en **USD 0**.
- **Supabase → Reports:** revisar el egress mensual. Si pasa de ~3 GB con pocos usuarios, adelantar la optimización C1.

## Pendiente de tu confirmación

- **C1:** cambiar el algoritmo del sync (cursor de push y listas reutilizadas). Toca la lógica de sincronización.
- **C2:** migración para reescribir las políticas RLS con `(select auth.uid())`.
- **C3:** Edge Function y tabla compartida para la tasa del día.
- **C5:** mover el hosting a Cloudflare Pages cuando crezca el tráfico.
