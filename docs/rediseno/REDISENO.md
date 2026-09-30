# Step up — Rediseño v4 (oscuro, minimalista)

> **Para la sesión que implementa esto:** lee el documento completo antes de tocar código. La sección **§11** lista lo que la app **todavía no tiene** y cómo hacerlo. La **§12** es el plan por fases. Marca el checklist de la §10 a medida que avances. El prototipo de referencia es `Step Up Rediseno.dc.html` (1a = móvil, 2a/2c/2d = escritorio).

Instrucciones para aplicar el rediseño en este repo. **No cambia ninguna lógica de dominio** (`src/domain/**`, `src/data/**` quedan intactos). Solo cambian navegación, jerarquía visual y qué se muestra en cada pantalla. Todas las funcionalidades actuales siguen disponibles.

Referencia visual: `Step Up Rediseno.dc.html` (prototipo 1a + logos 1b/1c/1d).

---

## 0. Reglas generales

- Mantener Instrument Sans, `font-variant-numeric: tabular-nums` en montos y los tokens de color actuales del modo oscuro. El cambio es de jerarquía, no de identidad.
- Un número grande por pantalla (Inicio: "te queda"; Análisis: balance). El `$` va más pequeño y en gris, al lado del número.
- Tarjetas: `--surface`, borde `1px solid var(--line)`, `border-radius: 20px`, sin sombra en oscuro.
- Nada de texto en MAYÚSCULAS para los títulos de sección. Usar título de 19px/700 en sentence case ("Falta este mes").
- Los selectores (periodo, Lista/Calendario, Débito/Tarjeta) usan el mismo control segmentado: contenedor `--surface` con padding de 3px y radio de 12px; la opción activa en `--line-strong` con radio de 9px.
- Conservar todos los `aria-label`. En particular, `"Agregar movimiento"` en el `+`, porque `index.css` lo usa para esconder el FAB cuando hay un diálogo abierto.

## 1. Tokens (`src/styles/tokens.css`)

Ajustar solo el bloque oscuro (`[data-theme='dark']` y el `prefers-color-scheme: dark`):

```css
--paper: #0B0D12;
--surface: #151922;
--surface-sunken: #1D222C;
--line: #232936;
--line-strong: #2B323E;
--text: #F4F6FA;
--text-muted: #A3ABBA;
--text-faint: #7C8595;
```

Añadir:

```css
--radius-card: 20px;
--tabbar-h: 62px;
```

Los acentos (`--q10 #6B8AFF`, `--q25 #FFB340`, `--positive #3DD16B`, `--danger #FF7A70`) y los `--cat-*` no cambian. Avatar de categoría: fondo `color-mix(in srgb, <color> 16%, var(--surface))`, ícono en el color de la categoría y `border-radius: 12px`.

## 2. Navegación: 3 pestañas + botón `+`

### `src/components/ui/TabBar.tsx`
- `TABS` queda con 3 entradas: `/` Inicio, `/analisis` Análisis, `/ajustes` Ajustes.
- La barra deja de ser full-width. Pasa a ser una **píldora flotante**: `position: fixed; left: 14px; right: 14px; bottom: calc(var(--safe-bottom) + 12px); display: flex; gap: 10px`.
  - Píldora: `flex: 1; height: 62px; border-radius: 31px; padding: 4px; grid 3 columnas; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(20px); border: 1px solid var(--line-strong)`.
  - Pestaña activa: fondo `var(--line-strong)`, `border-radius: 27px`, color `var(--text)`. Inactiva: `var(--text-faint)`.
- `AddButton`: sale de `position:absolute` y pasa a ser el **segundo hijo del flex**, un círculo de 62px en `var(--q10)` con el ícono `+` en `var(--paper)`. Se mantienen la lógica de ocultarse al hacer scroll, el `onClick` y el `QuickActionSheet`.
- Una pestaña `/` activa también debe marcar Inicio cuando la ruta es `/movimientos` (Movimientos cuelga de Inicio). Usar `useLocation` y `isActive || pathname.startsWith('/movimientos')`.
- **Eliminar `RefreshButton`** de la barra. El refresco queda en `PullToRefresh` (ya existe) y en Ajustes → Tu cuenta → "Sincronizar ahora".
- `AppLayout.tsx`: `paddingBottom` de `main` pasa a `calc(var(--safe-bottom) + 110px)`.

### `src/app/router.tsx`
- Mantener `movimientos` como ruta.
- `calendario` → `<Navigate to="/movimientos?vista=calendario" replace />`, para no romper enlaces ni notificaciones que apunten ahí.
- `CalendarScreen` deja de ser pantalla. Su contenido se extrae a `CalendarView` (ver §4).

## 3. Inicio (`src/features/dashboard/DashboardScreen.tsx`)

Orden nuevo, de arriba a abajo:

1. **Header de marca en línea**: `Logo` + "Step up" a la izquierda y `MonthNav` compacto (píldora `--surface`, 34px de alto) a la derecha. Reemplaza al `BrandBar` global solo en Inicio. En las demás pantallas el título grande basta (ver §7).
2. **Hero centrado, sin tarjeta de color**:
   - Línea 15px `--text-muted`: `Hola, {displayName}. Te queda en {mes}`.
   - `AnimatedNumber` de `monthBalance.leftover` a 56px/700, con `letter-spacing: -0.035em`. El `$` va aparte, a 30px en `--text-muted`.
   - Línea de contexto: punto de 7px + `periodLabel` de la quincena activa, en el color de esa quincena, + `· quedan {formatMoney(remainder)}`. Esto reemplaza las `PeriodCard` en Inicio (la información sigue ahí, en una línea).
