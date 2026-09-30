# Step up — Bandeja v2: movimientos que llegan solos

> **Para la sesión que implementa esto:** es un cambio acotado a la bandeja (`src/features/inbox/`). Complementa `docs/REDISENO.md` y no lo reemplaza. Prototipo de referencia: `docs/bandeja/Step Up Bandeja.dc.html` (3a notificación, 3b Inicio + revisión, 3c razones). Usa los tokens de color ya definidos en el rediseño (`--q10`, `--q25`, `--danger`, `--positive`, `--surface`, `--paper`, `--line`).

## Qué cambia

Referencia: `Step Up Bandeja.dc.html` (3a notificación, 3b Inicio + revisión, 3c razones). La lógica de `src/features/inbox/` (`interpretText`, `describeParsed`, `closeEntry`) no cambia. Cambia dónde aparece y cómo se revisa.

- **Quitar `InboxBanner`** de `AppLayout`. En su lugar:
  - **Ícono de bandeja en el header de Inicio**, a la izquierda del `MonthNav`: 36 px, `--surface`, con un contador en `--q25` cuando `pending.length > 0`. Siempre visible.
  - **Tarjeta "Por revisar"** entre el grid de flujos y "Falta este mes", solo si hay pendientes. Borde `color-mix(--q25 20%, --line)`, ícono de rayo, "N por revisar" y "Llegaron solos. Revisa el monto antes de anotar.". Muestra máx. 2 filas (avatar de categoría, concepto, origen, monto; "Falta el monto" en `--danger`) + botón "Revisar los N".
- **`InboxSheet` pasa a uno a la vez**:
  - Header "Por revisar", "2 de 4", ✕ y una barra de progreso segmentada.
  - Tarjeta `--paper` con: origen (ícono por `origen`: sms/atajo/dictation + banco + "hace X"), segmentado Gasto | Ingreso, monto editable grande (input numérico, línea inferior en `--danger` si falta), concepto editable, chips de categoría, método (Débito/Tarjeta/Efectivo), fecha y moneda (tocables, reutilizan los selectores de la §9b).
  - **Pista con color** (desde `describeParsed`): verde si `fromLearning` o está completo, azul (`--q10-soft`) si `!yaOcurrio` ("Es para el 5 oct. Se agenda como pendiente y no cuenta hoy."), rojo si `desc.missing`.
  - "Ver mensaje original" colapsado, en monoespaciada.
  - Botones: Descartar (outline) y Anotar/Programar (primario, apagado si falta monto o concepto). Al resolver, pasa al siguiente. Al final, "Todo revisado · N anotados · M descartados".
  - **"Anotar los N que están completos"**: solo si hay ≥2 completos sin `missing`. Nunca anota los incompletos.
  - **Deshacer**: toast de 5 s. Para poder deshacer, `closeEntry` se llama al vencer el toast (o `reopenEntry(id)` → `status='pending'` y borrar la transacción creada). Descartar ya no pide confirmación.
  - Los valores editados en la hoja se usan en `record()` en lugar de los interpretados. Si el usuario cambia la categoría, actualizar `conceptIndex` como hace la entrada rápida.
- **Rastro**: `Transaction.source?: 'sms' | 'atajo' | 'dictation'` y `sourceLabel?`. En las filas, un rayo `--q25` de 13 px junto al concepto; en el detalle, "Origen: SMS Bancolombia".
- **Notificación push** (Edge Function `ingest` → web push, ya existe `NotificationsSection`): título "Step up". El cuerpo dice lo que entendió: "Gasto de $ 500.000 en Restaurante El Cielo" + "Toca para revisarlo antes de anotarlo.". Si falta el monto: "Compra en Uber. No pude leer el monto.". Usar `tag` por usuario para agrupar, y `data.url = '/?revisar=<id>'`. Inicio abre la hoja en ese id al leer `?revisar`.
- **Escritorio**: el ícono de bandeja va en el header de la vista principal. La revisión es un diálogo de 520 px con el mismo contenido, y los atajos ⏎ = Anotar y ⌫ = Descartar.
- e2e: actualizar los que buscan `inbox.oneArrivedOnItsOwn` en el banner y añadir `40-inbox-review-one-by-one` (editar monto faltante → anotar → deshacer).

