# Step up — Bandeja v2 · Parte 2: web + navegación entre movimientos

> **Contexto para la sesión que implementa esto:** la Parte 1 (`docs/BANDEJA.md`: móvil, revisión uno a uno, pistas de color, anotar completos, deshacer, `Transaction.source`, push) **ya está en curso o terminada. No la rehagas.** Este documento solo agrega:
> 1. Moverse entre los movimientos que llegaron solos sin anotar ni descartar (móvil y web).
> 2. La versión web (escritorio ≥1024 px).
>
> Prototipo: `docs/bandeja/Step Up Bandeja.dc.html` → **3b** (móvil con ‹ › y swipe) y **4a / 4b** (web). Todo reutiliza el hook `useInboxReview()` de la Parte 1; si no existe con ese nombre, extrae la lógica compartida de `InboxSheet` a ese hook antes de empezar.

## Moverse entre movimientos sin decidir

Anotar o descartar sigue pasando al siguiente de forma automática. Además:
- **Móvil**:
  - `‹ 2 de 4 ›` en el header de la hoja (flechas en gris cuando no hay más).
  - Los segmentos de la barra de progreso se pueden tocar para saltar a un movimiento: los pendientes en gris, el actual en `--text` y los que les falta algo en `--danger` al 55%.
  - **Deslizar la tarjeta** a la izquierda o derecha: umbral de 50 px, con el movimiento horizontal al menos 1,5 veces el vertical, y `touch-action: pan-y` para no bloquear el scroll.
- **Web**:
  - Los mismos `‹ ›` en el header del panel y clic en la cola.
  - ↑/↓ en cualquier momento; ←/→ solo si el foco no está en un input.
- El contador "N de M" cuenta solo los que faltan. Los ya resueltos quedan como segmentos `--q10` al inicio de la barra.
- Las ediciones hechas en un movimiento se conservan al moverse (estado por id en `useInboxReview`), aunque todavía no se haya anotado.

## Versión web (escritorio, ≥1024 px) — prototipo 4a

- **Quitar el banner superior** de todas las pantallas (`InboxBanner` también se renderiza en escritorio).
- **Sidebar**: nuevo ítem "Por revisar" debajo de Inicio / Análisis / Ajustes, separado por una línea de 1 px `--line`. Ícono de bandeja y contador `--q25` de 22 px. No es una ruta: abre el panel. Se ve desde cualquier pantalla.
- **Header de Inicio**: botón de bandeja de 40×40 (radio 12, borde `--line-strong`) entre la búsqueda y "Nuevo movimiento", con un contador de 18 px.
- **Columna izquierda de Inicio** (380 px): la tarjeta "Por revisar" va entre "Te queda" y "Falta este mes", con las mismas reglas que en el móvil.
- **Panel lateral derecho** en lugar de hoja o diálogo:
  - 480 px de ancho, alto completo, `--surface`, `border-left: 1px solid var(--line-strong)`, entra con `translateX` en 380 ms (ease-out). Scrim al 45%; clic afuera cierra.
  - Arriba, la **cola completa** (lista compacta en `--paper`): punto de estado (verde completo, azul futuro, rojo falta algo), concepto y monto. La actual va resaltada en `--q10-soft` y un clic salta a cualquiera.
  - En el medio, el mismo formulario editable del móvil, con el **mensaje original siempre visible**.
  - Pie fijo: Descartar `⌫` y Anotar/Programar `⏎` (con la tecla mostrada en un kbd), más "Anotar los N completos".
  - Teclado: ⏎ anota, ⌫ descarta solo si el foco no está en un input, Esc cierra.
  - Toast "Deshacer" centrado abajo, a 24 px.
- **Tabla de Movimientos**: lo recién anotado entra arriba, con fondo `color-mix(--q25 5%, transparent)` durante unos segundos y el rayo junto al concepto.
- Componente sugerido: `InboxPanel` (escritorio) e `InboxSheet` (móvil) comparten un hook `useInboxReview()` con idx, edición, resolve, undo y bulk. Elegir con `useBreakpoint()`.

## Idioma (ES / EN)

Todo texto nuevo va en `src/i18n/texts.ts` con las dos versiones. Nada de strings sueltos en los componentes.