3. **Grid 2×2 de flujos** (`FlowCell`, igual que hoy pero en una sola tarjeta de 20px con separadores de 1px): Ya recibiste / Falta recibir / Ya pagaste / Falta pagar.
   - **La celda "Falta pagar" es un botón que abre `ToPaySheet`**, con un chevron `›`. Por eso se **elimina** el botón aparte "Desglose de lo que falta pagar".
4. **Aviso de tarjeta vencida** (`overdue`): se mantiene igual, justo encima del hero, y solo aparece si aplica.
5. **"Falta este mes"**: título 19px con un enlace "Ver todos" (`navigate('/movimientos')`) a la derecha, y la lista `upcoming` en una tarjeta. Las filas no cambian de lógica (`toggleTxPaid`). Una fila pagada muestra el monto tachado.
6. Botón **"Ver todos los movimientos"** (outline, 50px, radio 16px).

**Se eliminan de Inicio**: la grilla de `PeriodCard`, las dos `ExpectCard` ("Esperas recibir / gastar", que repetían "Falta recibir / Falta pagar") y el botón de desglose. No se borra ninguna función de dominio: `upcomingTotals` puede quedar sin uso o eliminarse del import.

## 4. Movimientos (`src/features/transactions/TransactionsScreen.tsx`)

- Se entra desde Inicio. El header lleva `‹ Inicio` a la izquierda (`navigate('/')`) y la acción "Seleccionar" a la derecha (la multiselección actual se mantiene).
- Título grande "Movimientos" + `MonthNav` compacto.
- **Control segmentado `Lista | Calendario`** debajo del título. Leer y escribir `?vista=calendario` en la URL con `useSearchParams`, para que el botón atrás y los enlaces funcionen.
- **Vista Lista**: todo lo actual (buscador, chips de filtro, resumen de conteo y totales, grupos por quincena con "Restante"). Cambios visuales:
  - Chip activo: fondo `--text` y texto `--paper`. Inactivo: borde `--line-strong`.
  - Encabezado de grupo: punto + nombre de la quincena en su color + rango en `--text-faint`, **fuera** de la tarjeta. Así la tarjeta solo contiene filas y "Restante".
- **Vista Calendario**: mover el cuerpo de `CalendarScreen.tsx` a `features/calendar/CalendarView.tsx` (sin `Screen` ni `MonthNav`, recibe `year`/`month` por props) y renderizarlo aquí.
  - Día seleccionado: círculo de 34px `--text` con número `--paper`. Hoy: número en `--q10`.
  - Puntos debajo del número: gris para gastos, `--positive` para ingresos, máximo 3.
  - Debajo, "29 de septiembre" + total del día y la lista de ese día en tarjeta.
- Los query params `?nuevo=1`, `?tipo=ingreso` y `?texto=` siguen funcionando igual (el menú del `+` navega a `/movimientos?...`).
- El test `32-fab-hides-on-calendar` debe seguir pasando. Ahora el FAB se esconde cuando `vista=calendario`.

## 5. Nuevo gasto / ingreso (`TransactionForm.tsx`)

Sin cambiar campos ni validación, reordenar visualmente la hoja:

1. Barra superior: `Cancelar` (texto `--q10`), título y `Guardar` (píldora `--q10` cuando es válido y `--surface-sunken` cuando no).
2. **Monto grande centrado** (52px, `$` en gris) como protagonista, y el concepto como input centrado debajo.
3. Chips de categoría con scroll horizontal (ícono + nombre). La activa lleva el borde del color de la categoría.
4. Fila con segmentado `Débito | Tarjeta` (o los métodos de pago del usuario) y fecha. Si es tarjeta, una línea `--q25` con "Corte 15 · se paga el 2 nov" (usa el `cycle.ts` existente).
5. Opciones avanzadas (cuotas, quincena manual, estado, notas) dentro de un `MoreOptions` colapsado. Se esconden, no se eliminan.
6. Opcional: teclado numérico propio (3×4, teclas de 54px, `000` y `⌫`) en lugar del teclado del sistema. Mantener un `<input inputMode="numeric">` accesible detrás, para que no se rompan los e2e `16-keyboard-in-modals` y `01-create-expense`.

## 6. Análisis (`src/features/analytics/AnalyticsScreen.tsx`)

- Título grande + `MonthNav` compacto, y el segmentado `Quincena | Mes | Trimestre | Año` (lógica igual).
- **Hero**: "Balance de {periodo}" y el balance a 50px (signo `+$` en `--positive` o `−$` en `--danger`), con una línea "Ingresos $X · Gastos $Y".
- **"Gastos por categoría"**: fusiona "Balance por categoría" (barra apilada) y "Distribución de gastos" (donut). Una barra apilada con separaciones de 3px y, debajo, una fila por categoría con avatar, nombre, monto, barra fina de 5px y %. **Tocar una fila despliega el detalle**, que es la misma acción que hoy tiene el donut. El donut desaparece, la función no.
- **Ingresos vs. gastos**: dos barras anchas con radio de 14px y degradado vertical del color hacia 35% de opacidad, con el valor abreviado encima ("8,3 M"). Se sigue usando Recharts (`radius={[14,14,14,14]}`) o CSS.
- **Fijos vs. variables** y **Débito vs. tarjeta**: en una sola tarjeta, separados por una línea. Cada uno es una barra partida de 8px con leyenda debajo y el % dominante a la derecha del título.
- **Presupuestos del mes** vacío: tarjeta con borde punteado y un botón "Definir" que lleva a `/ajustes/presupuestos`. Si hay presupuestos, `BudgetColumns` igual que hoy.
- "Organizar gráficos" (`ChartManager`): se mantiene al final como botón outline.

