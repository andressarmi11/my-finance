# Step up — Presupuestos (Tope y Meta) + Ayúdame a ahorrar

> **Para la sesión que implementa esto:** son dos cambios encadenados. Primero la **Parte A** (Tope/Meta en presupuestos) y después la **Parte B** (Ayúdame a ahorrar), que se monta sobre A. No toques nada más del rediseño.
>
> Prototipo de referencia: `docs/presupuestos/Step Up Rediseno.dc.html`.
> - **1a (móvil):** Análisis → tarjeta "Ayúdame a ahorrar" y tarjeta Presupuestos. Ajustes → Presupuestos (Tope | Meta + botón del plan). En "Ir a" hay un atajo "Ayúdame a ahorrar".
> - **3a (escritorio):** Análisis en 2 columnas y página del plan con el panel "Personalizar".
> - **2a (escritorio):** tarjeta Presupuestos en Inicio.
>
> Todo texto nuevo va en `src/i18n/texts.ts` (ES y EN).

## Parte A · Presupuestos: Tope y Meta

Un presupuesto puede ser de gasto o de ahorro, así que "% usado" no sirve para los dos casos.

- `Budget.kind: 'limit' | 'goal'`, por defecto `'limit'`. Las categorías de tipo ahorro nacen como `'goal'`. Migración con default `'limit'`.
- **Tope (limit)**: se comporta como hoy. La columna se llena con el color de la categoría. Si pasa del 100 %, el relleno y el borde van en `--danger` y aparece "te pasaste".
- **Meta (goal)**:
  - La columna se llena con un degradado `--positive` y el borde punteado va en verde tenue.
  - Encima lleva una etiqueta "Meta" en verde suave. Al llegar al 100 %, el borde pasa a sólido `--positive` y la etiqueta a "✓ Meta" sobre verde.
  - El % se muestra en verde. Pasarse nunca es malo: no hay rojo.
- **Resumen**: la cabecera muestra "Gastos 89% · Ahorro 86%" (cada parte solo si existe). El subtítulo, "Gastaste 2,5M de 3M · Ahorraste 3M de 3,5M".
- **Ajustes → Presupuestos**:
  - Cada fila con límite tiene un segmentado mini **Tope | Meta** debajo del nombre.
  - En metas, la línea dice "Ahorrado $X de $Y · faltan $Z" o "· meta cumplida".
  - La intro explica los dos: "Tope: lo máximo que quieres gastar. Meta: lo que quieres llegar a ahorrar."
- Cálculo: para una meta, `spent` = lo registrado en esa categoría (o los movimientos marcados como ahorro), igual que hoy. Solo cambia la lectura.
- i18n: Tope/Limit, Meta/Goal, "Gastos N% · Ahorro N%" / "Spending N% · Savings N%", "Ahorrado … · faltan …" / "Saved … · … to go", "meta cumplida" / "goal reached".

### Tarjeta Presupuestos (móvil y escritorio)

- Header: título "Presupuestos" + enlace "Editar".
- Dos stats en grid 1fr 1fr sobre `--paper`: **Gastos** ("4,2M de 4,7M", % en `--text`, o en `--danger` si se pasa) y **Ahorro** ("3M de 3,5M", % en `--positive`). Cada uno se muestra solo si existe.
- Columnas de ancho fijo (76–84 px), gap de 12, scroll horizontal y `padding-top: 24px` para que quepa la etiqueta "Meta".
- Montos en cero se muestran como "$ 0".

## Parte B · Ayúdame a ahorrar

### Entradas

- **Análisis**: una tarjeta justo debajo del balance.
  - Sin plan: título "Ayúdame a ahorrar" y el texto "Te muestro dónde podrías ahorrar sin tocar lo fijo.".
  - Con plan: "Plan de ahorro activo", con "$X más al mes · hasta <fecha>" y fondo verde tenue.
- **Ajustes → Presupuestos**: un botón punteado verde, "Armar con Ayúdame a ahorrar" (o "Ajustar mi plan de ahorro" si ya hay uno).
- Se abre como una pantalla completa que entra desde la derecha. Tapa la barra y tiene "‹ Análisis" para volver. Al cambiar de pestaña, se cierra.

### Flujo (3 pasos)

1. **Tu plan** (vista simple):
   - Hero con "Puedes ahorrar $X más al mes, además de lo que ya apartas" (en modo meta: "Para <meta> puedes apartar $X · la cumples en N meses").
   - **Cómo quedaría tu plata**: barra apilada con Fijos, Día a día, Ya ahorras, Plan y Libre, más su leyenda.
   - **Dónde recortar**: una fila por categoría con recorte, con "Promedio A → tope B" y "− X". Al tocar una fila se despliega el porqué, con datos reales del usuario.
   - Una línea al final: "No se tocan: Hogar (fijo), Salud…".
   - CTA **"Crear presupuesto con este plan"** + **"Personalizar"**.