| Clave | ES | EN |
|---|---|---|
| `inbox.navTitle` | Por revisar | To review |
| `inbox.position` | {n} de {total} | {n} of {total} |
| `inbox.prev` | Anterior | Previous |
| `inbox.next` | Siguiente | Next |
| `inbox.originalMessage` | Mensaje original | Original message |
| `inbox.shortcutsHint` | ⏎ anotar · ⌫ descartar · ↑↓ moverse · Esc cerrar | ⏎ log · ⌫ discard · ↑↓ move · Esc close |
| `inbox.openPanel` | Abrir movimientos por revisar | Open items to review |
| `inbox.missingAmountShort` | Sin monto | No amount |

- `aria-label` de los botones ‹ › y del ícono de bandeja con `inbox.prev`, `inbox.next` e `inbox.openPanel`.
- Los atajos de teclado no cambian con el idioma.
- Ampliar el e2e `27-english-has-no-spanish` para que abra el panel web y la hoja móvil en inglés.

## Tareas

1. **Hook** `useInboxReview()`: `idx`, `move(delta)`, `goTo(i)` y `edits` por id (las ediciones persisten al moverse). `resolve`, `undo` y `bulk` salen de la Parte 1.
2. **Móvil (`InboxSheet`)**: control `‹ N de M ›`, segmentos tocables en la barra de progreso y swipe en la tarjeta (umbral de 50 px, `touch-action: pan-y`).
3. **Web**:
   - Quitar `InboxBanner` en escritorio.
   - Ítem "Por revisar" en el sidebar y botón en el header de Inicio.
   - Tarjeta en la columna izquierda.
   - `InboxPanel` lateral de 480 px con la cola, el formulario, el pie fijo y los atajos (⏎ ⌫ ↑↓ ←→ Esc).
   - Resaltar lo recién anotado en la tabla.
4. **Selección por breakpoint**: `useBreakpoint()` monta `InboxSheet` (<1024) o `InboxPanel` (≥1024). El deep-link `?revisar=<id>` abre el que corresponda.
5. **i18n**: las claves de la tabla anterior.
6. **Tests**:
   - Unitarios del hook: `move` no se sale de rango y las ediciones se conservan al volver.
   - e2e `41-inbox-navigate`: móvil (swipe/›) y web (↓, clic en la cola, Esc).
   - e2e de idioma ampliado.

## Checklist

- [x] `useInboxReview` con `move` / `goTo` / `edits` por id
- [x] Móvil: ‹ › + segmentos tocables + swipe
- [x] Web: sin banner, sidebar "Por revisar", botón en el header, tarjeta en Inicio
- [x] Web: `InboxPanel` con la cola y los atajos
- [x] ES/EN completos, e2e de idioma ampliado
- [x] `npm run typecheck && npm run lint && npm test && npm run test:e2e` en verde

## Notas de la implementación

- `useInboxReview()` (`src/features/inbox/useInboxReview.ts`) tiene todo el estado de la revisión: `items`, `idx`, `move`, `goTo`, ediciones por id, `accept` / `discard` / `acceptAll` / `undo`, el toast y los recién anotados. `InboxProvider` monta `InboxSheet` (<1100 px, el breakpoint `desktop` de la app) o `InboxPanel` (escritorio).
- Las piezas comunes (tarjeta editable, `‹ N de M ›`, segmentos, "Todo revisado") viven en `InboxFields.tsx`.
- El panel toma las teclas en `window` mientras está abierto: ⏎ anota (salvo con el foco en otro botón), ⌫ descarta fuera de los campos, ↑/↓ siempre, ←/→ fuera de los campos, Esc cierra (con `useDialogo`).
- El swipe también responde al mouse, así el e2e lo puede probar arrastrando.
- La columna izquierda de Inicio se mantiene en 410 px (la del rediseño, que prueba e2e 46), no en 380: la tarjeta va entre "Te queda" y "Falta este mes" como pide el documento.
- El e2e de idioma ampliado es `27-english-has-no-spanish-inbox`: necesita el build con la nube falsa (proyecto cloud-sync), y el 27 original corre en el local.