## 7. Ajustes (`src/features/settings/SettingsScreen.tsx`)

Hoy es una página larga con todo expandido. Pasa a ser una **lista agrupada estilo iOS** en la que cada fila abre su propia pantalla u hoja:

| Grupo | Fila | Valor a la derecha | Abre |
|---|---|---|---|
| (tarjeta de perfil) | Avatar con inicial, nombre y correo, "Sincronizado" | — | `ajustes/cuenta`: nombre editable, `CloudSection` (Sincronizar ahora), Cerrar sesión |
| Preferencias | Idioma | Español | hoja con Español / English |
| | Tema | Oscuro | hoja con Sistema / Claro / Oscuro |
| | Moneda | COP | `ajustes/moneda` (la lista actual) |
| Tu plata | Cómo te pagan | 10 y 25 | `ajustes/pagos` (una o dos veces, días) |
| | Recordatorios | 1 día antes | `ajustes/recordatorios`: días de aviso + `NotificationsSection` |
| Organizar | Categorías · Métodos de pago · Recurrentes · Presupuestos | conteo | rutas existentes |
| Avanzado | Atajos de iOS | — | `ajustes/atajos` (`AutomationSection`) |
| | Tus datos | Exportar · Importar | `ajustes/datos`: JSON, CSV, Excel, importar backup |
| | Legal | — | `/legal` |
| — | Cerrar sesión (texto `--danger`) | — | confirmación |

- Fila: 52px de alto, ícono de 30px en un cuadrado `--surface-sunken` con radio de 9px, tintado; label de 16px; valor en `--text-faint`; chevron.
- Debajo de todo: "Step up v1.3.0 · © 2026" en 12px.
- Las pantallas nuevas son wrappers finos: `<Screen title back="/ajustes">` + la sección existente, sin reescribirlas.
- "Nuevo recurrente" sale de Organizar, porque ya está en el `+` y dentro de Recurrentes.

## 8. Qué se esconde

- `LegalFooter`: sacarlo de `AppLayout`. Solo queda en `LegalLayout` y en Ajustes → Legal. Actualizar el e2e `25-legal-language-charts`.
- `RefreshButton` flotante: se elimina (§2). Actualizar el e2e `29-refresh` para usar pull-to-refresh o "Sincronizar ahora".
- `BrandBar` global: se reemplaza por el header de Inicio. En las demás pantallas, el `SyncIndicator` y el título grande ya orientan. Si quieres conservarlo, bájalo a 44px y sin borde.
- `Screen.tsx`: añadir una prop opcional `back?: { label: string; to: string }` que renderice `‹ label` en `--q10` sobre el título. Título a 32px/700, `letter-spacing: -0.025em`.

## 9. Logo — elegido: 1c "S escalonada"

`Logo.tsx`: una S hecha con 5 bloques en ángulo recto (viewBox 24) y un acento ámbar arriba a la derecha:

```tsx
<rect x="3"  y="2"   width="14" height="5"    rx="2" fill={c} />
<rect x="3"  y="2"   width="5"  height="12"   rx="2" fill={c} />
<rect x="3"  y="9.5" width="18" height="5"    rx="2" fill={c} />
<rect x="16" y="9.5" width="5"  height="12.5" rx="2" fill={c} />
<rect x="7"  y="17"  width="14" height="5"    rx="2" fill={c} />
<rect x="18" y="2"   width="3"  height="5"    rx="1.5" fill="var(--q25)" />
```
- `c` = `var(--q10)` en la marca normal y `#FFFFFF` en la versión `tile`.
- Tile: fondo sólido `#0B0D12` (oscuro) o `#2F4FE0` (claro), sin degradado, `rx=14` sobre 64, glifo escalado 1.6 y centrado.
- Regenerar `public/icons/*` y `apple-touch-icon.png` con `node scripts/generar-iconos.mjs`.

## 9b. Moneda y método por movimiento (nuevo)

Aplica a Nuevo gasto, Nuevo ingreso, Nuevo recurrente y "Contarle a la app".