## Tareas

1. **Datos**
   - `Transaction.source?: 'sms' | 'atajo' | 'dictation'` y `sourceLabel?: string` en `src/domain/types.ts`, con su migración + `mappers.ts` + test de ida y vuelta.
   - `reopenEntry(id)` en `src/data/supabase/inbox.ts` (`status = 'pending'`).
2. **Inicio**
   - Quitar `<InboxBanner />` de `AppLayout.tsx`.
   - Crear `InboxButton` (ícono + contador) en el header de `DashboardScreen`.
   - Crear `InboxCard` (máx. 2 filas + "Revisar los N"), que solo se muestra con pendientes.
   - Leer `?revisar=<id>` y abrir la hoja en ese movimiento.
3. **`InboxSheet` uno a uno**
   - Estado `idx` + barra de progreso.
   - Campos editables: tipo, monto, concepto, categoría, método, fecha y moneda. `record()` usa los valores editados.
   - Pista de color desde `describeParsed`: verde (aprendido o completo), azul (`!yaOcurrio`), rojo (`missing`).
   - Anotar/Programar se apaga si falta monto o concepto.
   - "Anotar los N completos" cuando hay ≥2 completos sin `missing`.
   - Toast de 5 s con Deshacer: `closeEntry` diferido o `reopenEntry` + borrar la transacción.
   - Estado final "Todo revisado · N anotados · M descartados".
4. **Rastro**: un rayo `--q25` de 13 px en `TransactionRow` cuando `source` existe, y "Origen: …" en el detalle.
5. **Push**
   - La Edge Function `ingest` interpreta el texto y envía una notificación con lo entendido, usando `tag` por usuario y `data.url = '/?revisar=<id>'`.
   - El service worker abre esa URL en `notificationclick`.
6. **Escritorio**: diálogo de 520 px con el mismo contenido. Atajos: ⏎ Anotar, ⌫ Descartar, Esc cerrar.
7. **i18n**: todo texto nuevo va en `src/i18n/texts.ts` (ES y EN), con claves `inbox.*`.
8. **Tests**
   - Unitarios de `InboxSheet`: editar el monto faltante habilita Anotar; "Anotar completos" excluye los incompletos.
   - e2e `40-inbox-review-one-by-one`: editar el monto → anotar → deshacer.
   - Actualizar los e2e que buscaban el banner.

## Checklist

- [x] Banner eliminado; ícono + tarjeta en Inicio
- [x] Revisión uno a uno con edición en línea
- [x] Pistas verde/azul/rojo y botón apagado si falta algo
- [x] Anotar completos + Deshacer
- [x] `Transaction.source` + rayo en listas
- [x] Push con lo entendido + deep-link `?revisar=`
- [x] Diálogo de escritorio con atajos
- [x] ES/EN
- [x] `npm run typecheck && npm run lint && npm test && npm run test:e2e` en verde

## Notas de la implementación

- **Deshacer:** `closeEntry` se llama al anotar o descartar, y Deshacer hace `reopenEntry` + borra la transacción. Así, si la app se cierra durante los 5 s, nada queda a medias ni anotado dos veces. Al deshacer, el movimiento vuelve con lo que el usuario ya había escrito (como en el prototipo).
- **Push:** `ingest` arma el texto con el mismo parser de la app, empaquetado en `supabase/functions/ingest/pushText.gen.js` (`npm run build:push-text`; un test falla si el bundle queda viejo). El idioma sale de `push_subscriptions.language` (migración 0018).
- **"Anotar los N completos"** deja fuera los que llegaron incompletos (aunque ya se hayan escrito) y los que están en otra moneda.
- **Escritorio:** al abrir, el foco va a "Anotar" (o al monto si falta), para que ⏎ anote y no cierre.
- La interpretación (`interpretText` / `describeParsed`) no cambió: el parser sigue leyendo, por ejemplo, "*8810" de una tarjeta como monto.