2. **Personalizar** (recalcula en vivo, con un pie fijo "Ahorras al mes $X" y el botón "Ver plan"):
   - **Objetivo**: Un monto al mes (stepper ±50 mil, muestra "Lo máximo sensato hoy") | Llegar a una meta (nombre + monto ±500 mil → "la cumples en N meses").
   - **Intensidad**: Suave 10 %, Equilibrado 20 % (default) e Intenso 30 %, como recorte máximo por categoría.
   - **Duración**: Días, Semanas, Meses o Año + stepper, o, en modo meta, el toggle "Hasta cumplir la meta" (activo por defecto). Muestra "Empieza el … y termina el …". Si es por días o semanas, los topes se muestran también por semana (mensual × 12 / 52).
   - **Categorías**: cada una se puede marcar "Se puede ajustar" o "No tocar". Hogar sale como "Fijo" y no se puede cambiar; Salud viene en "No tocar" por defecto.
3. **Listo**: resumen de lo creado (Topes por categoría + Meta de ahorro), la nota "solo informan, nunca bloquean", y los botones **Ver presupuestos** y **Volver a Análisis**.

### ¿Cuándo empieza?

- En Personalizar, antes de Duración: segmentado **Este mes** (default) | **Próx. quincena** | **Próx. mes** | **Otro**. "Otro" muestra un selector de mes (‹ nov 2026 ›, hasta 14 meses adelante).
- Este mes cuenta desde el día 1: lo ya gastado entra en los topes. Próxima quincena empieza en el siguiente `payDay` (usa `calculatePeriod`). Próximo mes / Otro empiezan el día 1.
- La nota explica el efecto. En el paso 1 aparece una píldora "Empieza el 1 sep 2026 · Cambiar" que abre Personalizar.
- `SavingsPlan.startDate`. La duración y "hasta cumplir la meta" se calculan desde ahí.

### Análisis con plan activo (Quincena / Mes / Trimestre / Año)

- La tarjeta de entrada se reemplaza por **"Plan de ahorro · <periodo>"**, con la ventana del plan (inicio → fin) y el enlace "Ajustar".
- Se intersecta el periodo seleccionado con [inicio, fin] del plan:
  - **Meta del periodo** = objetivo mensual × meses del plan dentro del periodo (la quincena ≈ 0,5).
  - **Llevas ahorrado** = lo real en el tramo transcurrido. Va en una barra verde con una **línea blanca de ritmo** (la fracción del periodo que ya pasó).
  - **Por categoría**: gastado vs. tope del periodo, con la misma línea de ritmo. Una categoría por encima del ritmo va en `--q25` y se nombra en la nota ("Alimentación va por encima del ritmo").
  - **Trimestre**: "el plan cubre N de 3 meses". **Año**: "Proyección a diciembre: $X extra".
- Si el periodo es anterior al inicio: "Tu plan empieza el …, así que este mes todavía no cuenta". Si es posterior al fin: "Tu plan terminó antes de …".
- i18n incluida: Plan de ahorro / Savings plan, Llevas ahorrado / Saved, meta / goal, Vas al ritmo / You're on pace, Proyección a diciembre / Projection to December.

### Eliminar el plan

- Botón "Eliminar plan" (texto `--danger`) al final del paso 1 cuando hay un plan activo. En escritorio, también en la tarjeta del plan y al pie de Personalizar.
- Confirmación: "¿Eliminar tu plan de ahorro?" / "Tus presupuestos vuelven a como estaban antes del plan. Tus movimientos no se tocan." [Cancelar] [Eliminar plan].
- Al crear el plan se guarda `SavingsPlan.prevBudgets` (snapshot). Si se actualiza el plan, se conserva el snapshot original. Eliminar restaura el snapshot, borra `SavingsPlan` y los `planId`, y muestra el toast "Plan eliminado".
- i18n: Eliminar plan / Delete plan, y la confirmación en ES/EN.

### Escritorio (prototipo 3a)

- **Análisis**:
  - Grid de 1,25fr / 1fr. A la izquierda, la tarjeta del plan: entrada grande con "Ver mi plan" si no hay plan, o el plan activo con meta, ritmo, categorías en 2 columnas y la proyección.
  - A la derecha, Presupuestos (stats + columnas) con el enlace al plan.
  - El selector de periodo va en el header.
- **Ayúdame a ahorrar** es una página dentro de Análisis ("‹ Análisis"), no un modal. Grid de 1fr / 420 px:
  - Izquierda: hero + distribución lado a lado, aviso y "Dónde recortar" como tabla (avatar, promedio→tope, porqué siempre visible, ahorro).
  - Derecha: panel sticky "Personalizar" con Objetivo, ¿Cuándo empieza?, Intensidad, Duración y Categorías (como chips que alternan "Se puede ajustar" / "No tocar"), más el total, el CTA y "Eliminar plan".
- Al crear o actualizar, vuelve a Análisis con la tarjeta del plan activo.

### Motor de recomendación (`src/domain/savings/plan.ts`, puro y con tests)