- **Chips de moneda con bandera**, siempre 3 por defecto: 🇨🇴 COP · 🇺🇸 USD · 🇪🇺 EUR. Un chip "Más" despliega 🇲🇽 MXN, 🇦🇷 ARS, 🇨🇱 CLP y 🇵🇪 PEN. Si se elige una moneda de las ocultas, se queda visible como cuarto chip. La moneda por defecto es la de Ajustes. Los 3 fijos pueden ser configurables más adelante (`settings.quickCurrencies`).
- Si la moneda no es la principal, debajo del monto aparece "≈ $ 80.000 COP · tasa 4.000". La tasa es editable.
- **Método de pago**: segmentado de 3, **Débito | Crédito | Efectivo**. Crédito muestra la línea ámbar "Corte 15 · se paga el 2 nov" (`cycle.ts`). Si hay varias tarjetas, "Crédito" abre un selector con ellas.
- **Datos** (cambio mínimo, el dominio sigue en enteros de la moneda principal):
  - `types.ts` → `Transaction` y `RecurringRule`: `currency?: string`, `originalAmount?: number`, `fxRate?: number`. `amount` sigue siendo el valor convertido, así `domain/**` no cambia.
  - `PaymentMethod.type`: añadir `'cash'` y sembrar "Efectivo" en `seed` y en onboarding.
  - Migración `supabase/migrations/0013_currency_cash.sql` (columnas `currency text`, `original_amount bigint`, `fx_rate numeric`, y `'cash'` en el check de `type`) + `mappers.ts`, con su test de ida y vuelta.
  - `domain/nlp`: reconocer "dólares/usd/euros" → moneda y "efectivo" → método (ya reconoce "tarjeta").
  - La fila de la lista muestra el original como nota: "US$ 20 USD · tasa 4.000".
- **Monedas centradas**: la fila de chips usa `justify-content: safe center` (centrada cuando cabe; si no, empieza a la izquierda y se desliza con el dedo). Al tocar "Más", la fila se re-centra con `scrollLeft = (scrollWidth - clientWidth) / 2` para que no salte.
- **Fecha del movimiento**: el chip "Hoy" es un botón (Hoy / Ayer / Mañana / "3 oct"). Al tocarlo abre un **mini calendario** en la misma hoja: navegación de mes, hoy con anillo, día elegido relleno en `--q10`, y atajos Ayer · Hoy · Mañana.
  - Fecha pasada: se guarda como pagado o recibido.
  - Fecha futura: queda `pending`, con la línea ámbar "queda pendiente y te avisamos".
  - La quincena se resuelve con `calculatePeriod`, igual que hoy.
- **Hoja compacta**: sin espaciador flexible. La hoja mide lo que ocupa su contenido (`max-height: calc(100% - 54px)` y scroll interno). Orden: barra superior → [Gasto|Ingreso si es recurrente] → monto 48px → equivalencia → concepto → monedas → categorías → método + "Hoy" (o "Cada mes, el día [− 29 +]" si es recurrente) → teclado 3×4 de teclas de 50px con gap de 6. En pantallas más altas simplemente queda más fondo arriba, no más hueco entre opciones y teclado.
- **Contarle a la app** (`QuickEntrySheet`): micrófono de 72px, input de texto, frases de ejemplo en chips, tarjeta "Entendí" con el resultado del parser y debajo los mismos chips de moneda y método para corregir. Botones "Ajustar" (abre el formulario completo, como hoy) y "Guardar".

## 9c. Análisis v2

- **Se elimina** "Ingresos vs. gastos" (el hero ya da ingresos, gastos y balance).
- **Cada tarjeta es plegable**: el header es un botón con título, resumen a la derecha ("$ 6.559.000", "89% usado", "87% fijos"…) y un chevron que rota. Guardar el estado plegado por tarjeta en `localStorage` (`analytics.collapsed`), junto al orden de `ChartManager`.
- **Presupuestos como columnas** (reemplaza `BudgetColumns`):
  - Una columna por categoría con presupuesto, ordenadas por límite de mayor a menor, con scroll horizontal y 84px de ancho.
  - El **borde punteado es el límite**. Su alto es proporcional al límite: `96px + (límite / límiteMáx) * 104px`.
  - El **relleno sube** según lo gastado: `height: calc(pct% - 6px)`, color de la categoría al 34% sobre `--surface`, con `transition: height .5s`.
  - Si te pasas, el relleno sobresale del punteado (tope 114%) y el borde, el relleno y el % se vuelven `--danger`.
  - Dentro, abajo: ícono, monto gastado abreviado ("704K") y %. Debajo de la columna: "Nombre · límite".
  - Tocar una columna lleva a `/ajustes/presupuestos`.
- "Por método de pago" reemplaza "Débito vs. tarjeta", con 3 segmentos (Débito, Crédito, Efectivo).

## 9d. Subpantallas de Ajustes (detalle)

- **Cómo te pagan** (`/ajustes/pagos`): segmentado "Dos veces al mes | Una vez al mes"; filas "Primer pago, día [− 10 +]" y "Segundo pago, día [− 25 +]" (validar que pago1 + 2 ≤ pago2). **Vista previa**: una tira de 30 días coloreada por quincena (índigo / ámbar; en modo mensual, los días anteriores al pago en 40% de opacidad) y la leyenda "Quincena del 10 · Del 10 al 24", "Quincena del 25 · Del 25 al 9 del mes siguiente". La tira usa `periodsOfMonth`.
- **Categorías**: lista con avatar, nombre y total histórico, más el botón punteado "+ Nueva categoría". Tocar una abre `CategoryForm`.
- **Recurrentes**: resumen 2×1 "Entran al mes / Salen al mes", luego grupos **Ingresos** y **Gastos** ordenados por día ("Mensual · día 5"), y el botón "+ Nuevo recurrente" que abre la hoja de §9b en modo recurrente.
- **Presupuestos**: las columnas de §9c arriba y, debajo, una fila por categoría: "gastado de límite" (en rojo "· te pasaste" si aplica) con un stepper [− 500K +] de ±50.000, o un botón punteado "Definir" si no tiene. El stepper reemplaza `BudgetAmountSheet` para ajustes rápidos; tocar el monto sigue abriendo la hoja.
- **Atajos de iOS**: tarjeta "Clave activa · Solo puede enviar" con la clave enmascarada y el botón "Copiar", el botón "Generar una clave nueva" con su advertencia debajo, y "Cómo armarlo" en 3 pasos numerados. Al final, el enlace a `docs/ATAJOS_IOS.md`.

## 9e. Perfil, preferencias y datos (subpantallas)

- **Perfil** (`/ajustes/cuenta`, se abre tocando la tarjeta de perfil): avatar de 84px con la inicial, nombre y correo. "Tu nombre" es un input (`settings.displayName`, el saludo de Inicio). "Cuenta" tiene el estado de sincronización ("hace 2 min"), "Sincronizar ahora" (`CloudSection`) y "Cambiar contraseña". Al final, "Cerrar sesión" en `--danger`.
- **Idioma**: 2 filas (ES / EN) con un check en `--q10`, y debajo la nota "Solo cambia la interfaz…".
- **Tema**: 3 miniaturas (Sistema con fondo partido en diagonal, Claro y Oscuro) con un anillo `--q10` en la elegida. **Se aplica al instante**: `useTheme` escribe `data-theme` en `<html>` y todos los colores salen de variables CSS, con una transición de 350ms en `background-color`, `color` y `border-color`. Hace falta que **ningún componente use hex sueltos**: revisar con `grep -rn "#[0-9A-Fa-f]\{6\}" src/features src/components`.
- **Tema claro**: `--paper #F2F4F7`, `--surface #FFFFFF`, `--surface-sunken #E9ECF1`, `--line #E4E8EE`, `--line-strong #D5DAE2`, `--text #151B28`, `--text-muted #4A5263`, `--text-faint #6E7686`, `--q10 #2F4FE0`, `--q25 #B7650F` (texto legible), `--positive #0E7C52` y `--danger #C0352B`. La barra de pestañas usa `rgba(255,255,255,.9)` con blur.
- **Moneda**: la lista "Principal" (bandera, nombre, código y ejemplo) con check, y **"Monedas rápidas"**: chips que se prenden y apagan, máximo 3 (`settings.quickCurrencies`, por defecto `['COP','USD','EUR']`). Son las que muestra la hoja de nuevo movimiento. Las demás quedan en "Más".
- **Recordatorios**: un switch iOS "Avisarme en este dispositivo" (`NotificationsSection`), un stepper "Avisar con [1] día antes" (0–7) y la hora fija 9:00 a. m. Debajo, una **vista previa de la notificación** ("GYM vence mañana · $ 100.000 · Salud · Débito") con el ícono 1c.
- **Tus datos**: el grupo "Exportar" (JSON, CSV y Excel, cada uno con su descripción y un ícono de descarga) y el grupo "Restaurar" (Importar backup JSON, con `ImportPreviewSheet`).
- **Legal**: los 5 documentos con subtítulo y "Última actualización". Reemplaza al footer en todas las pantallas.

## 9f. Cuenta, login y más

- **Login y registro** (`SignInScreen.tsx`): alineado a la izquierda, sin tarjeta.
  - Arriba, el tile del logo 1c de 60px. Luego un título grande que cambia según el modo ("Hola de nuevo", "Crea tu cuenta", "Recupera tu contraseña") y un subtítulo.
  - Segmentado "Ya tengo cuenta | Crear cuenta".
  - Campos con **etiqueta arriba** e ícono (correo, candado). La contraseña tiene un botón de ojo para mostrarla u ocultarla.
  - En registro: medidor de fuerza de 4 segmentos (Muy corta → Fuerte) y un checkbox obligatorio "Acepto los Términos y la Política de privacidad", con enlaces a `/legal`.
  - En login: "¿Olvidaste tu contraseña?" alineado a la derecha.
  - **Turnstile** sigue ahí, dentro de una fila discreta ("Verificación de seguridad lista · Cloudflare"). Se puede usar `appearance: 'interaction-only'` para que solo aparezca si hace falta.
  - El botón principal va deshabilitado (en gris) hasta que el formulario sea válido.
  - Al pie: "Tus datos viven en tu teléfono y se respaldan en tu cuenta. Sin anuncios ni rastreo."
  - Mantener `aria-pressed` en las pestañas y que no se llamen igual que el botón de enviar.
- **Cambiar contraseña** (`/ajustes/cuenta/contrasena`, desde Perfil): campos Actual, Nueva (con medidor) y Repetir, con "Coinciden / No coinciden" en vivo. "Guardar" se habilita cuando todo es válido. Debajo, el enlace "¿No la recuerdas? Te enviamos un enlace" (`resetPasswordForEmail`, que ya existe). Usar `supabase.auth.updateUser({ password })`, reautenticando antes con la actual.
- **Cerrar sesión**: hoja de confirmación con ícono rojo, "¿Cerrar sesión?" y el texto "Tus datos siguen en tu cuenta…". Tiene un checkbox opcional **"Borrar también de este teléfono"** (limpia Dexie; ver el e2e `13-account-isolation`), el botón rojo "Cerrar sesión" y "Cancelar". Al confirmar vuelve al login con el correo ya escrito y un aviso verde.
- **Nueva categoría** (hoja): una vista previa grande del avatar con el nombre editable debajo, un segmentado Gasto | Ingreso, 12 colores (los `--cat-*`) en una grilla de 6 y 10 íconos en una grilla de 5. Guarda con `CategoryForm`.
- **Métodos de pago** (`/ajustes/metodos`): una fila por método con ícono por tipo (banco, tarjeta, billetes), la etiqueta "Por defecto" y un subtítulo ("Crédito · corte 15, paga el 2"). Las tarjetas muestran una barra de cupo usado ("Usado $ 600.000 · Cupo $ 5.000.000", con el `creditLimit` de la migración 0007).
  - "+ Nuevo método de pago" abre una hoja: tipo Débito | Crédito | Efectivo y nombre. Si es crédito, pide día de corte y día de pago con steppers, y muestra una explicación en ámbar generada con `cycle.ts` ("Compras del 1 al 15 se pagan el 2 del mes siguiente…").
  - Tiene un switch "Usar por defecto".