Entrada:
- Promedio de los últimos 3 meses por categoría, sin atípicos (un movimiento más de 2,5 veces la mediana de la categoría se marca como único y no cuenta).
- Ingreso mensual promedio.
- Ahorro actual (categorías de tipo ahorro).
- Bloqueos del usuario, intensidad, objetivo y duración.

Reglas para que las sugerencias tengan sentido:
- **Fijos** (recurrentes con monto estable, arriendo, créditos) → recorte 0, siempre.
- Cada categoría tiene un **peso de flexibilidad** `w` (entretenimiento/compras/suscripciones 1, alimentación 0,6, transporte 0,4, salud 0,15) y un **piso** (mínimo razonable: por ejemplo, alimentación nunca baja del gasto en mercado sin domicilios, y transporte no baja del gasto base en bus).
- `cap = min(avg − piso, round10k(avg × intensidad × w))`. Si está bloqueada, `cap = 0`.
- Monto objetivo: se reparte proporcional a los `cap`. Si el usuario pide más que `Σcap`, se limita y se muestra el aviso "Más de $X significaría recortar lo esencial…". Nunca se recorta más de lo posible.
- Meta: `meses = ceil(monto / Σrecorte)`. Si `Σrecorte = 0`, se pide liberar una categoría.
- **Porqués**: cada recorte explica su motivo con datos reales, como número de domicilios, % sobre el promedio, gasto único detectado o la suscripción más cara. Si no hay un dato que lo respalde, esa categoría no se sugiere.
- Redondeo a 10.000 COP (o a 10 en USD/EUR).

### Al confirmar

- Por cada categoría con recorte: `Budget { kind: 'limit', limit: avg − cut, planId }`.
- Ahorro: `Budget { kind: 'goal', limit: ahorroActual + Σcut, planId }` (en modo meta, además `goalName` y `goalAmount`).
- `SavingsPlan { id, mode, intensity, locked[], unit, n, untilGoal, startDate, endDate, monthlyTarget }`, en Dexie + sync.
- Al llegar `endDate` (o cumplir la meta): una notificación y un aviso en Análisis con "¿Renovar o terminar?". Terminar deja los presupuestos como estaban antes (guardar el snapshot previo).
- Volver a abrir el plan con uno activo precarga la configuración, y el CTA pasa a "Actualizar mi presupuesto".

### i18n

Ayúdame a ahorrar / Help me save · Tu plan / Your plan · Personalizar / Customize · Dónde recortar / Where to cut · Cómo quedaría tu plata / How your money would look · Fijos / Fixed · Día a día / Day to day · Ya ahorras / Already saving · Libre / Free · Un monto al mes / Monthly amount · Llegar a una meta / Reach a goal · Suave / Gentle · Equilibrado / Balanced · Intenso / Intense · Días, Semanas, Meses, Año / Days, Weeks, Months, Year · Hasta cumplir la meta / Until the goal is reached · Se puede ajustar / Adjustable · No tocar / Don't touch · Fijo / Fixed · Crear presupuesto con este plan / Create budget from this plan · Plan de ahorro activo / Savings plan active. Los porqués se generan con plantillas en las dos lenguas.

### Tests

- Unitarios de `plan.ts`:
  - Fijos y bloqueadas → 0.
  - Nunca por debajo del piso.
  - Objetivo mayor que `Σcap` → se limita y marca `over`.
  - Meta → meses correctos.
  - Un atípico no infla el promedio.
- e2e `43-help-me-save`: Análisis → plan → Personalizar (bloquear Entretenimiento, Intenso, meta 3M) → Crear → Presupuestos muestra los topes y la meta → Análisis muestra "Plan activo".

### Checklist

- [ ] Motor `plan.ts` + tests
- [ ] Entradas en Análisis y Presupuestos
- [ ] ¿Cuándo empieza? (este mes / próx. quincena / próx. mes / otro)
- [ ] Tarjeta de plan en Análisis por Quincena/Mes/Trimestre/Año, con línea de ritmo
- [ ] Paso 1 (plan), paso 2 (personalizar) y paso 3 (listo)
- [ ] Crea y actualiza presupuestos Tope/Meta + `SavingsPlan`
- [ ] Fin del plan: renovar o terminar, con restauración
- [ ] Eliminar plan con confirmación y restauración del snapshot
- [ ] Escritorio: Análisis 2 columnas + página del plan con panel Personalizar
- [ ] ES/EN completos
- [ ] typecheck, lint, test y test:e2e en verde

## Orden de trabajo

1. Rama `feat/budget-goals`: Parte A completa (tipo, migración, UI, textos ES/EN, tests).
2. Rama `feat/help-me-save` (sobre A): motor `plan.ts` + tests → entradas → pasos 1–3 → "¿Cuándo empieza?" → tarjeta por periodo en Análisis → eliminar plan → escritorio.
3. Cada rama termina con `npm run typecheck && npm run lint && npm test && npm run test:e2e` en verde y una entrada en `CHANGELOG.md`.