- **Recordatorios v2**:
  - General: switch + segmentado **"Días antes | El mismo día"**.
    - Días antes: stepper de días (1–7) y **hora** en pasos de 30 min.
    - El mismo día: radios **1 hora antes · Horas antes [− 2 +] · Minutos antes [− 30 +] (pasos de 5) · A una hora exacta [8:00 a. m.]**. Cuenta desde la hora del movimiento, y si no tiene hora, desde las 9:00.
  - La vista previa de la notificación se actualiza con la hora y el texto reales.
  - **Por movimiento**: en la hoja de nuevo movimiento, una fila de chips con campana: General · Sin aviso · 1 día antes · Mismo día · 1 h antes · Mismo día · 8:00 a. m.
  - Datos: `Settings.reminder = { mode: 'days' | 'sameDay', days, time, sameDay: { kind: 'hours' | 'minutes' | 'at', value } }`. `Transaction.reminder?: same | 'none' | null` (`null` = general) y `Transaction.time?: 'HH:MM'`. `domain/reminders/schedule.ts` calcula el instante en UTC−5 como hoy. `supabase/manual/0003_reminder_cron.sql` debe correr cada 5–15 min en vez de a diario, para cubrir "minutos antes".
- **Legal → documento**: "‹ Legal", título de 30px, una entrada en `--text-muted` y bloques con `h2` de 16px, párrafos a 14px/1.6 y viñetas con punto índigo. Ancho máximo de 62ch. El contenido sale de `features/legal/documents.ts`, igual que hoy.
- **Organizar gráficos** (`ChartManager`): se mantiene el patrón de flechas + ojo (no arrastrar), ahora en una hoja con filas sobre `--paper`. La fila oculta queda al 45% y el botón muestra "· 1 oculto". Las tarjetas de Análisis leen el orden y la visibilidad (`chartLayout`).
- **Movimientos**:
  - Grupos en orden **Quincena del 10 → Quincena del 25**.
  - Cada encabezado de grupo es un botón que **pliega** el grupo. Plegado muestra "N mov. · Restante $X". Guardar en `localStorage` por `periodKey`.
  - **Vista mensual** (`payDays.length === 1`): un solo grupo "Septiembre" (o "Mes desde el 10") y la línea de Inicio pasa a "Septiembre · quedan $…".
  - **Seleccionar**: aparece una barra flotante sobre la tab bar con "N seleccionados · Todos · Pagado · Eliminar".
    - Eliminar abre una confirmación con la lista y el total ("Suman $ 64.100. Esto no se puede deshacer.").
    - Borra con `deleteTransaction` y registra en `deletions` (migración 0005) para que el borrado sincronice.

## 9g. Escritorio y tablet (responsive)

Referencia: turno 2 del prototipo (2a).

- **< 760 px**: el diseño móvil de este documento.
- **760–1099 px**: la tab bar se convierte en un **riel lateral** de 72 px (íconos + etiqueta pequeña) y el `+` va arriba del riel. `Screen` sigue centrado a 560 px. Las hojas (`role="dialog"`) se abren como diálogo centrado de 480 px con `border-radius: 24px`, en lugar de subir desde abajo.
- **≥ 1100 px**:
  - `AppLayout` pasa a `grid-template-columns: 248px 1fr`.
  - **Barra lateral**: logo, Inicio, Análisis y Ajustes (con el mismo `TABS` del `TabBar`), una tarjeta de la quincena activa con su progreso ("día 5 de 15") y la cuenta con el estado de sincronización.
  - **Encabezado**: saludo + fecha, `MonthNav`, un buscador (⌘K abre el buscador de Movimientos) y el botón "Nuevo movimiento", que abre el `QuickActionSheet` como diálogo.
  - **Inicio en 2 columnas**: la izquierda (410 px) tiene hero + flujos, "Falta este mes" y Presupuestos (columnas). La derecha tiene **Movimientos embebido** como tabla (`grid-template-columns: 32px 1fr 90px 100px 96px 140px`: check, concepto + categoría, fecha, método, estado, monto), con los grupos por quincena plegables, los filtros y Lista | Calendario en su encabezado.
  - En escritorio, `/movimientos` puede redirigir a `/`, porque ya está visible en Inicio.
  - Análisis en escritorio: las tarjetas en una grilla de 2 columnas (`repeat(auto-fill, minmax(420px, 1fr))`).
  - Hover en filas (`--surface` → `--hover`) y cursor pointer. Nada depende de hover para funcionar.
- **Ajustes en escritorio (2c)**: dos columnas. A la izquierda, una navegación de 250 px con los mismos grupos del móvil (Cuenta, Preferencias, Tu plata, Organizar, Avanzado). A la derecha, el detalle. Las rutas \`/ajustes/*\` del móvil se renderizan en el panel derecho en lugar de empujar pantalla.
  - Lo que en móvil son hojas aparte (nueva categoría, nuevo método, cambiar contraseña, cerrar sesión) se ve **junto a la lista**, en una columna de 340 px o en una tarjeta.
  - Idioma y Tema comparten pantalla. Moneda usa una grilla de 2 columnas. Legal muestra la lista a la izquierda y el documento a la derecha.
  - El tema y el idioma se aplican igual que en el móvil.
- **Escritorio: acciones (2a, 2d)**:
  - **Nuevo movimiento** abre un diálogo centrado de 780 px: tipo Gasto | Ingreso | Recurrente arriba. A la izquierda, el monto en un input grande (se escribe con el teclado físico), concepto, monedas, categorías, método y aviso. A la derecha, el mini calendario siempre visible. Guardar/Cancelar abajo a la derecha. Esc cierra.
  - **Calendario**: en la tarjeta de Movimientos, "Calendario" cambia la tabla por un mes completo (celdas de 88 px con hasta 2 movimientos por día, punto del color de la categoría y "+N más") y el detalle del día debajo.
  - **Seleccionar**: los checks de la tabla pasan a seleccionar. Arriba aparece una barra con "N seleccionados · Todos · Marcar pagado · Eliminar". Eliminar abre un diálogo de confirmación con la lista y el total.
  - **Login (2d)**: pantalla partida. A la izquierda, la marca, un titular, una vista previa del número de Inicio y 3 puntos (sin conexión, privacidad, sin rastreo). A la derecha, el mismo formulario del móvil, a 400 px.
- Implementación: un hook `useBreakpoint()` con `matchMedia` y, donde se pueda, CSS con `@container` o `@media` en `index.css`. Mantener un único árbol de componentes.

## 9h. Login con demo animada (escritorio)

- El panel izquierdo de 2d usa **datos de ejemplo**, nunca los del usuario (no hay sesión todavía). Lleva la etiqueta "Datos de ejemplo".
- La tarjeta rota cada 3,4 s entre 4 meses ficticios (`DEMO_MONTHS` en `features/auth/demo.ts`: mes, te queda, recibido, falta pagar). El número principal se anima con el `AnimatedNumber` existente (700 ms, ease-out cúbico).
- **Titular con efecto máquina de escribir**: "Tu plata," fijo, y debajo, en `--q10`, alterna "quincena a quincena." ↔ "mes a mes.". Escribe a 80 ms por letra, espera 2 s, borra a 40 ms por letra y cambia de frase, con un cursor de 4 px que parpadea (`@keyframes blink`). En inglés: "paycheck by paycheck." ↔ "month by month.".
- Respetar `prefers-reduced-motion`: sin máquina de escribir (se muestra la primera frase) y sin rotación de la tarjeta.
- En el móvil el login no lleva panel de marca, solo el formulario (ver §9f).

## 10. Checklist

Progreso por fase (§12): **Fase 1 ✅** · **Fase 2 ✅** · **Fase 3 ✅** · Fase 4 ⬜ · Fase 5 ⬜ · Fase 6 ⬜ · Fase 7 ⬜ · Fase 8 ⬜ · Fase 9 ⬜ · Fase 10 ⬜

- [x] Tokens oscuros actualizados — Fase 1
- [x] TabBar con 3 pestañas + FAB lateral; `RefreshButton` eliminado — Fase 2
- [x] `/calendario` redirige a `/movimientos?vista=calendario` — Fase 2
- [x] `CalendarView` extraído y montado en Movimientos — Fase 2
- [x] Inicio: hero nuevo, "Falta pagar" abre `ToPaySheet`, sin `PeriodCard` ni `ExpectCard` — Fase 3
- [ ] Análisis: donut fusionado con la lista de categorías
- [ ] Ajustes agrupado en subpantallas
- [x] `LegalFooter` solo en Legal — Fase 2
- [x] Logo 1c en `Logo.tsx` y los íconos regenerados — Fase 1
- [ ] Moneda por movimiento + método Efectivo (tipos, migración 0013, mappers, nlp)
- [ ] Hoja de nuevo movimiento compacta; QuickEntrySheet con moneda y método
- [ ] Análisis: sin "Ingresos vs. gastos", tarjetas plegables, columnas de presupuesto
- [ ] Subpantallas: pagos, categorías, recurrentes, presupuestos, atajos
- [ ] Subpantallas: perfil, idioma, tema (en vivo), moneda + monedas rápidas, recordatorios, datos, legal
- [ ] Login/registro nuevos, cambiar contraseña, cerrar sesión con opción de borrar local
- [ ] Nueva categoría, métodos de pago (+ nuevo con corte/pago)
- [ ] Recordatorios v2 (días/mismo día) + aviso por movimiento; cron cada 5–15 min
- [x] Movimientos: 10 → 25, grupos plegables, vista mensual, barra de selección con Eliminar — Fase 3
- [x] Cero hex sueltos en componentes (todo por variables) — Fase 1
- [ ] `npm run typecheck && npm test && npm run test:e2e` en verde (e2e a revisar: 24, 25, 29, 31, 32, 38)


## 11. Pendiente: lo que la app todavía NO tiene

Hechos: 6, 7, 8 (Fase 3).

Cada punto dice qué falta, dónde va y cómo hacerlo. Nada de esto requiere reescribir `src/domain/`, solo extenderlo.

1. **Moneda por movimiento**
   - `types.ts`: `Transaction` y `RecurringRule` suman `currency?: string`, `originalAmount?: number` y `fxRate?: number`.
   - `amount` sigue siendo el entero en la moneda principal (`Math.round(originalAmount * fxRate)`), así que ningún cálculo cambia.
   - Migración `0013_currency_cash.sql` + `mappers.ts` + test de ida y vuelta.
   - UI: chips de moneda (§9b). La tasa se pide o se edita en la hoja (sin API externa: la app es local-first).
   - `Settings.quickCurrencies: string[]`, por defecto `['COP','USD','EUR']`.
2. **Método "Efectivo"**
   - `PaymentMethod.type` suma `'cash'`, sembrado en `seed` y en onboarding.
   - Filtros y Análisis ("Por método de pago") con 3 segmentos.
3. **Hora en movimientos + recordatorios v2**
   - `Transaction.time?: 'HH:MM'`.
   - `Settings.reminder = { mode: 'days'|'sameDay', days: number, time: 'HH:MM', sameDay: { kind: 'hours'|'minutes'|'at', value: number | 'HH:MM' } }`.
   - `Transaction.reminder?: typeof Settings.reminder | 'none' | null` (`null` = usar el general).
   - `domain/reminders/schedule.ts` calcula el instante (UTC−5, sin DST), con tests de cada modo.
   - El cron (`supabase/manual/0003_reminder_cron.sql` / `0010`) pasa a cada 5–15 min y la Edge Function envía los que caen en la ventana.
4. **Cerrar sesión con "Borrar también de este teléfono"**: si se marca, después de `signOut` hacer `db.delete()` + `db.open()` y limpiar `localStorage` de preferencias. Test e2e nuevo basado en `13-account-isolation`.
5. **Cambiar contraseña dentro de la app**: hoy solo existe por enlace de recuperación. Reautenticar con `signInWithPassword` y la actual, y luego `auth.updateUser({ password })`. Mensajes con `translateError`.
6. **Selección → Eliminar en lote**: la multiselección existe. Falta la barra de acciones y la confirmación con el total, y borrar registrando cada borrado en `deletions` (0005) para que sincronice.
7. **Grupos plegables en Movimientos**: estado en `localStorage` por `periodKey`, en orden cronológico (10 → 25). Vista mensual cuando `payDays.length === 1`.
8. **Fecha editable en la hoja rápida**: mini calendario en la hoja. Fecha pasada = pagado, futura = `pending`. La quincena se resuelve con `calculatePeriod`.
9. **Presupuestos en columnas**: reemplaza `BudgetColumns` (§9c). Stepper ±50.000 en `/ajustes/presupuestos`.
10. **Análisis plegable**: estado por tarjeta en `localStorage` junto a `chartLayout`. Sale "Ingresos vs. gastos".
11. **Tema claro sin hex sueltos**: todo por variables (§1 y §9e). `grep -rn "#[0-9A-Fa-f]\{6\}" src/features src/components` debe salir vacío fuera de `tokens.css`.
12. **i18n**: cada texto nuevo va a `src/i18n/texts.ts` en ES y EN. Correr el e2e `27-english-has-no-spanish` y ampliarlo a las pantallas nuevas (`38-english-new-screens`).
13. **Escritorio y tablet**: `useBreakpoint()`; sidebar, Inicio en 2 columnas con Movimientos en tabla, Ajustes en dos paneles, diálogos centrados y login partido (§9g, §9h).
14. **Logo 1c** + regenerar los íconos.

## 12. Plan de trabajo por fases

Cada fase va en su propia rama y termina con `npm run typecheck && npm run lint && npm test && npm run test:e2e` en verde. Los e2e que cambian de comportamiento se actualizan en la misma fase (no se borran).

1. **Fundaciones**: tokens (§1), logo (§9), `Screen` con `back`, cero hex sueltos, useBreakpoint.
2. **Navegación**: TabBar de 3 pestañas + FAB, `/calendario` → `/movimientos?vista=calendario`, sacar `LegalFooter` y `RefreshButton`. e2e: 24, 25, 29, 31, 32.
3. **Inicio y Movimientos**: §3, §4, pendientes 6, 7 y 8.
4. **Hoja de nuevo movimiento**: §5, §9b, pendientes 1 y 2 (tipos + migración 0013), aviso por movimiento (UI).
5. **Análisis**: §6, §9c, pendientes 9 y 10.
6. **Ajustes**: §7, §9d, §9e, §9f (perfil, idioma, tema en vivo, moneda, pagos, recordatorios, categorías, métodos, recurrentes, presupuestos, atajos, datos, legal), pendientes 4 y 5.
7. **Recordatorios v2 (backend)**: pendiente 3 (dominio + cron + Edge Function) con tests.
8. **Login**: §9f + §9h.
9. **Escritorio/tablet**: §9g.
10. **Idioma**: pendiente 12 al final, pasando por todas las pantallas.

Al terminar cada fase, actualizar `CHANGELOG.md` y marcar la §10.
